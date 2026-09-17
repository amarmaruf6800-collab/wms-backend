const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const { isNonEmptyString, parsePositiveInt, parseNonNegativeNumber, getPagination, sendValidationError } = require('../utils/validation');

const prisma = new PrismaClient();
const VALID_STATUSES = ['DRAFT', 'CONFIRMED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const generateOrderNumber = async (tx) => {
    const prefix = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const lastOrder = await tx.salesOrder.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { id: 'desc' },
        select: { orderNumber: true }
    });

    const lastSequence = lastOrder ? Number(lastOrder.orderNumber.split('-').pop()) || 0 : 0;
    return `${prefix}-${String(lastSequence + 1).padStart(4, '0')}`;
};

const getSalesOrders = async (req, res) => {
    const { search = '', status, warehouseId, customerId } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const where = {};

    if (String(search).trim()) {
        const term = String(search).trim();
        where.OR = [
            { orderNumber: { contains: term } },
            { customer: { name: { contains: term } } }
        ];
    }

    if (status) {
        if (!VALID_STATUSES.includes(String(status).toUpperCase())) {
            return sendValidationError(res, 'Status sales order tidak valid.');
        }
        where.status = String(status).toUpperCase();
    }

    if (warehouseId) {
        const id = parsePositiveInt(warehouseId);
        if (!id) return sendValidationError(res, 'warehouseId tidak valid.');
        where.warehouseId = id;
    }

    if (customerId) {
        const id = parsePositiveInt(customerId);
        if (!id) return sendValidationError(res, 'customerId tidak valid.');
        where.customerId = id;
    }

    const [items, total] = await Promise.all([
        prisma.salesOrder.findMany({
            where,
            include: {
                customer: { select: { id: true, name: true, email: true, phone: true } },
                warehouse: { select: { id: true, code: true, name: true } },
                items: {
                    include: { product: { select: { id: true, sku: true, name: true } } },
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'desc' },
            skip,
            take: limit
        }),
        prisma.salesOrder.count({ where })
    ]);

    return success(res, 200, 'Data sales order berhasil diambil.', {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
};

const getSalesOrderById = async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return sendValidationError(res, 'ID sales order tidak valid.');

    const order = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: true,
            warehouse: true,
            items: {
                include: { product: true },
                orderBy: { id: 'asc' }
            }
        }
    });

    if (!order) return failure(res, 404, 'Sales order tidak ditemukan.');
    return success(res, 200, 'Detail sales order berhasil diambil.', order);
};

const createSalesOrder = async (req, res) => {
    const customerId = parsePositiveInt(req.body.customerId);
    const warehouseId = parsePositiveInt(req.body.warehouseId);
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    const shippingAddress = req.body.shippingAddress ? String(req.body.shippingAddress).trim() : null;
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    if (!customerId || !warehouseId) {
        return sendValidationError(res, 'customerId dan warehouseId wajib berupa ID yang valid.');
    }

    if (!items || items.length === 0) {
        return sendValidationError(res, 'Sales order minimal memiliki satu item.');
    }

    const normalizedItems = [];
    const productIds = new Set();

    for (const item of items) {
        const productId = parsePositiveInt(item.productId);
        const quantity = Number(item.quantity);
        const unitPrice = item.unitPrice === undefined || item.unitPrice === null
            ? null
            : parseNonNegativeNumber(item.unitPrice);

        if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
            return sendValidationError(res, 'Setiap item harus memiliki productId valid dan quantity bilangan bulat > 0.');
        }

        if (item.unitPrice !== undefined && item.unitPrice !== null && unitPrice === null) {
            return sendValidationError(res, 'unitPrice harus berupa angka >= 0.');
        }

        if (productIds.has(productId)) {
            return sendValidationError(res, 'Produk yang sama tidak boleh muncul dua kali dalam satu sales order.');
        }
        productIds.add(productId);
        normalizedItems.push({ productId, quantity, unitPrice });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const [customer, warehouse, products] = await Promise.all([
                tx.customer.findUnique({ where: { id: customerId } }),
                tx.warehouse.findUnique({ where: { id: warehouseId } }),
                tx.product.findMany({ where: { id: { in: [...productIds] }, isActive: true } })
            ]);

            if (!customer || !customer.isActive) throw new Error('Customer tidak ditemukan atau tidak aktif.');
            if (!warehouse || !warehouse.isActive) throw new Error('Warehouse tidak ditemukan atau tidak aktif.');
            if (products.length !== productIds.size) throw new Error('Satu atau lebih produk tidak ditemukan atau tidak aktif.');

            const productMap = new Map(products.map((product) => [product.id, product]));
            const orderNumber = await generateOrderNumber(tx);

            let totalAmount = 0;
            const itemData = normalizedItems.map((item) => {
                const product = productMap.get(item.productId);
                const price = item.unitPrice === null ? Number(product.price) : item.unitPrice;
                const subtotal = price * item.quantity;
                totalAmount += subtotal;
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: price,
                    subtotal
                };
            });

            const order = await tx.salesOrder.create({
                data: {
                    orderNumber,
                    customerId,
                    warehouseId,
                    status: 'DRAFT',
                    shippingAddress,
                    notes,
                    totalAmount,
                    items: { create: itemData }
                },
                include: {
                    customer: true,
                    warehouse: true,
                    items: { include: { product: true } }
                }
            });

            return order;
        });

        return success(res, 201, 'Sales order berhasil dibuat.', result);
    } catch (error) {
        throw error;
    }
};

const updateSalesOrderStatus = async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const status = String(req.body.status || '').trim().toUpperCase();

    if (!id) return sendValidationError(res, 'ID sales order tidak valid.');
    if (!VALID_STATUSES.includes(status)) return sendValidationError(res, 'Status sales order tidak valid.');

    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) return failure(res, 404, 'Sales order tidak ditemukan.');

    const allowedTransitions = {
        DRAFT: ['CONFIRMED', 'CANCELLED'],
        CONFIRMED: ['PICKING', 'CANCELLED'],
        PICKING: ['PACKED'],
        PACKED: [],
        SHIPPED: ['DELIVERED'],
        DELIVERED: [],
        CANCELLED: []
    };

    if (!allowedTransitions[order.status].includes(status)) {
        return failure(res, 409, `Perubahan status ${order.status} ke ${status} tidak diizinkan.`);
    }

    if (status === 'PACKED') {
        const items = await prisma.salesOrderItem.findMany({
            where: { salesOrderId: id },
            select: { quantity: true, pickedQuantity: true }
        });

        if (!items.length || items.some((item) => item.pickedQuantity < item.quantity)) {
            return failure(res, 409, 'Sales order belum dapat dipacking karena masih ada item yang belum selesai dipicking.');
        }
    }

    const updated = await prisma.salesOrder.update({
        where: { id },
        data: { status },
        include: {
            customer: { select: { id: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            items: { include: { product: { select: { id: true, sku: true, name: true } } } }
        }
    });

    return success(res, 200, `Status sales order berhasil diubah menjadi ${status}.`, updated);
};

const shipSalesOrder = async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const shippingProvider = String(req.body.shippingProvider || '').trim();
    const trackingNumber = String(req.body.trackingNumber || '').trim();

    if (!id) return sendValidationError(res, 'ID sales order tidak valid.');
    if (!shippingProvider) return sendValidationError(res, 'Shipping provider wajib diisi.');
    if (!trackingNumber) return sendValidationError(res, 'Tracking number wajib diisi.');

    const order = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            items: {
                orderBy: { id: 'asc' },
                include: {
                    product: { select: { id: true, sku: true, name: true } }
                }
            }
        }
    });

    if (!order) return failure(res, 404, 'Sales order tidak ditemukan.');
    if (order.status !== 'PACKED') {
        return failure(res, 409, `Sales order dengan status ${order.status} belum dapat dikirim. Order harus berstatus PACKED.`);
    }

    const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
            status: 'SHIPPED',
            shippingProvider,
            trackingNumber
        },
        include: {
            customer: { select: { id: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            items: {
                orderBy: { id: 'asc' },
                include: {
                    product: { select: { id: true, sku: true, name: true } }
                }
            }
        }
    });

    return success(res, 200, 'Sales order berhasil dikirim.', updated);
};

const deleteSalesOrder = async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) return sendValidationError(res, 'ID sales order tidak valid.');

    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) return failure(res, 404, 'Sales order tidak ditemukan.');
    if (!['DRAFT', 'CANCELLED'].includes(order.status)) {
        return failure(res, 409, 'Sales order hanya dapat dihapus saat DRAFT atau CANCELLED.');
    }

    await prisma.salesOrder.delete({ where: { id } });
    return success(res, 200, 'Sales order berhasil dihapus.');
};

module.exports = {
    getSalesOrders,
    getSalesOrderById,
    createSalesOrder,
    updateSalesOrderStatus,
    shipSalesOrder,
    deleteSalesOrder
};
