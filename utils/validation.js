const { failure } = require('./response');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const parsePositiveInt = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
};

const parseNonNegativeInt = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
};

const parsePositiveNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

const parseNonNegativeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
};

const getPagination = (query) => {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limitRaw = parseInt(query.limit || '20', 10);
    const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 20 : limitRaw, 1), 100);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

const sendValidationError = (res, message) => failure(res, 400, message);

module.exports = {
    isNonEmptyString,
    parsePositiveInt,
    parseNonNegativeInt,
    parsePositiveNumber,
    parseNonNegativeNumber,
    getPagination,
    sendValidationError
};
