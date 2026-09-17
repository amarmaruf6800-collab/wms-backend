require('dotenv').config();

const express = require('express');
const cors = require('cors');

const productRoutes = require('./routes/productRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const locationRoutes = require('./routes/locationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const returnRoutes = require("./routes/returnRoutes");

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL belum diatur di file .env');
}

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET belum diatur di file .env');
}

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Izinkan request non-browser seperti Postman/curl yang tidak mengirim Origin.
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origin tidak diizinkan oleh CORS.'));
    }
}));

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'WMS API is healthy.',
        data: {
            timestamp: new Date().toISOString()
        }
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/returns', returnRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`✅ Server WMS API berjalan di http://localhost:${PORT}`);
});
