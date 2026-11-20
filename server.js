const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { getDbPool, sql } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================
// Security Middleware
// =============================================

// CORS - restrict to allowed origins only
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.) in development
    if (!origin || process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Simple in-memory rate limiter for API protection
const rateLimitMap = new Map();
function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(key) || { count: 0, start: now };
    if (now - record.start > windowMs) {
      record.count = 1;
      record.start = now;
    } else {
      record.count++;
    }
    rateLimitMap.set(key, record);
    if (record.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
    next();
  };
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Health check - no sensitive info exposed
app.get('/api/health', rateLimit(60000, 30), async (req, res) => {
  try {
    const pool = await getDbPool();
    res.json({ status: 'success', message: 'KASHAFA Backend is running!' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Service temporarily unavailable' });
  }
});

// Simple admin auth middleware using env variable
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  
  // If no admin token is configured, skip auth check (backward compat for local dev)
  if (!adminToken) {
    console.warn('⚠️ WARNING: ADMIN_SECRET_TOKEN not set - admin routes are unprotected!');
    return next();
  }
  
  if (token && token === adminToken) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: valid admin token required' });
}

// Routes
const storeRoutes = require('./src/routes/storeRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const bcrypt = require('bcryptjs');

// Admin login endpoint - NOT behind requireAdminAuth (it IS the auth)
app.post('/api/admin/login', rateLimit(900000, 10), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      // Env not configured — refuse login for security
      return res.status(503).json({ error: 'Admin credentials not configured on server' });
    }

    if (email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, adminPasswordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = process.env.ADMIN_SECRET_TOKEN;
    return res.json({ status: 'success', token });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'An error occurred during login' });
  }
});

// Apply rate limiting to store (public) routes
app.use('/api/store', rateLimit(60000, 100), storeRoutes);

// Admin routes require auth + stricter rate limit
app.use('/api/admin', rateLimit(60000, 60), requireAdminAuth, adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler (don't leak stack traces in production)
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('Server error:', err.message);
  res.status(500).json({ 
    error: isDev ? err.message : 'An internal server error occurred'
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 KASHAFA Server is running on port ${PORT}`);
  try {
    await getDbPool();
    console.log('✅ Database connected successfully');
  } catch (err) {
    console.log('⚠️ Server started, but database connection failed. Check your config.');
  }
});