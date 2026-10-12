const axios = require('axios');

const GITHUB_API = 'https://api.github.com';

class AppError extends Error {
  constructor(message, code = 'error') {
    super(message);
    this.code = code;
  }
}

function parseRepoUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new AppError('Please provide a GitHub repository URL.', 'invalid_url');
  }
  const url = rawUrl.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const match = url.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-_.]+)\/([A-Za-z0-9-_.]+)(?:\/(?:tree|blob)\/([A-Za-z0-9-_./]+))?$/
  );
  if (!match) {
    throw new AppError(
      'Invalid GitHub repository URL. Expected format: https://github.com/username/project',
      'invalid_url'
    );
  }
  const [, owner, repo, branch] = match;
  return { owner, repo, branch: branch || null, normalizedUrl: `https://github.com/${owner}/${repo}` };
}

function client(token) {
  return axios.create({
    baseURL: GITHUB_API,
    timeout: 20000,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'auto-project-deployer',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function translateGithubError(error, owner, repo) {
  const status = error.response?.status;
  if (status === 404) {
    return new AppError(
      `Repository ${owner}/${repo} was not found. It may not exist, or it may be private and not accessible with your GitHub account.`,
      'repo_not_found'
    );
  }
  if (status === 403) {
    return new AppError(
      'GitHub API rate limit reached or access forbidden. Try again later or sign in with GitHub.',
      'github_forbidden'
    );
  }
  if (status === 401) {
    return new AppError('GitHub rejected the credentials used for this request.', 'github_unauthorized');
  }
  if (error.code === 'ECONNABORTED' || !error.response) {
    return new AppError('Could not reach the GitHub API (network error).', 'network_error');
  }
  return new AppError(`GitHub API error (${status}): ${error.response?.data?.message || error.message}`, 'github_error');
}

async function getRepository(owner, repo, token) {
  try {
    const { data } = await client(token).get(`/repos/${owner}/${repo}`);
    return data;
  } catch (error) {
    throw translateGithubError(error, owner, repo);
  }
}

async function getTree(owner, repo, branch, token) {
  try {
    const { data } = await client(token).get(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}`,
      { params: { recursive: 1 } }
    );
    return {
      files: (data.tree || []).filter((node) => node.type === 'blob').map((node) => node.path),
      truncated: Boolean(data.truncated),
    };
  } catch (error) {
    throw translateGithubError(error, owner, repo);
  }
}

async function getFileContent(owner, repo, path, branch, token) {
  try {
    const { data } = await client(token).get(`/repos/${owner}/${repo}/contents/${path}`, {
      params: { ref: branch },
    });
    if (!data.content) return null;
    return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw translateGithubError(error, owner, repo);
  }
}

module.exports = {
  AppError,
  parseRepoUrl,
  getRepository,
  getTree,
  getFileContent,
};
