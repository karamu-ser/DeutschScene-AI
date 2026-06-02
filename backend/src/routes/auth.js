const express = require('express');
const { registerUser, loginUser, getUserById } = require('../services/auth');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../services/logger');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await registerUser(email, password, name);
    const result = await loginUser(email, password);
    logger.info('User registered', { email });
    res.status(201).json({ message: 'User registered successfully', token: result.token, user: result.user });
  } catch (err) {
    logger.error('Registration error', { error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await loginUser(email, password);
    logger.info('User logged in', { email });
    res.json(result);
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/me (protected)
router.get('/me', authMiddleware, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

module.exports = router;
