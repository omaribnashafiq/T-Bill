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
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
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
