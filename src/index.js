require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const expenseHeadRoutes = require('./routes/expenseHeads');
const settlementRoutes = require('./routes/settlements');
const pettyCashRoutes = require('./routes/pettyCash');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const budgetRoutes = require('./routes/budgets');
const exportRoutes = require('./routes/export');
const auditLogRoutes = require('./routes/auditLog');
const attachmentRoutes = require('./routes/attachments');
const collectionRoutes = require('./routes/collections');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json());

// Basic security headers (CSP mitigates stored-XSS blast radius)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https://res.cloudinary.com; font-src 'self' https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Uploaded files (receipts, screenshots) are stored on Cloudinary, not on
// local disk — Render's web services use ephemeral disk, so anything written
// locally would be lost on every restart/redeploy.
app.use(express.static(path.join(__dirname, '..', 'client')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/expense-heads', expenseHeadRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/collections', collectionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
