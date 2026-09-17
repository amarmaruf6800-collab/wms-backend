const express = require('express');
const router = express.Router();
const {
    getWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
} = require('../controllers/warehouseController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', getWarehouses);
router.post('/', requireAdmin, createWarehouse);
router.put('/:id', requireAdmin, updateWarehouse);
router.delete('/:id', requireAdmin, deleteWarehouse);

module.exports = router;
