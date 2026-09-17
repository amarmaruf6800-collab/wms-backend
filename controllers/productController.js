const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const {
    isNonEmptyString,
    parseNonNegativeNumber,
    parseNonNegativeInt,
    getPagination,
    sendValidationError
} = require('../utils/validation');

const prisma = new PrismaClient();

const getProducts = async (req, res) => {
    const { search = '', active } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const where = {};

    if (String(search).trim()) {
        where.OR = [
            { sku: { contains: String(search).trim() } },
            { name: { contains: String(search).trim() } }
        ];
    }

    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.product.count({ where })
    ]);

    return success(res, 200, 'Data produk berhasil diambil.', {
        items: products,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
};


const getProductById = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return sendValidationError(res, 'ID produk tidak valid.');
    }

    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            inventories: {
                include: {
                    warehouse: { select: { id: true, code: true, name: true } },
                    location: { select: { id: true, code: true, name: true } }
                }
            }
        }
    });

    if (!product) return failure(res, 404, 'Produk tidak ditemukan.');

    return success(res, 200, 'Detail produk berhasil diambil.', product);
};

const createProduct = async (req, res) => {
    const { sku, name, description = null, price = 0, minStock = 0 } = req.body;

    if (!isNonEmptyString(sku)) return sendValidationError(res, 'SKU wajib diisi.');
    if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama produk wajib diisi.');

    const parsedPrice = parseNonNegativeNumber(price);
    if (parsedPrice === null) return sendValidationError(res, 'Harga harus berupa angka >= 0.');

    const parsedMinStock = parseNonNegativeInt(minStock);
    if (parsedMinStock === null) return sendValidationError(res, 'Minimum stock harus berupa bilangan bulat >= 0.');

    const newProduct = await prisma.product.create({
        data: {
            sku: sku.trim(),
            name: name.trim(),
            description: description ? String(description).trim() : null,
            price: parsedPrice,
            minStock: parsedMinStock
        }
    });

    return success(res, 201, 'Produk berhasil ditambahkan.', newProduct);
};

const updateProduct = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return sendValidationError(res, 'ID produk tidak valid.');
    }

    const { sku, name, description, price, minStock, isActive } = req.body;
    const data = {};

    if (sku !== undefined) {
        if (!isNonEmptyString(sku)) return sendValidationError(res, 'SKU tidak boleh kosong.');
        data.sku = sku.trim();
    }

    if (name !== undefined) {
        if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama produk tidak boleh kosong.');
        data.name = name.trim();
    }

    if (description !== undefined) data.description = description ? String(description).trim() : null;

    if (price !== undefined) {
        const parsedPrice = parseNonNegativeNumber(price);
        if (parsedPrice === null) return sendValidationError(res, 'Harga harus berupa angka >= 0.');
        data.price = parsedPrice;
    }

    if (minStock !== undefined) {
        const parsedMinStock = parseNonNegativeInt(minStock);
        if (parsedMinStock === null) return sendValidationError(res, 'Minimum stock harus berupa bilangan bulat >= 0.');
        data.minStock = parsedMinStock;
    }

    if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') return sendValidationError(res, 'isActive harus boolean.');
        data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
        return sendValidationError(res, 'Tidak ada data yang diubah.');
    }

    const updatedProduct = await prisma.product.update({
        where: { id },
        data
    });

    return success(res, 200, 'Produk berhasil diupdate.', updatedProduct);
};

const deleteProduct = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return sendValidationError(res, 'ID produk tidak valid.');
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return failure(res, 404, 'Produk tidak ditemukan.');

    const updatedProduct = await prisma.product.update({
        where: { id },
        data: { isActive: false }
    });

    return success(res, 200, 'Produk berhasil dinonaktifkan.', updatedProduct);
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
