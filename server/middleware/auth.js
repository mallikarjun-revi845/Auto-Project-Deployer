const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { env } = require('../config/env');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), username: user.username }, env.jwtSecret, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('+accessToken');
    if (!user) return res.status(401).json({ error: 'User no longer exists.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = { requireAuth, signToken, verifyToken };
