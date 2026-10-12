const crypto = require('crypto');
const axios = require('axios');
const { env } = require('../config/env');
const { AppError } = require('./githubService');

const VERCEL_API = 'https://api.vercel.com';

const FRAMEWORK_BY_PROJECT_TYPE = {
  'react-vite': 'vite',
  vite: 'vite',
  nextjs: 'nextjs',
  static: null,
};

function client() {
  if (!env.vercel.token) {
    throw new AppError('VERCEL_TOKEN is not configured on the server.', 'vercel_not_configured');
  }
  return axios.create({
    baseURL: VERCEL_API,
    timeout: 60000,
    headers: { Authorization: `Bearer ${env.vercel.token}` },
    params: env.vercel.teamId ? { teamId: env.vercel.teamId } : undefined,
  });
}

function vercelError(error, fallback) {
  const payload = error.response?.data?.error;
  const message = payload?.message || error.response?.data?.message || error.message || fallback;
  return new AppError(`Vercel API error: ${message}`, 'vercel_error');
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

function sanitizeProjectName(name) {
  const slug = String(name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return slug || 'project';
}

async function uploadFile(buffer) {
  const digest = sha1(buffer);
  try {
    await client().post('/v2/files', buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'x-vercel-digest': digest,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (error) {
    throw vercelError(error, 'file upload failed');
  }
  return { sha: digest, size: buffer.length };
}

/**
 * Uploads the given files and creates a production deployment.
 *
 * @param {object} params
 * @param {string} params.name project name (slugified)
 * @param {{path: string, data: Buffer}[]} params.files
 * @param {string} params.projectType
 * @param {string} [params.rootDirectory]
 * @param {(uploaded: number, total: number) => void} [params.onProgress]
 */
async function createDeployment({ name, files, projectType, rootDirectory, onProgress }) {
  const uploaded = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const { sha, size } = await uploadFile(file.data);
    uploaded.push({ file: file.path, sha, size });
    if (onProgress) onProgress(i + 1, files.length);
  }

  const framework = FRAMEWORK_BY_PROJECT_TYPE[projectType] ?? null;
  const projectSettings = { framework };
  if (rootDirectory) projectSettings.rootDirectory = rootDirectory;
  if (projectType === 'static') {
    projectSettings.buildCommand = null;
    projectSettings.outputDirectory = null;
    projectSettings.installCommand = null;
  }

  try {
    const { data } = await client().post('/v13/deployments', {
      name: sanitizeProjectName(name),
      files: uploaded,
      target: 'production',
      projectSettings,
    });
    return {
      id: data.id,
      url: data.url ? `https://${data.url}` : '',
      readyState: data.readyState || data.status || 'QUEUED',
      inspectorUrl: data.inspectorUrl || '',
      alias: (data.alias || []).map((a) => `https://${a}`),
    };
  } catch (error) {
    throw vercelError(error, 'deployment creation failed');
  }
}

async function getDeployment(id) {
  try {
    const { data } = await client().get(`/v13/deployments/${id}`);
    return {
      id: data.id,
      readyState: data.readyState || data.status,
      url: data.url ? `https://${data.url}` : '',
      alias: (data.alias || []).map((a) => `https://${a}`),
      errorMessage: data.errorMessage || data.error?.message || '',
    };
  } catch (error) {
    throw vercelError(error, 'could not read deployment status');
  }
}

/**
 * Polls a deployment until it reaches a terminal state.
 * @returns {Promise<{readyState: string, url: string, alias: string[], errorMessage: string}>}
 */

async function pollDeployment(
  id,
  {
    timeoutMs = 10 * 60 * 1000,
    intervalMs = 4000,
    onState,
  } = {}
) {
  const startedAt = Date.now();
  let lastState = '';

  for (; ;) {
    const deployment = await getDeployment(id);

    if (deployment.readyState !== lastState) {
      lastState = deployment.readyState;

      if (onState) {
        await onState(deployment);
      }
    }

    if (['READY', 'ERROR', 'CANCELED'].includes(deployment.readyState)) {
      return deployment;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new AppError(
        `Deployment timed out after ${Math.round(timeoutMs / 60000)} minutes (last state: ${deployment.readyState}).`,
        'deployment_timeout'
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, intervalMs)
    );
  }
}


/**
 * Verifies that the deployed website actually responds successfully.
 */
async function verifyDeploymentUrl(url, { attempts = 6, delayMs = 5000 } = {}) {
  let lastStatus = 0;
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await axios.get(url, {
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': 'auto-project-deployer-verifier' },
      });
      lastStatus = response.status;
      if (response.status >= 200 && response.status < 400) {
        return { ok: true, status: response.status };
      }
    } catch (error) {
      lastError = error.message;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return { ok: false, status: lastStatus, error: lastError };
}

module.exports = {
  createDeployment,
  getDeployment,
  pollDeployment,
  verifyDeploymentUrl,
  sanitizeProjectName,
};
