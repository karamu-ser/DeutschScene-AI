const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, run } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Hash password
async function hashPassword(password) {
  return bcryptjs.hash(password, 10);
}

// Verify password
async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}

// Create JWT token
function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Register user
async function registerUser(email, password, name) {
  // Check if user exists
  const existing = query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new Error('User already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Insert user
  const result = run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [email, passwordHash, name || '']
  );

  return { userId: result.lastInsertRowid, email, name };
}

// Login user
async function loginUser(email, password) {
  const users = query('SELECT id, email, password_hash, name FROM users WHERE email = ?', [email]);
  if (users.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = users[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const token = createToken(user.id);
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

// Get user by ID
function getUserById(userId) {
  const users = query('SELECT id, email, name, created_at FROM users WHERE id = ?', [userId]);
  return users[0] || null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserById,
};
