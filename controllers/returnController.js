const { PrismaClient } = require('@prisma/client');
const { failure } = require('../utils/response');
const {
    isNonEmptyString,
    parsePositiveInt,
    parseNonNegativeNumber,
    getPagination,
    sendValidationError
} = require('../utils/validation');

const prisma = new PrismaClient();

const VALID_STATUSES = [
    "REQUESTED",
    "RECEIVED",
    "INSPECTED",
    "RESTOCKED",
    "REJECTED",
    "CANCELLED",
];

const VALID_CONDITIONS = ["GOOD", "DAMAGED"];

function success(res, message, data = null, status = 200) {
    return res.status(status).json({
        success: true,
        message,
        data,
    });
}

function error(res, message, status = 400) {
    return res.status(status).json({
        success: false,
        message,
    });
}

async function generateReturnNumber(tx) {
    const now = new Date();

    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("");

    const prefix = `RET-${date}-`;

    const latest = await tx.salesReturn.findFirst({
        where: {
            returnNumber: {
                startsWith: prefix,
            },
        },
        orderBy: {
            id: "desc",
        },
        select: {
            returnNumber: true,
        },
    });

    let sequence = 1;

    if (latest?.returnNumber) {
        const lastNumber = Number(
            latest.returnNumber.replace(prefix, "")
        );

        if (Number.isInteger(lastNumber)) {
            sequence = lastNumber + 1;
        }
    }

    return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/**
 * GET /api/returns
 */
async function getReturns(req, res) {
    try {
        const {
            search = "",
            status,
            page = 1,
            limit = 20,
        } = req.query;

        const pageNumber = Math.max(Number(page) || 1, 1);
        const limitNumber = Math.min(
            Math.max(Number(limit) || 20, 1),
            100
        );

        const skip = (pageNumber - 1) * limitNumber;

        const where = {};

        if (status) {
            where.status = status;
        }

        if (search.trim()) {
            where.OR = [
                {
                    returnNumber: {
                        contains: search.trim(),
                    },
                },
                {
                    salesOrder: {
                        orderNumber: {
                            contains: search.trim(),
                        },
                    },
                },
                {
                    salesOrder: {
                        customer: {
                            name: {
                                contains: search.trim(),
                            },
                        },
                    },
                },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.salesReturn.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    salesOrder: {
                        include: {
                            customer: true,
                        },
                    },
                    warehouse: true,
                    items: {
                        include: {
                            product: true,
                            salesOrderItem: true,
                            location: true,
                        },
                    },
                },
            }),

            prisma.salesReturn.count({ where }),
        ]);

        return success(res, "Returns berhasil diambil.", {
            items,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages: Math.ceil(total / limitNumber),
            },
        });
    } catch (err) {
        console.error("getReturns:", err);
        return error(res, "Gagal mengambil data return.", 500);
    }
}

/**
 * GET /api/returns/:id
 */
async function getReturnById(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return error(res, "ID return tidak valid.");
        }

        const item = await prisma.salesReturn.findUnique({
            where: { id },
            include: {
                salesOrder: {
                    include: {
                        customer: true,
                    },
                },
                warehouse: true,
                items: {
                    include: {
                        product: true,
                        salesOrderItem: true,
                        location: true,
                    },
                },
            },
        });

        if (!item) {
            return error(res, "Return tidak ditemukan.", 404);
        }

        return success(res, "Return berhasil diambil.", item);
    } catch (err) {
        console.error("getReturnById:", err);
        return error(res, "Gagal mengambil return.", 500);
    }
}

/**
 * POST /api/returns
 */
async function createReturn(req, res) {
    try {
        const {
            salesOrderId,
            reason,
            notes,
            items,
        } = req.body;

        const orderId = Number(salesOrderId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return error(res, "salesOrderId tidak valid.");
        }

        if (!Array.isArray(items) || items.length === 0) {
            return error(res, "Return harus memiliki minimal satu item.");
        }

        const result = await prisma.$transaction(async (tx) => {
            const salesOrder = await tx.salesOrder.findUnique({
                where: { id: orderId },
                include: {
                    items: true,
                },
            });

            if (!salesOrder) {
                throw new Error("Sales Order tidak ditemukan.");
            }

            if (salesOrder.status !== "DELIVERED") {
                throw new Error(
                    "Return hanya dapat dibuat untuk Sales Order yang sudah DELIVERED."
                );
            }

            const orderItems = new Map(
                salesOrder.items.map((item) => [item.id, item])
            );

            const processedItems = [];
            const usedOrderItems = new Set();

            for (const item of items) {
                const salesOrderItemId = Number(
                    item.salesOrderItemId
                );
                const quantity = Number(item.quantity);

                if (
                    !Number.isInteger(salesOrderItemId) ||
                    salesOrderItemId <= 0
                ) {
                    throw new Error(
                        "salesOrderItemId tidak valid."
                    );
                }

                if (
                    !Number.isInteger(quantity) ||
                    quantity <= 0
                ) {
                    throw new Error(
                        "Quantity return harus berupa bilangan bulat lebih dari 0."
                    );
                }

                if (usedOrderItems.has(salesOrderItemId)) {
                    throw new Error(
                        "Sales Order Item tidak boleh duplikat."
                    );
                }

                const orderItem = orderItems.get(
                    salesOrderItemId
                );

                if (!orderItem) {
                    throw new Error(
                        `Sales Order Item ${salesOrderItemId} bukan bagian dari Sales Order ini.`
                    );
                }

                if (quantity > orderItem.quantity) {
                    throw new Error(
                        `Quantity return untuk ${salesOrderItemId} melebihi quantity order.`
                    );
                }

                usedOrderItems.add(salesOrderItemId);

                processedItems.push({
                    salesOrderItemId,
                    productId: orderItem.productId,
                    quantity,
                });
            }

            const returnNumber = await generateReturnNumber(tx);

            return tx.salesReturn.create({
                data: {
                    returnNumber,
                    salesOrderId: salesOrder.id,
                    warehouseId: salesOrder.warehouseId,
                    reason: reason?.trim() || null,
                    notes: notes?.trim() || null,

                    items: {
                        create: processedItems,
                    },
                },

                include: {
                    salesOrder: {
                        include: {
                            customer: true,
                        },
                    },
                    warehouse: true,
                    items: {
                        include: {
                            product: true,
                            salesOrderItem: true,
                        },
                    },
                },
            });
        });

        return success(
            res,
            "Return berhasil dibuat.",
            result,
            201
        );
    } catch (err) {
        console.error("createReturn:", err);

        return error(
            res,
            err.message || "Gagal membuat return."
        );
    }
}

/**
 * PATCH /api/returns/:id/status
 */
async function updateReturnStatus(req, res) {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return error(res, "ID return tidak valid.");
        }

        if (!VALID_STATUSES.includes(status)) {
            return error(res, "Status return tidak valid.");
        }

        const current = await prisma.salesReturn.findUnique({
            where: { id },
        });

        if (!current) {
            return error(res, "Return tidak ditemukan.", 404);
        }

        const transitions = {
            REQUESTED: ["RECEIVED", "CANCELLED"],
            RECEIVED: ["INSPECTED", "REJECTED", "CANCELLED"],
            INSPECTED: ["RESTOCKED", "REJECTED"],
            RESTOCKED: [],
            REJECTED: [],
            CANCELLED: [],
        };

        if (!transitions[current.status]?.includes(status)) {
            return error(
                res,
                `Tidak dapat mengubah status dari ${current.status} ke ${status}.`
            );
        }

        const data = {
            status,
        };

        if (status === "RECEIVED") {
            data.receivedAt = new Date();
        }

        if (status === "INSPECTED") {
            data.inspectedAt = new Date();
        }

        const updated = await prisma.salesReturn.update({
            where: { id },
            data,
        });

        return success(
            res,
            `Return berhasil diubah menjadi ${status}.`,
            updated
        );
    } catch (err) {
        console.error("updateReturnStatus:", err);
        return error(
            res,
            err.message || "Gagal mengubah status return."
        );
    }
}

/**
 * POST /api/returns/:id/inspect
 */
async function inspectReturn(req, res) {
    try {
        const id = Number(req.params.id);
        const { items } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return error(res, "ID return tidak valid.");
        }

        if (!Array.isArray(items) || items.length === 0) {
            return error(res, "Item inspeksi wajib diisi.");
        }

        const result = await prisma.$transaction(async (tx) => {
            const returnOrder = await tx.salesReturn.findUnique({
                where: { id },
                include: {
                    items: true,
                },
            });

            if (!returnOrder) {
                throw new Error("Return tidak ditemukan.");
            }

            if (returnOrder.status !== "RECEIVED") {
                throw new Error(
                    "Return harus berstatus RECEIVED sebelum inspeksi."
                );
            }

            for (const inspection of items) {
                const returnItemId = Number(
                    inspection.returnItemId
                );

                const condition = inspection.condition;

                if (!VALID_CONDITIONS.includes(condition)) {
                    throw new Error(
                        "Condition harus GOOD atau DAMAGED."
                    );
                }

                const returnItem = returnOrder.items.find(
                    (item) => item.id === returnItemId
                );

                if (!returnItem) {
                    throw new Error(
                        `Return item ${returnItemId} tidak ditemukan.`
                    );
                }

                await tx.salesReturnItem.update({
                    where: {
                        id: returnItemId,
                    },
                    data: {
                        condition,
                        notes: inspection.notes?.trim() || null,
                    },
                });
            }

            return tx.salesReturn.update({
                where: {
                    id,
                },
                data: {
                    status: "INSPECTED",
                    inspectedAt: new Date(),
                },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                },
            });
        });

        return success(
            res,
            "Return berhasil diinspeksi.",
            result
        );
    } catch (err) {
        console.error("inspectReturn:", err);
        return error(
            res,
            err.message || "Gagal melakukan inspeksi return."
        );
    }
}

/**
 * POST /api/returns/:id/restock
 */
async function restockReturn(req, res) {
    try {
        const id = Number(req.params.id);
        const { items } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return error(res, "ID return tidak valid.");
        }

        if (!Array.isArray(items) || items.length === 0) {
            return error(res, "Item restock wajib diisi.");
        }

        const result = await prisma.$transaction(
            async (tx) => {
                const returnOrder =
                    await tx.salesReturn.findUnique({
                        where: { id },
                        include: {
                            items: true,
                        },
                    });

                if (!returnOrder) {
                    throw new Error("Return tidak ditemukan.");
                }

                if (returnOrder.status !== "INSPECTED") {
                    throw new Error(
                        "Return harus berstatus INSPECTED sebelum restock."
                    );
                }

                for (const restock of items) {
                    const returnItemId = Number(
                        restock.returnItemId
                    );

                    const quantity = Number(restock.quantity);
                    const locationId = restock.locationId
                        ? Number(restock.locationId)
                        : null;

                    const returnItem = returnOrder.items.find(
                        (item) => item.id === returnItemId
                    );

                    if (!returnItem) {
                        throw new Error(
                            `Return item ${returnItemId} tidak ditemukan.`
                        );
                    }

                    if (returnItem.condition !== "GOOD") {
                        throw new Error(
                            `Product ${returnItem.productId} tidak dapat direstock karena condition DAMAGED.`
                        );
                    }

                    const remaining =
                        returnItem.quantity -
                        returnItem.restockedQuantity;

                    if (
                        !Number.isInteger(quantity) ||
                        quantity <= 0 ||
                        quantity > remaining
                    ) {
                        throw new Error(
                            `Quantity restock tidak valid untuk return item ${returnItemId}.`
                        );
                    }

                    if (locationId) {
                        const location =
                            await tx.warehouseLocation.findUnique({
                                where: {
                                    id: locationId,
                                },
                            });

                        if (
                            !location ||
                            location.warehouseId !==
                            returnOrder.warehouseId
                        ) {
                            throw new Error(
                                "Location tidak berada di warehouse return."
                            );
                        }
                    }

                    const existingInventory =
                        await tx.inventory.findFirst({
                            where: {
                                productId: returnItem.productId,
                                warehouseId: returnOrder.warehouseId,
                                locationId,
                            },
                        });

                    if (existingInventory) {
                        await tx.inventory.update({
                            where: {
                                id: existingInventory.id,
                            },
                            data: {
                                quantity: {
                                    increment: quantity,
                                },
                            },
                        });
                    } else {
                        await tx.inventory.create({
                            data: {
                                productId: returnItem.productId,
                                warehouseId:
                                    returnOrder.warehouseId,
                                locationId,
                                quantity,
                            },
                        });
                    }

                    await tx.stockMovement.create({
                        data: {
                            productId: returnItem.productId,
                            warehouseId:
                                returnOrder.warehouseId,
                            locationId,
                            quantity,
                            type: "RETURN",
                            reference:
                                returnOrder.returnNumber,
                        },
                    });

                    await tx.salesReturnItem.update({
                        where: {
                            id: returnItemId,
                        },
                        data: {
                            restockedQuantity: {
                                increment: quantity,
                            },
                            locationId,
                        },
                    });
                }

                const updatedItems =
                    await tx.salesReturnItem.findMany({
                        where: {
                            salesReturnId: id,
                        },
                    });

                const allRestocked =
                    updatedItems.every(
                        (item) =>
                            item.condition === "DAMAGED" ||
                            item.restockedQuantity >= item.quantity
                    );

                return tx.salesReturn.update({
                    where: {
                        id,
                    },
                    data: allRestocked
                        ? {
                            status: "RESTOCKED",
                            restockedAt: new Date(),
                        }
                        : {},
                    include: {
                        items: {
                            include: {
                                product: true,
                                location: true,
                            },
                        },
                    },
                });
            }
        );

        return success(
            res,
            "Return berhasil diproses.",
            result
        );
    } catch (err) {
        console.error("restockReturn:", err);
        return error(
            res,
            err.message || "Gagal melakukan restock return."
        );
    }
}

module.exports = {
    getReturns,
    getReturnById,
    createReturn,
    updateReturnStatus,
    inspectReturn,
    restockReturn,
};