const { AppError } = require('./githubService');

/**
 * Docker deployment service.
 *
 * This provides the deployment abstraction for Docker projects.
 * The actual container-host provider can be connected here later.
 */

async function createDeployment({ name, files }) {
  if (!files || !files.length) {
    throw new AppError(
      'No project files were prepared for Docker deployment.',
      'empty_deployment'
    );
  }

  return {
    id: null,
    name,
    platform: 'docker',
    state: 'READY_FOR_CONTAINER_HOST',
    url: null,
    message:
      'Docker project detected. A container hosting provider integration is required before this project can go live.',
  };
}

async function pollDeployment() {
  return {
    readyState: 'READY_FOR_CONTAINER_HOST',
  };
}

async function verifyDeploymentUrl() {
  return {
    ok: false,
    status: null,
    error: 'No Docker deployment URL is available yet.',
  };
}

module.exports = {
  createDeployment,
  pollDeployment,
  verifyDeploymentUrl,
};