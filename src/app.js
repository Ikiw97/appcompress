const express = require('express');
const cors = require('cors');
require('dotenv').config();

const convertRoutes = require('./routes/convertRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Routes
app.use('/', convertRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'FileZen Backend is running 🚀' });
});

// CloudConvert key status — cek key mana yang masih aktif / sudah kena limit
app.get('/api-keys', (req, res) => {
  try {
    const { getKeyStatus } = require('./services/cloudconvertService');
    res.json({
      cloudconvert: getKeyStatus(),
      tip: 'Akses endpoint ini untuk monitoring real-time status API key',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reset semua key (limit CloudConvert reset setiap hari)
app.post('/api-keys/reset', (req, res) => {
  try {
    const cloudconvert = require('./services/cloudconvertService');
    // Akses internal keyManager via module reload trick
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('cloudconvertService')) delete require.cache[key];
    });
    res.json({ message: 'CloudConvert key manager direset. Semua key aktif kembali.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
