require('dotenv').config();

const env = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serverUrl: process.env.SERVER_URL || 'http://localhost:5000',
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ||
      `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/github/callback`,
  },
  vercel: {
    token: process.env.VERCEL_TOKEN || '',
    teamId: process.env.VERCEL_TEAM_ID || '',
  },
};

function assertRequiredEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (!env.github.clientId) missing.push('GITHUB_CLIENT_ID');
  if (!env.github.clientSecret) missing.push('GITHUB_CLIENT_SECRET');
  if (!env.vercel.token) missing.push('VERCEL_TOKEN');
  return missing;
}

module.exports = { env, assertRequiredEnv };
