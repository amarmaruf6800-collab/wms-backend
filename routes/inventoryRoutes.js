const express = require('express');
const router = express.Router();
const {
    receiveStock,
    getInventory,
    getStockMovements,
    pickStock,
    transferStock,
    adjustStock
} = require('../controllers/inventoryController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', getInventory);
router.get('/movements', getStockMovements);

router.post('/receive', receiveStock);
router.post('/pick', pickStock);
router.post('/transfer', transferStock);
router.post('/adjust', requireAdmin, adjustStock);

module.exports = router;
