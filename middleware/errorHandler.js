const { failure } = require('../utils/response');

const notFoundHandler = (req, res) => {
    return failure(res, 404, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`);
};

const errorHandler = (error, req, res, next) => {
    console.error(error);

    if (res.headersSent) {
        return next(error);
    }

    if (error.code === 'P2002') {
        return failure(res, 409, 'Data dengan nilai unik tersebut sudah digunakan.');
    }

    if (error.code === 'P2025') {
        return failure(res, 404, 'Data yang diminta tidak ditemukan.');
    }

    return failure(res, 500, 'Terjadi kesalahan pada server.');
};

module.exports = { notFoundHandler, errorHandler };
