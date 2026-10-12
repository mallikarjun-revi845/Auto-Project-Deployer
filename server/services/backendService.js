const axios = require('axios');
const { AppError } = require('./githubService');

const RENDER_API = 'https://api.render.com/v1';

function getHeaders() {
  if (!process.env.RENDER_API_KEY) {
    throw new AppError(
      'RENDER_API_KEY is not configured.',
      'render_not_configured'
    );
  }

  return {
    Authorization: `Bearer ${process.env.RENDER_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function getRuntimeConfig(projectType) {
  if (projectType === 'node-server') {
    return {
      runtime: 'node',
      buildCommand: 'npm install',
      startCommand: 'npm start',
    };
  }

  if (projectType === 'python-web') {
    return {
      runtime: 'python',
      buildCommand: 'pip install -r requirements.txt',
      startCommand: 'gunicorn app:app',
    };
  }

  throw new AppError(
    `Unsupported backend project type: ${projectType}`,
    'unsupported_backend'
  );
}

async function createDeployment({
  name,
  projectType,
  repoUrl,
  branch = 'main',
  rootDirectory,
}) {
  const config = getRuntimeConfig(projectType);

  if (!process.env.RENDER_OWNER_ID) {
    throw new AppError(
      'RENDER_OWNER_ID is not configured.',
      'render_owner_not_configured'
    );
  }

  const body = {
    type: 'web_service',
    name,
    ownerId: process.env.RENDER_OWNER_ID,
    repo: repoUrl,
    branch,
    autoDeploy: 'yes',

    serviceDetails: {
      runtime: config.runtime,
      plan: 'free',

      envSpecificDetails: {
        buildCommand: config.buildCommand,
        startCommand: config.startCommand,
      },
    },
  };

  if (rootDirectory) {
    body.rootDir = rootDirectory;
  }

  console.log(
    'Creating Render service:',
    JSON.stringify(
      {
        type: body.type,
        name: body.name,
        ownerId: body.ownerId,
        repo: body.repo,
        branch: body.branch,
        runtime: config.runtime,
      },
      null,
      2
    )
  );

  try {
    const response = await axios.post(
      `${RENDER_API}/services`,
      body,
      {
        headers: getHeaders(),
        timeout: 30000,
      }
    );

    /*
     * Render's create-service response wraps
     * the actual service inside `service`.
     */
    const service = response.data?.service || response.data;

    console.log('Render service created:', service.id);

    return {
      id: service.id,
      name: service.name,
      platform: 'render',

      state: service.suspended
        ? 'SUSPENDED'
        : 'CREATED',

      url:
        service.serviceDetails?.url ||
        service.url ||
        null,

      /*
       * Render's create-service response also
       * provides the initial deploy ID.
       */
      deployId:
        response.data?.deployId ||
        service.deployId ||
        null,

      message: 'Render backend service created successfully.',
    };
  } catch (error) {
    const status = error.response?.status;
    const details = error.response?.data;

    console.error(
      'Render API error:',
      JSON.stringify(
        details || error.message,
        null,
        2
      )
    );

    throw new AppError(
      `Render deployment failed${status ? ` (HTTP ${status})` : ''
      }: ${details?.message ||
      details?.error ||
      error.message ||
      'Unknown Render API error'
      }`,
      'render_deployment_failed'
    );
  }
}

async function getService(serviceId) {
  try {
    const response = await axios.get(
      `${RENDER_API}/services/${serviceId}`,
      {
        headers: getHeaders(),
        timeout: 30000,
      }
    );

    return response.data?.service || response.data;
  } catch (error) {
    const status = error.response?.status;
    const details = error.response?.data;

    throw new AppError(
      `Could not retrieve Render service${status ? ` (HTTP ${status})` : ''
      }: ${details?.message ||
      details?.error ||
      error.message
      }`,
      'render_service_error'
    );
  }
}

async function getLatestDeploy(serviceId) {
  const response = await axios.get(
    `${RENDER_API}/services/${serviceId}/deploys`,
    {
      headers: getHeaders(),
      params: {
        limit: 1,
      },
      timeout: 30000,
    }
  );

  /*
   * IMPORTANT:
   * Render returns an array:
   *
   * [
   *   {
   *     deploy: {
   *       id: "...",
   *       status: "build_in_progress"
   *     },
   *     cursor: "..."
   *   }
   * ]
   */

  const items = Array.isArray(response.data)
    ? response.data
    : [];

  const latest = items[0];

  return latest?.deploy || null;
}

async function pollDeployment(
  serviceId,
  {
    intervalMs = 5000,
    timeoutMs = 15 * 60 * 1000,
    onState,
  } = {}
) {
  const started = Date.now();
  let lastState = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const latestDeploy =
        await getLatestDeploy(serviceId);

      if (!latestDeploy) {
        if (lastState !== 'queued') {
          lastState = 'queued';

          console.log(
            `Render service ${serviceId}: waiting for deployment...`
          );

          if (onState) {
            await onState({
              readyState: 'QUEUED',
              service: null,
            });
          }
        }

        await new Promise((resolve) =>
          setTimeout(resolve, intervalMs)
        );

        continue;
      }

      const status =
        latestDeploy.status || 'created';

      console.log(
        `Render deployment ${latestDeploy.id} status: ${status}`
      );

      /*
       * Convert Render's statuses into
       * easy-to-understand application states.
       */
      let applicationState = status.toUpperCase();

      if (
        status === 'created' ||
        status === 'queued'
      ) {
        applicationState = 'QUEUED';
      }

      if (
        status === 'build_in_progress' ||
        status === 'pre_deploy_in_progress' ||
        status === 'update_in_progress'
      ) {
        applicationState = 'BUILDING';
      }

      if (status === 'live') {
        applicationState = 'LIVE';
      }

      if (status !== lastState) {
        lastState = status;

        if (onState) {
          await onState({
            readyState: applicationState,
            renderStatus: status,
            service: latestDeploy,
          });
        }
      }

      /*
       * Render deployment failed.
       */
      const failedStatuses = [
        'build_failed',
        'update_failed',
        'pre_deploy_failed',
        'canceled',
        'deactivated',
      ];

      if (failedStatuses.includes(status)) {
        return {
          readyState: 'ERROR',

          errorMessage:
            latestDeploy.error ||
            latestDeploy.message ||
            `Render deployment failed with status: ${status}`,

          deployment: latestDeploy,
        };
      }

      /*
       * Render deployment is live.
       */
      if (status === 'live') {
        const service =
          await getService(serviceId);

        const url =
          service.serviceDetails?.url ||
          service.url ||
          null;

        if (!url) {
          return {
            readyState: 'ERROR',

            errorMessage:
              'Render deployment succeeded but no service URL was returned.',

            service,
            deployment: latestDeploy,
          };
        }

        return {
          readyState: 'READY',
          url,
          service,
          deployment: latestDeploy,
        };
      }

      /*
       * Still waiting for Render.
       */
      await new Promise((resolve) =>
        setTimeout(resolve, intervalMs)
      );
    } catch (error) {
      console.error(
        'Render polling error:',
        error.response?.data ||
        error.message
      );

      throw new AppError(
        `Could not check Render deployment status: ${error.response?.data?.message ||
        error.message
        }`,
        'render_deployment_status_error'
      );
    }
  }

  throw new AppError(
    'Timed out while waiting for the Render deployment.',
    'render_timeout'
  );
}

async function verifyDeploymentUrl(url) {
  if (!url) {
    return {
      ok: false,
      status: null,
      error: 'Render did not provide a deployment URL.',
    };
  }

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true,
    });

    return {
      ok:
        response.status >= 200 &&
        response.status < 300,

      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error.message,
    };
  }
}

module.exports = {
  getRuntimeConfig,
  createDeployment,
  getService,
  pollDeployment,
  verifyDeploymentUrl,
};