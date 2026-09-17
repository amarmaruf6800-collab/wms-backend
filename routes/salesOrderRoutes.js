const express = require('express');
const router = express.Router();
const {
    getSalesOrders,
    getSalesOrderById,
    createSalesOrder,
    updateSalesOrderStatus,
    shipSalesOrder,
    deleteSalesOrder
} = require('../controllers/salesOrderController');
const {
    pickSalesOrderItem,
    startPicking
} = require('../controllers/pickingController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', getSalesOrders);
router.get('/:id', getSalesOrderById);
router.post('/', createSalesOrder);
router.post('/:id/start-picking', startPicking);
router.post('/:id/pick', pickSalesOrderItem);
router.patch('/:id/status', updateSalesOrderStatus);
router.post('/:id/ship', shipSalesOrder);
router.delete('/:id', requireAdmin, deleteSalesOrder);

module.exports = router;
