const express = require('express');
const router = express.Router();
const { register, createUser, login, getMe } = require('../controllers/authController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.post('/users', verifyToken, requireAdmin, createUser);

module.exports = router;
