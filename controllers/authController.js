const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { success, failure } = require('../utils/response');
const { isNonEmptyString, sendValidationError } = require('../utils/validation');

const prisma = new PrismaClient();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const validateUserInput = ({ name, email, password, role, requireRole = false }) => {
    if (!isNonEmptyString(name)) return 'Nama wajib diisi.';
    if (!isNonEmptyString(email) || !email.includes('@')) return 'Email tidak valid.';
    if (!isNonEmptyString(password) || password.length < 6) return 'Password minimal 6 karakter.';

    if (requireRole && !['ADMIN', 'STAFF'].includes(role)) {
        return 'Role harus ADMIN atau STAFF.';
    }

    return null;
};

const createUserRecord = async ({ name, email, password, role = 'STAFF' }) => {
    const hashedPassword = await bcrypt.hash(password, 10);

    return prisma.user.create({
        data: {
            name: name.trim(),
            email: normalizeEmail(email),
            password: hashedPassword,
            role,
            isActive: true
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true
        }
    });
};

const register = async (req, res) => {
    const { name, email, password } = req.body;
    const validationError = validateUserInput({ name, email, password });

    if (validationError) {
        return sendValidationError(res, validationError);
    }

    try {
        // Public registration selalu STAFF. ADMIN dibuat oleh ADMIN melalui /users.
        const user = await createUserRecord({ name, email, password, role: 'STAFF' });
        return success(res, 201, 'User berhasil didaftarkan.', user);
    } catch (error) {
        if (error.code === 'P2002') {
            return failure(res, 409, 'Email sudah digunakan.');
        }
        throw error;
    }
};

const createUser = async (req, res) => {
    const { name, email, password, role = 'STAFF' } = req.body;
    const validationError = validateUserInput({ name, email, password, role, requireRole: true });

    if (validationError) {
        return sendValidationError(res, validationError);
    }

    try {
        const user = await createUserRecord({ name, email, password, role });
        return success(res, 201, 'User berhasil dibuat.', user);
    } catch (error) {
        if (error.code === 'P2002') {
            return failure(res, 409, 'Email sudah digunakan.');
        }
        throw error;
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
        return sendValidationError(res, 'Email dan password wajib diisi.');
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });

        if (!user || !user.isActive) {
            return failure(res, 401, 'Email atau password salah.');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return failure(res, 401, 'Email atau password salah.');
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
        );

        return success(res, 200, 'Login berhasil.', {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        throw error;
    }
};

const getMe = async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true
        }
    });

    if (!user || !user.isActive) {
        return failure(res, 401, 'Akun tidak ditemukan atau sudah dinonaktifkan.');
    }

    return success(res, 200, 'Data user berhasil diambil.', user);
};

module.exports = { register, createUser, login, getMe };
