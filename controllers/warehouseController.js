const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const { isNonEmptyString, getPagination, sendValidationError } = require('../utils/validation');

const prisma = new PrismaClient();

const getWarehouses = async (req, res) => {
    const { search = '', active } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const where = {};
    if (String(search).trim()) {
        where.OR = [
            { code: { contains: String(search).trim() } },
            { name: { contains: String(search).trim() } }
        ];
    }

    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const [warehouses, total] = await Promise.all([
        prisma.warehouse.findMany({
            where,
            include: {
                _count: { select: { locations: true } }
            },
            orderBy: { id: 'desc' },
            skip,
            take: limit
        }),
        prisma.warehouse.count({ where })
    ]);

    return success(res, 200, 'Data warehouse berhasil diambil.', {
        items: warehouses,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
};

const createWarehouse = async (req, res) => {
    const { code, name, location = null } = req.body;

    if (!isNonEmptyString(code)) return sendValidationError(res, 'Kode warehouse wajib diisi.');
    if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama warehouse wajib diisi.');

    const warehouse = await prisma.warehouse.create({
        data: {
            code: code.trim(),
            name: name.trim(),
            location: location ? String(location).trim() : null
        }
    });

    return success(res, 201, 'Warehouse berhasil ditambahkan.', warehouse);
};

const updateWarehouse = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendValidationError(res, 'ID warehouse tidak valid.');

    const { code, name, location, isActive } = req.body;
    const data = {};

    if (code !== undefined) {
        if (!isNonEmptyString(code)) return sendValidationError(res, 'Kode warehouse tidak boleh kosong.');
        data.code = code.trim();
    }
    if (name !== undefined) {
        if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama warehouse tidak boleh kosong.');
        data.name = name.trim();
    }
    if (location !== undefined) data.location = location ? String(location).trim() : null;
    if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') return sendValidationError(res, 'isActive harus boolean.');
        data.isActive = isActive;
    }

    if (!Object.keys(data).length) return sendValidationError(res, 'Tidak ada data yang diubah.');

    const warehouse = await prisma.warehouse.update({ where: { id }, data });
    return success(res, 200, 'Warehouse berhasil diupdate.', warehouse);
};

const deleteWarehouse = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendValidationError(res, 'ID warehouse tidak valid.');

    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) return failure(res, 404, 'Warehouse tidak ditemukan.');

    const updatedWarehouse = await prisma.warehouse.update({
        where: { id },
        data: { isActive: false }
    });

    return success(res, 200, 'Warehouse berhasil dinonaktifkan.', updatedWarehouse);
};

module.exports = { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse };
