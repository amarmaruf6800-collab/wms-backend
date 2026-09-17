const { PrismaClient } = require('@prisma/client');
const { success, failure } = require('../utils/response');
const { isNonEmptyString, getPagination, sendValidationError } = require('../utils/validation');

const prisma = new PrismaClient();

const getCustomers = async (req, res) => {
    const { search = '', active } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const where = {};

    if (String(search).trim()) {
        const term = String(search).trim();
        where.OR = [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } }
        ];
    }

    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const [items, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            orderBy: { id: 'desc' },
            skip,
            take: limit
        }),
        prisma.customer.count({ where })
    ]);

    return success(res, 200, 'Data customer berhasil diambil.', {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
};

const createCustomer = async (req, res) => {
    const { name, email = null, phone = null, address = null } = req.body;

    if (!isNonEmptyString(name)) return sendValidationError(res, 'Nama customer wajib diisi.');

    if (email !== null && email !== undefined && !isNonEmptyString(email)) {
        return sendValidationError(res, 'Email customer tidak valid.');
    }

    try {
        const customer = await prisma.customer.create({
            data: {
                name: name.trim(),
                email: email ? email.trim().toLowerCase() : null,
                phone: phone ? String(phone).trim() : null,
                address: address ? String(address).trim() : null
            }
        });

        return success(res, 201, 'Customer berhasil ditambahkan.', customer);
    } catch (error) {
        if (error.code === 'P2002') {
            return failure(res, 409, 'Email customer sudah digunakan.');
        }
        throw error;
    }
};

const updateCustomer = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return sendValidationError(res, 'ID customer tidak valid.');

    const { name, email = null, phone = null, address = null, isActive } = req.body;
    if (name !== undefined && !isNonEmptyString(name)) {
        return sendValidationError(res, 'Nama customer tidak boleh kosong.');
    }

    try {
        const customer = await prisma.customer.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name: name.trim() } : {}),
                ...(email !== undefined ? { email: email ? String(email).trim().toLowerCase() : null } : {}),
                ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
                ...(address !== undefined ? { address: address ? String(address).trim() : null } : {}),
                ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {})
            }
        });

        return success(res, 200, 'Customer berhasil diperbarui.', customer);
    } catch (error) {
        if (error.code === 'P2025') return failure(res, 404, 'Customer tidak ditemukan.');
        if (error.code === 'P2002') return failure(res, 409, 'Email customer sudah digunakan.');
        throw error;
    }
};

module.exports = { getCustomers, createCustomer, updateCustomer };
