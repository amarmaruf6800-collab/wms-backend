const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const { parsePositiveInt, sendValidationError } = require('../utils/validation');

const prisma = new PrismaClient();

const pickSalesOrderItem = async (req, res) => {
    const salesOrderId = parsePositiveInt(req.params.id);
    const itemId = parsePositiveInt(req.body.itemId);
    const quantity = parsePositiveInt(req.body.quantity);
    const locationId = req.body.locationId === undefined || req.body.locationId === null || req.body.locationId === ''
        ? null
        : parsePositiveInt(req.body.locationId);
    const reference = req.body.reference ? String(req.body.reference).trim() : null;

    if (!salesOrderId) return sendValidationError(res, 'ID sales order tidak valid.');
    if (!itemId) return sendValidationError(res, 'itemId tidak valid.');
    if (!quantity) return sendValidationError(res, 'quantity harus berupa bilangan bulat > 0.');
    if (locationId === null) return sendValidationError(res, 'locationId wajib dipilih untuk picking.');

    try {
        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.salesOrder.findUnique({
                where: { id: salesOrderId },
                include: {
                    customer: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, code: true, name: true } },
                    items: {
                        orderBy: { id: 'asc' },
                        include: { product: { select: { id: true, sku: true, name: true } } }
                    }
                }
            });

            if (!order) throw new Error('Sales order tidak ditemukan.');
            if (!['CONFIRMED', 'PICKING'].includes(order.status)) {
                throw new Error(`Sales order dengan status ${order.status} tidak dapat dipicking.`);
            }

            const item = order.items.find((row) => row.id === itemId);
            if (!item) throw new Error('Sales order item tidak ditemukan pada order tersebut.');

            const remainingQuantity = item.quantity - item.pickedQuantity;
            if (remainingQuantity <= 0) {
                throw new Error('Item sales order ini sudah selesai dipicking.');
            }

            if (quantity > remainingQuantity) {
                throw new Error(`Quantity picking melebihi sisa item. Sisa yang harus dipick ${remainingQuantity} unit.`);
            }

            const location = await tx.warehouseLocation.findUnique({
                where: { id: locationId }
            });

            if (!location || !location.isActive) {
                throw new Error('Lokasi warehouse tidak ditemukan atau tidak aktif.');
            }

            if (location.warehouseId !== order.warehouseId) {
                throw new Error('Lokasi picking bukan bagian dari fulfillment warehouse sales order.');
            }

            const inventory = await tx.inventory.findFirst({
                where: {
                    productId: item.productId,
                    warehouseId: order.warehouseId,
                    locationId
                }
            });

            if (!inventory) {
                throw new Error('Stok barang tidak ditemukan pada lokasi tersebut.');
            }

            if (inventory.quantity < quantity) {
                throw new Error(`Stok di lokasi tersebut tidak mencukupi. Sisa stok ${inventory.quantity} unit.`);
            }

            const updatedInventory = await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                    quantity: { decrement: quantity }
                }
            });

            const movement = await tx.stockMovement.create({
                data: {
                    productId: item.productId,
                    warehouseId: order.warehouseId,
                    locationId,
                    userId: req.user.id,
                    type: 'PICKING',
                    quantity: -quantity,
                    reference: reference || `${order.orderNumber}/ITEM-${item.id}`
                }
            });

            const updatedItem = await tx.salesOrderItem.update({
                where: { id: item.id },
                data: {
                    pickedQuantity: { increment: quantity }
                },
                include: {
                    product: { select: { id: true, sku: true, name: true } }
                }
            });

            const updatedOrderStatus = order.status === 'CONFIRMED'
                ? 'PICKING'
                : order.status;

            if (updatedOrderStatus !== order.status) {
                await tx.salesOrder.update({
                    where: { id: order.id },
                    data: { status: updatedOrderStatus }
                });
            }

            const allItemsPicked = order.items.every((row) => {
                if (row.id === item.id) {
                    return row.pickedQuantity + quantity >= row.quantity;
                }
                return row.pickedQuantity >= row.quantity;
            });

            const updatedOrder = await tx.salesOrder.findUnique({
                where: { id: order.id },
                include: {
                    customer: { select: { id: true, name: true } },
                    warehouse: { select: { id: true, code: true, name: true } },
                    items: {
                        orderBy: { id: 'asc' },
                        include: { product: { select: { id: true, sku: true, name: true } } }
                    }
                }
            });

            return {
                order: updatedOrder,
                item: updatedItem,
                inventory: updatedInventory,
                movement,
                allItemsPicked
            };
        });

        return success(
            res,
            200,
            result.allItemsPicked
                ? 'Picking item berhasil. Semua item sales order sudah dipick.'
                : 'Picking item berhasil.',
            result
        );
    } catch (error) {
        const status = [
            'Sales order tidak ditemukan.',
            'Sales order item tidak ditemukan pada order tersebut.',
            'Item sales order ini sudah selesai dipicking.'
        ].includes(error.message) ? 404 : 409;

        return failure(res, status, error.message);
    }
};

const startPicking = async (req, res) => {
    const salesOrderId = parsePositiveInt(req.params.id);
    if (!salesOrderId) return sendValidationError(res, 'ID sales order tidak valid.');

    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } });
    if (!order) return failure(res, 404, 'Sales order tidak ditemukan.');
    if (order.status !== 'CONFIRMED') {
        return failure(res, 409, `Sales order dengan status ${order.status} tidak dapat memulai picking.`);
    }

    const updated = await prisma.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: 'PICKING' },
        include: {
            customer: { select: { id: true, name: true } },
            warehouse: { select: { id: true, code: true, name: true } },
            items: {
                orderBy: { id: 'asc' },
                include: { product: { select: { id: true, sku: true, name: true } } }
            }
        }
    });

    return success(res, 200, 'Sales order masuk ke proses picking.', updated);
};

module.exports = {
    pickSalesOrderItem,
    startPicking
};
