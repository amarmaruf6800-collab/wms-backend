const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const { isNonEmptyString, getPagination, sendValidationError } = require('../utils/validation');

const prisma = new PrismaClient();

const getLocations = async (req, res) => {
    const warehouseId = Number(req.query.warehouseId);
    const { search = '', active } = req.query;
    const { page, limit, skip } = getPagination(req.query);

    const where = {};

    if (Number.isInteger(warehouseId) && warehouseId > 0) {
        where.warehouseId = warehouseId;
    }

    if (String(search).trim()) {
        where.OR = [
            { code: { contains: String(search).trim() } },
            { name: { contains: String(search).trim() } }
        ];
    }

    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const [locations, total] = await Promise.all([
        prisma.warehouseLocation.findMany({
            where,
            include: {
                warehouse: { select: { id: true, code: true, name: true } }
            },
            orderBy: { id: 'desc' },
            skip,
            take: limit
        }),
        prisma.warehouseLocation.count({ where })
    ]);

    return success(res, 200, 'Data lokasi warehouse berhasil diambil.', {
        items: locations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
};

const createLocation = async (req, res) => {
    const warehouseId = Number(req.body.warehouseId);
    const { code, name } = req.body;

    if (!Number.isInteger(warehouseId) || warehouseId <= 0) return sendValidationError(res, 'warehouseId tidak valid.');
    if (!isNonEmptyString(code)) return sendValidationError(res, 'Kode lokasi wajib diisi.');
    if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama lokasi wajib diisi.');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || !warehouse.isActive) return failure(res, 404, 'Warehouse tidak ditemukan atau tidak aktif.');

    const location = await prisma.warehouseLocation.create({
        data: {
            warehouseId,
            code: code.trim(),
            name: name.trim()
        }
    });

    return success(res, 201, 'Lokasi warehouse berhasil dibuat.', location);
};

const updateLocation = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendValidationError(res, 'ID lokasi tidak valid.');

    const { code, name, isActive } = req.body;
    const data = {};

    if (code !== undefined) {
        if (!isNonEmptyString(code)) return sendValidationError(res, 'Kode lokasi tidak boleh kosong.');
        data.code = code.trim();
    }
    if (name !== undefined) {
        if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama lokasi tidak boleh kosong.');
        data.name = name.trim();
    }
    if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') return sendValidationError(res, 'isActive harus boolean.');
        data.isActive = isActive;
    }

    if (!Object.keys(data).length) return sendValidationError(res, 'Tidak ada data yang diubah.');

    const location = await prisma.warehouseLocation.update({ where: { id }, data });
    return success(res, 200, 'Lokasi berhasil diupdate.', location);
};

const deleteLocation = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendValidationError(res, 'ID lokasi tidak valid.');

    const location = await prisma.warehouseLocation.findUnique({ where: { id } });
    if (!location) return failure(res, 404, 'Lokasi tidak ditemukan.');

    const updated = await prisma.warehouseLocation.update({
        where: { id },
        data: { isActive: false }
    });

    return success(res, 200, 'Lokasi berhasil dinonaktifkan.', updated);
};

module.exports = { getLocations, createLocation, updateLocation, deleteLocation };
