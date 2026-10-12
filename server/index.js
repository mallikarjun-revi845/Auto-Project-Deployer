const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { env, assertRequiredEnv } = require('./config/env');
const { connectDatabase } = require('./config/db');
const { configurePassport } = require('./config/passport');
const { initSocket } = require('./config/socket');
const authRoutes = require('./routes/auth');
const deployRoutes = require('./routes/deploy');

function createApp() {
  const app = express();
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(configurePassport().initialize());

  app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/deploy', deployRoutes);

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  });

  return app;
}

async function start() {
  const missing = assertRequiredEnv();
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}. See server/.env.example.`);
    process.exit(1);
  }

  await connectDatabase();
  console.log('Connected to MongoDB');

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  });
}

module.exports = { createApp, start };
