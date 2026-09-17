const express = require('express');
const router = express.Router();
const { getCustomers, createCustomer, updateCustomer } = require('../controllers/customerController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', getCustomers);
router.post('/', requireAdmin, createCustomer);
router.put('/:id', requireAdmin, updateCustomer);

module.exports = router;
