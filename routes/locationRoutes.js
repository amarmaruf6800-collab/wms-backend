const express = require('express');
const router = express.Router();
const {
    getLocations,
    createLocation,
    updateLocation,
    deleteLocation
} = require('../controllers/locationController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', getLocations);
router.post('/', requireAdmin, createLocation);
router.put('/:id', requireAdmin, updateLocation);
router.delete('/:id', requireAdmin, deleteLocation);

module.exports = router;
