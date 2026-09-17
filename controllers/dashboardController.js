const { PrismaClient } = require('@prisma/client');
const { success } = require('../utils/response');

const prisma = new PrismaClient();

const getDashboardSummary = async (req, res) => {
    const [totalProducts, totalWarehouses, inventoryStats, inventoryRows] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.warehouse.count({ where: { isActive: true } }),
        prisma.inventory.aggregate({
            where: {
                product: { isActive: true },
                warehouse: { isActive: true }
            },
            _sum: { quantity: true }
        }),
        prisma.inventory.findMany({
            include: {
                product: { select: { id: true, sku: true, name: true, minStock: true, isActive: true } },
                warehouse: { select: { id: true, name: true, code: true, isActive: true } },
                location: { select: { id: true, code: true, name: true } }
            }
        })
    ]);

    const grouped = new Map();

    for (const row of inventoryRows) {
        if (!row.product.isActive || !row.warehouse.isActive) continue;

        const key = `${row.productId}-${row.warehouseId}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                productId: row.productId,
                warehouseId: row.warehouseId,
                sku: row.product.sku,
                productName: row.product.name,
                minStock: row.product.minStock,
                warehouseName: row.warehouse.name,
                warehouseCode: row.warehouse.code,
                quantity: 0,
                locations: []
            });
        }

        const group = grouped.get(key);
        group.quantity += row.quantity;
        group.locations.push({
            id: row.location?.id || null,
            code: row.location?.code || null,
            name: row.location?.name || null,
            quantity: row.quantity
        });
    }

    const stockSummary = Array.from(grouped.values());
    const lowStockDetails = stockSummary.filter(
        (item) => item.minStock > 0 && item.quantity > 0 && item.quantity < item.minStock
    );
    const outOfStockDetails = stockSummary.filter((item) => item.quantity <= 0);

    return success(res, 200, 'Data dashboard berhasil diambil.', {
        overview: {
            totalProducts,
            totalWarehouses,
            totalPhysicalStock: inventoryStats._sum.quantity || 0
        },
        alerts: {
            lowStockCount: lowStockDetails.length,
            outOfStockCount: outOfStockDetails.length,
            lowStockDetails,
            outOfStockDetails
        }
    });
};

module.exports = { getDashboardSummary };
