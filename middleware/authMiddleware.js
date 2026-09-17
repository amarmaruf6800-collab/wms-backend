const jwt = require('jsonwebtoken');
const { failure } = require('../utils/response');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return failure(res, 401, 'Akses ditolak. Token tidak ditemukan.');
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
        return failure(res, 401, 'Akses ditolak. Token tidak ditemukan.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        return failure(res, 401, 'Akses ditolak. Token tidak valid atau sudah kedaluwarsa.');
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return failure(res, 403, 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.');
    }

    return next();
};

const requireAdmin = requireRole('ADMIN');

module.exports = { verifyToken, requireRole, requireAdmin };
