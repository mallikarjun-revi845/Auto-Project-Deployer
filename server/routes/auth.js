const express = require('express');
const { passport } = require('../config/passport');
const { requireAuth, signToken } = require('../middleware/auth');
const { env } = require('../config/env');

const router = express.Router();

router.get('/github', passport.authenticate('github', { session: false, scope: ['read:user', 'user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${env.clientUrl}/login?error=github_auth_failed` }),
  (req, res) => {
    const token = signToken(req.user);
    res.redirect(`${env.clientUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  }
);

router.get('/me', requireAuth, (req, res) => {
  const { _id, username, displayName, email, avatarUrl, profileUrl } = req.user;
  res.json({ user: { id: _id, username, displayName, email, avatarUrl, profileUrl } });
});

router.post('/logout', requireAuth, (_req, res) => {
  // Tokens are stateless; the client discards it. Endpoint kept for symmetry/auditing.
  res.json({ ok: true });
});

module.exports = router;
