'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const promClient = require('prom-client');
const { body, param, query, validationResult } = require('express-validator');
const winston = require('winston');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-secret-change-before-deployment';
const ADMIN_USER = process.env.CRM_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.CRM_ADMIN_PASSWORD || 'Admin123!';

if (NODE_ENV === 'production' && (JWT_SECRET.length < 32 || JWT_SECRET.includes('change-before') || JWT_SECRET.startsWith('replace-'))) {
  throw new Error('JWT_SECRET phai la chuoi ngau nhien it nhat 32 ky tu khi chay production.');
}
if (NODE_ENV === 'production' && ADMIN_PASSWORD === 'Admin123!') {
  throw new Error('Hay doi CRM_ADMIN_PASSWORD truoc khi chay production.');
}

const logDirectory = path.join(__dirname, 'logs');
fs.mkdirSync(logDirectory, { recursive: true });
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'crm-backend' },
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: path.join(logDirectory, 'app.log'), maxsize: 5 * 1024 * 1024, maxFiles: 3 })]
});

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'crmdb',
  user: process.env.PGUSER || 'crmuser',
  password: process.env.PGPASSWORD || 'ChangeThis_DB_Password_2026',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : false
});

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
const httpRequests = new promClient.Counter({
  name: 'crm_http_requests_total',
  help: 'Tong so HTTP request theo method, route va status code',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});
const httpDuration = new promClient.Histogram({
  name: 'crm_http_request_duration_seconds',
  help: 'Thoi gian xu ly HTTP request (giay)',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      ...(NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {})
    }
  }
}));
app.use(express.json({ limit: '100kb', strict: true }));
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route && req.route.path ? `${req.baseUrl || ''}${req.route.path}` : req.path;
    httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
    httpDuration.observe({ method: req.method, route }, duration);
    if (req.path !== '/metrics') {
      logger.info('http_request', { method: req.method, path: req.path, status: res.statusCode, duration_ms: Math.round(duration * 1000), ip: req.ip });
    }
  });
  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Qua nhieu lan dang nhap. Vui long thu lai sau 15 phut.' }
});
const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Ban can dang nhap de tiep tuc.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { issuer: 'crm-customer-care' });
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Phien dang nhap khong hop le hoac da het han.' });
  }
}
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Du lieu nhap chua hop le.', details: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  next();
}
function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', service: 'crm-backend', database: 'connected' });
}));
app.post('/api/auth/login', loginLimiter, [
  body('username').isString().trim().notEmpty().withMessage('Vui long nhap ten dang nhap.'),
  body('password').isString().notEmpty().withMessage('Vui long nhap mat khau.')
], validate, (req, res) => {
  if (!safeEqual(req.body.username, ADMIN_USER) || !safeEqual(req.body.password, ADMIN_PASSWORD)) {
    logger.warn('login_failed', { username: String(req.body.username).slice(0, 80), ip: req.ip });
    return res.status(401).json({ error: 'Ten dang nhap hoac mat khau khong dung.' });
  }
  const token = jwt.sign({ sub: ADMIN_USER, role: 'admin' }, JWT_SECRET, { expiresIn: '4h', issuer: 'crm-customer-care' });
  logger.info('login_success', { username: ADMIN_USER, ip: req.ip });
  res.json({ token, expiresIn: 14400, username: ADMIN_USER });
});
if (NODE_ENV === 'test') {
  app.get('/__test__/http-500', (_req, _res, next) => next(new Error('Simulated HTTP 500 for observability testing')));
}
app.get('/metrics', asyncRoute(async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}));

app.use('/api', auth);
app.use('/api', writeLimiter);

// Customers
app.get('/api/customers', [query('q').optional().isString().trim().isLength({ max: 160 })], validate, asyncRoute(async (req, res) => {
  const q = (req.query.q || '').trim();
  const result = await pool.query(
    `SELECT c.*, (SELECT COUNT(*) FROM contacts ct WHERE ct.customer_id = c.id)::int AS contact_count,
      (SELECT COUNT(*) FROM interactions i WHERE i.customer_id = c.id)::int AS interaction_count
     FROM customers c
     WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR COALESCE(c.company, '') ILIKE '%' || $1 || '%' OR COALESCE(c.email, '') ILIKE '%' || $1 || '%')
     ORDER BY c.updated_at DESC, c.id DESC LIMIT 500`, [q]);
  res.json(result.rows);
}));
app.get('/api/customers/:id', [param('id').isInt({ min: 1 })], validate, asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Khong tim thay khach hang.' });
  res.json(result.rows[0]);
}));
app.post('/api/customers', [
  body('name').isString().trim().notEmpty().isLength({ max: 160 }),
  body('company').optional({ nullable: true }).isString().trim().isLength({ max: 180 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
  body('status').optional().isIn(['lead', 'active', 'inactive']),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 5000 })
], validate, asyncRoute(async (req, res) => {
  const { name, company = null, email = null, phone = null, status = 'lead', notes = null } = req.body;
  const result = await pool.query('INSERT INTO customers(name, company, email, phone, status, notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [name.trim(), company, email, phone, status, notes]);
  res.status(201).json(result.rows[0]);
}));
app.put('/api/customers/:id', [
  param('id').isInt({ min: 1 }),
  body('name').isString().trim().notEmpty().isLength({ max: 160 }),
  body('company').optional({ nullable: true }).isString().trim().isLength({ max: 180 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
  body('status').isIn(['lead', 'active', 'inactive']),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 5000 })
], validate, asyncRoute(async (req, res) => {
  const { name, company = null, email = null, phone = null, status, notes = null } = req.body;
  const result = await pool.query('UPDATE customers SET name=$1, company=$2, email=$3, phone=$4, status=$5, notes=$6, updated_at=NOW() WHERE id=$7 RETURNING *', [name.trim(), company, email, phone, status, notes, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Khong tim thay khach hang.' });
  res.json(result.rows[0]);
}));
app.delete('/api/customers/:id', [param('id').isInt({ min: 1 })], validate, asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM customers WHERE id=$1 RETURNING id', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Khong tim thay khach hang.' });
  res.status(204).end();
}));

// Contacts
app.get('/api/contacts', [query('customerId').optional().isInt({ min: 1 })], validate, asyncRoute(async (req, res) => {
  const customerId = req.query.customerId || null;
  const result = await pool.query(`SELECT ct.*, c.name AS customer_name FROM contacts ct JOIN customers c ON c.id=ct.customer_id WHERE ($1::bigint IS NULL OR ct.customer_id=$1) ORDER BY ct.created_at DESC LIMIT 1000`, [customerId]);
  res.json(result.rows);
}));
app.post('/api/contacts', [
  body('customerId').isInt({ min: 1 }), body('name').isString().trim().notEmpty().isLength({ max: 160 }),
  body('role').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 })
], validate, asyncRoute(async (req, res) => {
  const { customerId, name, role = null, email = null, phone = null } = req.body;
  const customer = await pool.query('SELECT id FROM customers WHERE id=$1', [customerId]);
  if (!customer.rowCount) return res.status(400).json({ error: 'Khach hang khong ton tai.' });
  const result = await pool.query('INSERT INTO contacts(customer_id,name,role,email,phone) VALUES($1,$2,$3,$4,$5) RETURNING *', [customerId, name.trim(), role, email, phone]);
  res.status(201).json(result.rows[0]);
}));
app.put('/api/contacts/:id', [
  param('id').isInt({ min: 1 }), body('customerId').isInt({ min: 1 }), body('name').isString().trim().notEmpty().isLength({ max: 160 }),
  body('role').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 })
], validate, asyncRoute(async (req, res) => {
  const { customerId, name, role = null, email = null, phone = null } = req.body;
  const customer = await pool.query('SELECT id FROM customers WHERE id=$1', [customerId]);
  if (!customer.rowCount) return res.status(400).json({ error: 'Khach hang khong ton tai.' });
  const current = await pool.query('SELECT id, customer_id FROM contacts WHERE id=$1', [req.params.id]);
  if (!current.rowCount) return res.status(404).json({ error: 'Khong tim thay lien he.' });
  if (String(current.rows[0].customer_id) !== String(customerId)) {
    const history = await pool.query('SELECT 1 FROM interactions WHERE contact_id=$1 LIMIT 1', [req.params.id]);
    if (history.rowCount) return res.status(400).json({ error: 'Lien he da co lich su tuong tac nen khong the chuyen sang khach hang khac. Hay tao lien he moi.' });
  }
  const result = await pool.query('UPDATE contacts SET customer_id=$1,name=$2,role=$3,email=$4,phone=$5,updated_at=NOW() WHERE id=$6 RETURNING *', [customerId, name.trim(), role, email, phone, req.params.id]);
  res.json(result.rows[0]);
}));
app.delete('/api/contacts/:id', [param('id').isInt({ min: 1 })], validate, asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM contacts WHERE id=$1 RETURNING id', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Khong tim thay lien he.' });
  res.status(204).end();
}));

// Interaction history
app.get('/api/interactions', [query('customerId').optional().isInt({ min: 1 })], validate, asyncRoute(async (req, res) => {
  const customerId = req.query.customerId || null;
  const result = await pool.query(`SELECT i.*, c.name AS customer_name, ct.name AS contact_name FROM interactions i JOIN customers c ON c.id=i.customer_id LEFT JOIN contacts ct ON ct.id=i.contact_id WHERE ($1::bigint IS NULL OR i.customer_id=$1) ORDER BY i.occurred_at DESC LIMIT 1000`, [customerId]);
  res.json(result.rows);
}));
app.post('/api/interactions', [
  body('customerId').isInt({ min: 1 }), body('contactId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('type').isIn(['call', 'email', 'meeting', 'note']), body('summary').isString().trim().notEmpty().isLength({ max: 500 }),
  body('details').optional({ nullable: true }).isString().isLength({ max: 10000 }),
  body('occurredAt').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate()
], validate, asyncRoute(async (req, res) => {
  const { customerId, contactId = null, type, summary, details = null, occurredAt = new Date() } = req.body;
  const customer = await pool.query('SELECT id FROM customers WHERE id=$1', [customerId]);
  if (!customer.rowCount) return res.status(400).json({ error: 'Khach hang khong ton tai.' });
  if (contactId) {
    const contact = await pool.query('SELECT id FROM contacts WHERE id=$1 AND customer_id=$2', [contactId, customerId]);
    if (!contact.rowCount) return res.status(400).json({ error: 'Lien he khong thuoc khach hang da chon.' });
  }
  const result = await pool.query('INSERT INTO interactions(customer_id,contact_id,type,summary,details,occurred_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [customerId, contactId || null, type, summary.trim(), details, occurredAt]);
  res.status(201).json(result.rows[0]);
}));
app.put('/api/interactions/:id', [
  param('id').isInt({ min: 1 }), body('customerId').isInt({ min: 1 }),
  body('contactId').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
  body('type').isIn(['call', 'email', 'meeting', 'note']), body('summary').isString().trim().notEmpty().isLength({ max: 500 }),
  body('details').optional({ nullable: true }).isString().isLength({ max: 10000 }),
  body('occurredAt').optional({ nullable: true, checkFalsy: true }).isISO8601().toDate()
], validate, asyncRoute(async (req, res) => {
  const { customerId, contactId = null, type, summary, details = null, occurredAt = new Date() } = req.body;
  const customer = await pool.query('SELECT id FROM customers WHERE id=$1', [customerId]);
  if (!customer.rowCount) return res.status(400).json({ error: 'Khach hang khong ton tai.' });
  if (contactId) {
    const contact = await pool.query('SELECT id FROM contacts WHERE id=$1 AND customer_id=$2', [contactId, customerId]);
    if (!contact.rowCount) return res.status(400).json({ error: 'Lien he khong thuoc khach hang da chon.' });
  }
  const result = await pool.query('UPDATE interactions SET customer_id=$1,contact_id=$2,type=$3,summary=$4,details=$5,occurred_at=$6 WHERE id=$7 RETURNING *', [customerId, contactId || null, type, summary.trim(), details, occurredAt, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Khong tim thay lich su tuong tac.' });
  res.json(result.rows[0]);
}));
app.delete('/api/interactions/:id', [param('id').isInt({ min: 1 })], validate, asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM interactions WHERE id=$1 RETURNING id', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Khong tim thay lich su tuong tac.' });
  res.status(204).end();
}));

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: NODE_ENV === 'production' ? '1h' : 0 }));
app.use((req, res) => res.status(404).json({ error: 'Khong tim thay tai nguyen.' }));
app.use((err, req, res, _next) => {
  logger.error('request_error', { message: err.message, path: req.path, method: req.method, stack: NODE_ENV === 'development' ? err.stack : undefined });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Co loi he thong. Vui long thu lai sau.' });
});

const server = app.listen(PORT, '0.0.0.0', () => logger.info('server_started', { port: PORT, node_env: NODE_ENV }));
async function shutdown(signal) {
  logger.info('shutdown_started', { signal });
  server.close(async () => {
    try { await pool.end(); } catch (err) { logger.error('pool_shutdown_error', { message: err.message }); }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
