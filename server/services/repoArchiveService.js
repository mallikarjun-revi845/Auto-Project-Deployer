const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const stream = require('stream');
const { promisify } = require('util');
const axios = require('axios');
const tar = require('tar');
const { AppError } = require('./githubService');

const pipeline = promisify(stream.pipeline);

const IGNORED_DIRS = new Set(['node_modules', '.git', '.github', '.next', '.vercel', '__pycache__', '.venv', 'venv']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 3000;

async function walk(dir, base = '', out = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walk(abs, rel, out);
    } else if (entry.isFile()) {
      out.push({ absolutePath: abs, path: rel });
    }
  }
  return out;
}

/**
 * Downloads a repository tarball and extracts it into a temporary directory.
 * Returns the extracted root plus the list of relative file paths.
 */
async function downloadRepository(owner, repo, ref, token) {
  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'apd-'));
  const tarballPath = path.join(tmpRoot, 'repo.tar.gz');
  const extractDir = path.join(tmpRoot, 'src');
  await fsp.mkdir(extractDir);

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`,
      {
        responseType: 'stream',
        timeout: 120000,
        headers: {
          'User-Agent': 'auto-project-deployer',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );
    await pipeline(response.data, fs.createWriteStream(tarballPath));
  } catch (error) {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
    throw new AppError(
      `Could not download the repository archive from GitHub: ${error.response?.status || error.message}`,
      'github_download_failed'
    );
  }

  // GitHub tarballs are wrapped in a single "<owner>-<repo>-<sha>" directory.
  await tar.x({ file: tarballPath, cwd: extractDir, strip: 1 });
  await fsp.rm(tarballPath, { force: true });

  const files = await walk(extractDir);
  if (files.length > MAX_FILES) {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
    throw new AppError(
      `Repository contains ${files.length} files, which exceeds the ${MAX_FILES} file upload limit.`,
      'repo_too_large'
    );
  }

  return {
    tmpRoot,
    extractDir,
    files,
    cleanup: () => fsp.rm(tmpRoot, { recursive: true, force: true }),
  };
}

async function readFileIfSmall(absolutePath) {
  const stat = await fsp.stat(absolutePath);
  if (stat.size > MAX_FILE_BYTES) {
    throw new AppError(`File larger than ${MAX_FILE_BYTES} bytes cannot be uploaded: ${absolutePath}`, 'file_too_large');
  }
  return fsp.readFile(absolutePath);
}

module.exports = { downloadRepository, readFileIfSmall, MAX_FILE_BYTES };
