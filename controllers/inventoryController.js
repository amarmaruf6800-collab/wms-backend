const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const {
    parsePositiveInt,
    parseNonNegativeInt,
    getPagination,
    sendValidationError
} = require('../utils/validation');

const prisma = new PrismaClient();

const findInventory = async (tx, productId, warehouseId, locationId = null) => {
    return tx.inventory.findFirst({
        where: {
            productId,
            warehouseId,
            locationId: locationId ?? null
        }
    });
};

const ensureProduct = async (tx, productId) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw new Error('Produk tidak ditemukan atau tidak aktif.');
    return product;
};

const ensureWarehouse = async (tx, warehouseId) => {
    const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || !warehouse.isActive) throw new Error('Warehouse tidak ditemukan atau tidak aktif.');
    return warehouse;
};

const ensureLocation = async (tx, locationId, warehouseId) => {
    if (locationId === null || locationId === undefined) return null;

    const location = await tx.warehouseLocation.findUnique({ where: { id: locationId } });
    if (!location || !location.isActive || location.warehouseId !== warehouseId) {
        throw new Error('Lokasi tidak ditemukan, tidak aktif, atau bukan milik warehouse tersebut.');
    }

    return location;
};

const increaseInventory = async (tx, { productId, warehouseId, locationId = null, quantity }) => {
    const existing = await findInventory(tx, productId, warehouseId, locationId);

    if (existing) {
        return tx.inventory.update({
            where: { id: existing.id },
            data: { quantity: { increment: quantity } }
        });
    }

    return tx.inventory.create({
        data: {
            productId,
            warehouseId,
            locationId,
            quantity
        }
    });
};

const decreaseInventory = async (tx, { productId, warehouseId, locationId = null, quantity }) => {
    const existing = await findInventory(tx, productId, warehouseId, locationId);

    if (!existing) throw new Error('Stok barang tidak ditemukan di lokasi/warehouse tersebut.');
    if (existing.quantity < quantity) {
        throw new Error(`Stok tidak mencukupi. Sisa stok saat ini ${existing.quantity} unit.`);
    }

    return tx.inventory.update({
        where: { id: existing.id },
        data: { quantity: { decrement: quantity } }
    });
};

// Fitur: Barang Masuk (Inbound / Receiving)
const receiveStock = async (req, res) => {
    const productId = parsePositiveInt(req.body.productId);
    const warehouseId = parsePositiveInt(req.body.warehouseId);
    const quantity = parsePositiveInt(req.body.quantity);
    const locationId = req.body.locationId === undefined || req.body.locationId === null || req.body.locationId === ''
        ? null
        : parsePositiveInt(req.body.locationId);
    const reference = req.body.reference ? String(req.body.reference).trim() : null;

    if (!productId || !warehouseId || !quantity) {
        return sendValidationError(res, 'productId, warehouseId, dan quantity harus berupa bilangan bulat > 0.');
    }
    if (req.body.locationId !== undefined && locationId === null) {
        return sendValidationError(res, 'locationId tidak valid.');
    }

    const result = await prisma.$transaction(async (tx) => {
        await ensureProduct(tx, productId);
        await ensureWarehouse(tx, warehouseId);
        await ensureLocation(tx, locationId, warehouseId);

        const inventory = await increaseInventory(tx, {
            productId,
            warehouseId,
            locationId,
            quantity
        });

        const movement = await tx.stockMovement.create({
            data: {
                productId,
                warehouseId,
                locationId,
                userId: req.user.id,
                type: 'RECEIVING',
                quantity,
                reference
            }
        });

        return { inventory, movement };
    });

    return success(res, 200, 'Barang berhasil diterima.', result);
};

const getInventory = async (req, res) => {
    const { search = '' } = req.query;
    const productId = req.query.productId ? parsePositiveInt(req.query.productId) : null;
    const warehouseId = req.query.warehouseId ? parsePositiveInt(req.query.warehouseId) : null;
    const locationId = req.query.locationId ? parsePositiveInt(req.query.locationId) : null;
    const { page, limit, skip } = getPagination(req.query);

    if (req.query.productId && !productId) return sendValidationError(res, 'productId tidak valid.');
    if (req.query.warehouseId && !warehouseId) return sendValidationError(res, 'warehouseId tidak valid.');
    if (req.query.locationId && !locationId) return sendValidationError(res, 'locationId tidak valid.');

    const where = {};
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (locationId) where.locationId = locationId;

    if (String(search).trim()) {
        const term = String(search).trim();
        where.product = {
            OR: [
                { sku: { contains: term } },
                { name: { contains: term } }
            ]
        };
    }

    const [items, total] = await Promise.all([
        prisma.inventory.findMany({
            where,
            include: {
                product: { select: { id: true, sku: true, name: true, minStock: true, isActive: true } },
                warehouse: { select: { id: true, code: true, name: true, isActive: true } },
                location: { select: { id: true, code: true, name: true, isActive: true } }
            },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.inventory.count({ where })
    ]);

    return success(res, 200, 'Data inventory berhasil diambil.', {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
};

// Fungsi untuk melihat riwayat audit trail pergerakan stok
const getStockMovements = async (req, res) => {
    const { search = '', type } = req.query;
    const productId = req.query.productId ? parsePositiveInt(req.query.productId) : null;
    const warehouseId = req.query.warehouseId ? parsePositiveInt(req.query.warehouseId) : null;
    const { page, limit, skip } = getPagination(req.query);

    if (req.query.productId && !productId) return sendValidationError(res, 'productId tidak valid.');
    if (req.query.warehouseId && !warehouseId) return sendValidationError(res, 'warehouseId tidak valid.');

    const where = {};
    if (productId) where.productId = productId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (type) where.type = String(type).trim();

    if (String(search).trim()) {
        where.reference = { contains: String(search).trim() };
    }

    const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
            where,
            include: {
                product: { select: { id: true, sku: true, name: true } },
                warehouse: { select: { id: true, code: true, name: true } },
                location: { select: { id: true, code: true, name: true } },
                user: { select: { id: true, name: true, email: true, role: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.stockMovement.count({ where })
    ]);

    return success(res, 200, 'Riwayat pergerakan stok berhasil diambil.', {
        items: movements,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
};

// Fitur: Barang Keluar (Outbound / Picking)
const pickStock = async (req, res) => {
    const productId = parsePositiveInt(req.body.productId);
    const warehouseId = parsePositiveInt(req.body.warehouseId);
    const quantity = parsePositiveInt(req.body.quantity);
    const locationId = req.body.locationId === undefined || req.body.locationId === null || req.body.locationId === ''
        ? null
        : parsePositiveInt(req.body.locationId);
    const reference = req.body.reference ? String(req.body.reference).trim() : null;

    if (!productId || !warehouseId || !quantity) {
        return sendValidationError(res, 'productId, warehouseId, dan quantity harus berupa bilangan bulat > 0.');
    }
    if (req.body.locationId !== undefined && locationId === null) {
        return sendValidationError(res, 'locationId tidak valid.');
    }

    const result = await prisma.$transaction(async (tx) => {
        await ensureProduct(tx, productId);
        await ensureWarehouse(tx, warehouseId);
        await ensureLocation(tx, locationId, warehouseId);

        const inventory = await decreaseInventory(tx, {
            productId,
            warehouseId,
            locationId,
            quantity
        });

        const movement = await tx.stockMovement.create({
            data: {
                productId,
                warehouseId,
                locationId,
                userId: req.user.id,
                type: 'PICKING',
                quantity: -quantity,
                reference
            }
        });

        return { inventory, movement };
    });

    return success(res, 200, 'Barang berhasil dikeluarkan.', result);
};

// Fitur: Mutasi Barang Antar Gudang (Stock Transfer)
const transferStock = async (req, res) => {
    const productId = parsePositiveInt(req.body.productId);
    const fromWarehouseId = parsePositiveInt(req.body.fromWarehouseId);
    const toWarehouseId = parsePositiveInt(req.body.toWarehouseId);
    const quantity = parsePositiveInt(req.body.quantity);

    const fromLocationId = req.body.fromLocationId === undefined || req.body.fromLocationId === null || req.body.fromLocationId === ''
        ? null
        : parsePositiveInt(req.body.fromLocationId);
    const toLocationId = req.body.toLocationId === undefined || req.body.toLocationId === null || req.body.toLocationId === ''
        ? null
        : parsePositiveInt(req.body.toLocationId);

    const reference = req.body.reference ? String(req.body.reference).trim() : null;

    if (!productId || !fromWarehouseId || !toWarehouseId || !quantity) {
        return sendValidationError(res, 'productId, fromWarehouseId, toWarehouseId, dan quantity harus berupa bilangan bulat > 0.');
    }
    if (fromWarehouseId === toWarehouseId) {
        return sendValidationError(res, 'Gudang asal dan tujuan tidak boleh sama.');
    }
    if (req.body.fromLocationId !== undefined && fromLocationId === null) return sendValidationError(res, 'fromLocationId tidak valid.');
    if (req.body.toLocationId !== undefined && toLocationId === null) return sendValidationError(res, 'toLocationId tidak valid.');

    const result = await prisma.$transaction(async (tx) => {
        await ensureProduct(tx, productId);
        await ensureWarehouse(tx, fromWarehouseId);
        await ensureWarehouse(tx, toWarehouseId);
        await ensureLocation(tx, fromLocationId, fromWarehouseId);
        await ensureLocation(tx, toLocationId, toWarehouseId);

        const updatedSource = await decreaseInventory(tx, {
            productId,
            warehouseId: fromWarehouseId,
            locationId: fromLocationId,
            quantity
        });

        const updatedDestination = await increaseInventory(tx, {
            productId,
            warehouseId: toWarehouseId,
            locationId: toLocationId,
            quantity
        });

        const moveOut = await tx.stockMovement.create({
            data: {
                productId,
                warehouseId: fromWarehouseId,
                locationId: fromLocationId,
                userId: req.user.id,
                type: 'TRANSFER_OUT',
                quantity: -quantity,
                reference: reference || 'MUTASI-OUT'
            }
        });

        const moveIn = await tx.stockMovement.create({
            data: {
                productId,
                warehouseId: toWarehouseId,
                locationId: toLocationId,
                userId: req.user.id,
                type: 'TRANSFER_IN',
                quantity,
                reference: reference || 'MUTASI-IN'
            }
        });

        return { updatedSource, updatedDestination, moveOut, moveIn };
    });

    return success(res, 200, 'Mutasi stok berhasil.', result);
};

// Fitur: Penyesuaian Stok (Stock Opname / Adjustment)
const adjustStock = async (req, res) => {
    const productId = parsePositiveInt(req.body.productId);
    const warehouseId = parsePositiveInt(req.body.warehouseId);
    const actualQuantity = parseNonNegativeInt(req.body.actualQuantity);
    const locationId = req.body.locationId === undefined || req.body.locationId === null || req.body.locationId === ''
        ? null
        : parsePositiveInt(req.body.locationId);
    const reason = req.body.reason ? String(req.body.reason).trim() : null;

    if (!productId || !warehouseId || actualQuantity === null) {
        return sendValidationError(res, 'productId dan warehouseId harus > 0, sedangkan actualQuantity harus bilangan bulat >= 0.');
    }
    if (req.body.locationId !== undefined && locationId === null) {
        return sendValidationError(res, 'locationId tidak valid.');
    }

    const result = await prisma.$transaction(async (tx) => {
        await ensureProduct(tx, productId);
        await ensureWarehouse(tx, warehouseId);
        await ensureLocation(tx, locationId, warehouseId);

        const currentInventory = await findInventory(tx, productId, warehouseId, locationId);
        const currentQty = currentInventory ? currentInventory.quantity : 0;
        const difference = actualQuantity - currentQty;

        if (difference === 0) {
            throw new Error('Stok fisik sama dengan sistem. Tidak ada penyesuaian yang perlu dilakukan.');
        }

        let inventory;
        if (currentInventory) {
            inventory = await tx.inventory.update({
                where: { id: currentInventory.id },
                data: { quantity: actualQuantity }
            });
        } else {
            inventory = await tx.inventory.create({
                data: { productId, warehouseId, locationId, quantity: actualQuantity }
            });
        }

        const movement = await tx.stockMovement.create({
            data: {
                productId,
                warehouseId,
                locationId,
                userId: req.user.id,
                type: 'ADJUSTMENT',
                quantity: difference,
                reference: reason || 'STOCK OPNAME'
            }
        });

        return { inventory, movement, difference };
    });

    return success(
        res,
        200,
        `Stock opname berhasil. Selisih stok: ${result.difference > 0 ? '+' : ''}${result.difference}`,
        result
    );
};

module.exports = {
    receiveStock,
    getInventory,
    getStockMovements,
    pickStock,
    transferStock,
    adjustStock
};
