const Deployment = require('../models/Deployment');
const github = require('../services/githubService');
const { detectProject } = require('../services/projectDetector');
const vercel = require('../services/vercelService');
const backend = require('../services/backendService');
const docker = require('../services/dockerService');
const { downloadRepository, readFileIfSmall } = require('../services/repoArchiveService');
const { emitToUser } = require('../config/socket');
const { AppError } = require('../services/githubService');

function serialize(deployment) {
  return {
    id: String(deployment._id),
    repoUrl: deployment.repoUrl,
    projectName: deployment.projectName,
    projectType: deployment.projectType,
    platform: deployment.platform,
    status: deployment.status,
    liveUrl: deployment.liveUrl,
    vercelDeploymentId: deployment.vercelDeploymentId,
    errorMessage: deployment.errorMessage,
    deployDate: deployment.deployDate,
    logs: deployment.logs,
  };
}

async function progress(deployment, step, message, extra = {}) {
  deployment.status = step;
  deployment.logs.push({ step, message, at: new Date() });
  Object.assign(deployment, extra);
  await deployment.save();
  emitToUser(String(deployment.userId), step, {
    deploymentId: String(deployment._id),
    step,
    message,
    deployment: serialize(deployment),
  });
  emitToUser(String(deployment.userId), 'deployment:update', {
    deploymentId: String(deployment._id),
    step,
    message,
    deployment: serialize(deployment),
  });
}


async function fail(deployment, message, step = 'failed') {
  try {
    deployment.status = step;
    deployment.errorMessage = message;
    deployment.logs.push({
      step,
      message,
      at: new Date(),
    });

    await deployment.save();

    const payload = {
      deploymentId: String(deployment._id),
      step,
      message,
      deployment: serialize(deployment),
    };

    emitToUser(String(deployment.userId), 'failed', payload);
    emitToUser(String(deployment.userId), 'deployment:update', payload);
  } catch (error) {
    console.error(
      'Failed to save deployment failure status:',
      error.message
    );
  }
}

async function runDeployment(deployment, user) {
  const githubToken = user.accessToken || undefined;
  let archive = null;

  try {
    await progress(deployment, 'validating', 'Validating repository…');
    const { owner, repo } = github.parseRepoUrl(deployment.repoUrl);
    const repository = await github.getRepository(owner, repo, githubToken);
    if (repository.private) {
      throw new AppError(
        'This repository is private. Only repositories your GitHub account can access are supported, and public repositories are recommended.',
        'private_repo',
      );
    }
    const branch = repository.default_branch;
    await progress(
      deployment,
      'validating',
      `Repository ${repository.full_name} found (branch: ${branch}).`,
    );

    await progress(
      deployment,
      'detecting',
      'Analyzing repository structure and detecting project type…',
    );
    const { files, truncated } = await github.getTree(owner, repo, branch, githubToken);
    if (!files.length) {
      throw new AppError('The repository appears to be empty.', 'empty_repo');
    }
    const detection = await detectProject({
      files,
      readFile: (path) => github.getFileContent(owner, repo, path, branch, githubToken),
    });
    deployment.projectType = detection.projectType;
    await progress(
      deployment,
      'detecting',
      `Detected project type: ${detection.framework || detection.projectType}${truncated ? ' (large repository, partial file listing)' : ''}.`,
    );

    await progress(deployment, 'checking', 'Checking deployment compatibility…');
    if (!detection.supported) {
      await fail(deployment, detection.reason, 'unsupported');
      return;
    }
    deployment.platform = detection.platform;
    await progress(
      deployment,
      'checking',
      `Supported project. Target platform: ${detection.platform}.`,
    );

    await progress(
      deployment,
      'cloning',
      'Preparing deployment — downloading repository source…',
    );
    archive = await downloadRepository(owner, repo, branch, githubToken);
    const payloadFiles = [];
    for (const file of archive.files) {
      payloadFiles.push({ path: file.path, data: await readFileIfSmall(file.absolutePath) });
    }
    await progress(deployment, 'cloning', `Prepared ${payloadFiles.length} files for upload.`);

    // Choose deployment strategy based on the detected platform.
    if (detection.platform === 'vercel') {
      await progress(
        deployment,
        'deploying',
        'Uploading project and creating Vercel deployment…',
      );

      const created = await vercel.createDeployment({
        name: deployment.projectName,
        files: payloadFiles,
        projectType: detection.projectType,
        rootDirectory: detection.rootDirectory || undefined,
      });

      deployment.vercelDeploymentId = created.id;

      await progress(deployment, 'deploying', `Vercel deployment created (${created.id}).`);

      await progress(deployment, 'building', 'Building project on Vercel…');


      const finalState = await vercel.pollDeployment(created.id, {
        onState: async (state) => {
          const message = `Vercel status: ${state.readyState}`;
          const step =
            state.readyState === 'BUILDING' ||
              state.readyState === 'INITIALIZING'
              ? 'building'
              : 'deploying';

          await progress(deployment, step, message);
        },
      });


      if (finalState.readyState === 'CANCELED') {
        throw new AppError('The Vercel deployment was canceled.', 'deployment_canceled');
      }

      if (finalState.readyState === 'ERROR') {
        throw new AppError(
          finalState.errorMessage ||
          'The Vercel build failed. Check the build logs in your Vercel dashboard.',
          'build_failed',
        );
      }

      const liveUrl = finalState.alias?.[0] || finalState.url || created.url;

      deployment.liveUrl = liveUrl;

      await progress(deployment, 'verifying', `Verifying that ${liveUrl} is reachable…`);

      const verification = await vercel.verifyDeploymentUrl(liveUrl);

      if (!verification.ok) {
        await fail(
          deployment,
          `Vercel reported the deployment as ready, but the generated website could not be accessed (${verification.status
            ? `HTTP ${verification.status}`
            : verification.error || 'no response'
          }).`,
        );
        return;
      }

      await progress(
        deployment,
        'live',
        `Deployment verified — the site responded with HTTP ${verification.status}.`,
        {
          liveUrl,
          deployDate: new Date(),
        },
      );

      return;
    }

    if (detection.platform === 'backend') {
      await progress(deployment, 'deploying', 'Creating backend service on Render…');

      const created = await backend.createDeployment({
        name: `${vercel.sanitizeProjectName(deployment.projectName)}-${String(deployment._id).slice(-6)}`,
        repoUrl: deployment.repoUrl,
        projectType: detection.projectType,
        branch,
        rootDirectory: detection.rootDirectory || undefined,
      });

      await progress(deployment, 'deploying', `Render service created (${created.id}).`);

      await progress(deployment, 'building', 'Building backend project on Render…');


      const finalState = await backend.pollDeployment(created.id, {
        onState: async (state) => {
          const message = `Render status: ${state.readyState}`;
          await progress(deployment, 'building', message);
        },
      });


      if (finalState.readyState === 'ERROR') {
        throw new AppError(
          finalState.errorMessage || 'The Render build failed.',
          'build_failed',
        );
      }

      const liveUrl = finalState.url;

      if (!liveUrl) {
        throw new AppError(
          'Render completed the deployment but did not provide a live URL.',
          'deployment_url_missing',
        );
      }

      deployment.liveUrl = liveUrl;

      await progress(deployment, 'verifying', `Verifying that ${liveUrl} is reachable…`);

      const verification = await backend.verifyDeploymentUrl(liveUrl);

      if (!verification.ok) {
        await fail(
          deployment,
          `Render created the service, but the deployed application could not be accessed (${verification.status
            ? `HTTP ${verification.status}`
            : verification.error || 'no response'
          }).`,
        );
        return;
      }

      await progress(
        deployment,
        'live',
        `Deployment verified — the backend responded with HTTP ${verification.status}.`,
        {
          liveUrl,
          deployDate: new Date(),
        },
      );

      return;
    }
    if (detection.platform === 'docker') {
      await progress(deployment, 'deploying', 'Preparing Docker deployment…');

      const created = await docker.createDeployment({
        name: deployment.projectName,
        files: payloadFiles,
      });

      await fail(
        deployment,
        created.message ||
        'Docker project detected, but no container hosting provider is configured yet.',
        'unsupported',
      );

      return;
    }

    await fail(
      deployment,
      `No deployment strategy is configured for platform "${detection.platform}".`,
      'unsupported',
    );
  } catch (error) {
    await fail(
      deployment,
      error instanceof AppError
        ? error.message
        : error.message || 'Unexpected deployment error.',
    );
  } finally {
    if (archive) await archive.cleanup().catch(() => { });
  }
}

async function createDeploymentRequest(req, res) {
  const { repoUrl, projectName } = req.body || {};
  let parsed;
  try {
    parsed = github.parseRepoUrl(repoUrl);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const deployment = await Deployment.create({
    userId: req.user._id,
    repoUrl: parsed.normalizedUrl,
    projectName: vercel.sanitizeProjectName(projectName || parsed.repo),
    status: 'queued',
    deployDate: new Date(),
  });

  res.status(202).json({ deployment: serialize(deployment) });
  runDeployment(deployment, req.user).catch((error) => {
    console.error('DEPLOYMENT ERROR:', error);
  });
  return undefined;
}

async function analyzeRepository(req, res) {
  try {
    const { owner, repo } = github.parseRepoUrl(req.body?.repoUrl);
    const repository = await github.getRepository(owner, repo, req.user.accessToken);
    const branch = repository.default_branch;
    const { files } = await github.getTree(owner, repo, branch, req.user.accessToken);
    const detection = await detectProject({
      files,
      readFile: (path) =>
        github.getFileContent(owner, repo, path, branch, req.user.accessToken),
    });
    return res.json({
      repository: { fullName: repository.full_name, branch, private: repository.private },
      detection,
    });
  } catch (error) {
    return res
      .status(error.code === 'repo_not_found' ? 404 : 400)
      .json({ error: error.message });
  }
}

async function listDeployments(req, res) {
  const deployments = await Deployment.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ deployments: deployments.map(serialize) });
}

async function getDeploymentById(req, res) {
  const deployment = await Deployment.findOne({ _id: req.params.id, userId: req.user._id });
  if (!deployment) return res.status(404).json({ error: 'Deployment not found.' });
  return res.json({ deployment: serialize(deployment) });
}

module.exports = {
  createDeploymentRequest,
  analyzeRepository,
  listDeployments,
  getDeploymentById,
  runDeployment,
  serialize,
};
