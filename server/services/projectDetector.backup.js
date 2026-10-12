const DESKTOP_PATTERNS = [
  { pattern: /cv2\s*\.\s*VideoCapture/, label: 'OpenCV webcam capture (cv2.VideoCapture)' },
  { pattern: /^\s*import\s+cv2|^\s*from\s+cv2\s+import/m, label: 'OpenCV (cv2)' },
  { pattern: /^\s*import\s+tkinter|^\s*from\s+tkinter\s+import|Tk\s*\(\s*\)/m, label: 'Tkinter GUI toolkit' },
  { pattern: /^\s*(?:import|from)\s+(?:PyQt5|PyQt6|PySide2|PySide6)/m, label: 'PyQt / PySide desktop GUI' },
  { pattern: /^\s*import\s+pygame|^\s*from\s+pygame\s+import/m, label: 'pygame' },
  { pattern: /^\s*(?:import|from)\s+mediapipe/m, label: 'MediaPipe' },
  { pattern: /^\s*(?:import|from)\s+kivy/m, label: 'Kivy desktop GUI' },
  { pattern: /pyautogui|win32api|pywin32/, label: 'desktop automation libraries' },
];

const DESKTOP_REQUIREMENTS = [
  { pattern: /^opencv[-_]python/im, label: 'opencv-python' },
  { pattern: /^mediapipe/im, label: 'mediapipe' },
  { pattern: /^pyqt5|^pyqt6|^pyside/im, label: 'PyQt / PySide' },
  { pattern: /^pygame/im, label: 'pygame' },
  { pattern: /^kivy/im, label: 'kivy' },
  { pattern: /^pyautogui/im, label: 'pyautogui' },
];

const PYTHON_WEB_FRAMEWORKS = [
  { pattern: /^(?:django|flask|fastapi|streamlit|gradio)/im, label: 'a Python web framework' },
];

function depth(path) {
  return path.split('/').length;
}

function shallowest(paths) {
  return paths.slice().sort((a, b) => depth(a) - depth(b) || a.length - b.length)[0];
}

function dirOf(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function unsupported(projectType, reason, extra = {}) {
  return { projectType, supported: false, platform: null, reason, ...extra };
}

function supported(projectType, extra = {}) {
  return { projectType, supported: true, platform: 'vercel', reason: null, ...extra };
}

/**
 * Detects the project type of a repository.
 *
 * @param {object} input
 * @param {string[]} input.files repository file paths (relative, POSIX separators)
 * @param {(path: string) => Promise<string|null>} input.readFile reads a file's text content
 * @returns {Promise<{projectType: string, supported: boolean, platform: string|null, reason: string|null}>}
 */
async function detectProject({ files, readFile }) {
  const list = Array.isArray(files) ? files : [];
  const read = typeof readFile === 'function' ? readFile : async () => null;
  const lower = list.map((f) => f.toLowerCase());
  const has = (predicate) => list.filter((f, i) => predicate(f, lower[i]));

  const inNodeModules = (f) => f.includes('node_modules/');
  const packageJsons = has((f) => f.endsWith('package.json') && !inNodeModules(f));

  if (packageJsons.length) {
    const pkgPath = shallowest(packageJsons);
    const rootDirectory = dirOf(pkgPath);
    const pkg = safeParseJson((await read(pkgPath)) || '') || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const scopedFiles = list.filter((f) => (rootDirectory ? f.startsWith(`${rootDirectory}/`) : true));
    const hasFile = (name) =>
      scopedFiles.some((f) => f.replace(`${rootDirectory ? `${rootDirectory}/` : ''}`, '') === name);

    const nextConfig = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs'].some(hasFile);
    if (nextConfig || deps.next) {
      return supported('nextjs', {
        framework: 'Next.js',
        rootDirectory,
        packageName: pkg.name || null,
      });
    }

    const viteConfig = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs'].some(hasFile);
    if (viteConfig || deps.vite) {
      const isReact = Boolean(deps.react);
      return supported(isReact ? 'react-vite' : 'vite', {
        framework: isReact ? 'React + Vite' : 'Vite',
        rootDirectory,
        packageName: pkg.name || null,
        buildCommand: pkg.scripts?.build ? 'npm run build' : null,
        outputDirectory: 'dist',
      });
    }

    if (deps['react-scripts']) {
      return unsupported(
        'create-react-app',
        'Create React App projects are not supported yet. Supported project types are React + Vite, Next.js and static HTML/CSS/JS websites.',
        { framework: 'Create React App', rootDirectory }
      );
    }

    const serverDeps = ['express', 'koa', 'fastify', '@nestjs/core'].filter((d) => deps[d]);
    if (serverDeps.length) {
      return unsupported(
        'node-server',
        `This looks like a long-running Node.js server (${serverDeps.join(', ')}), which cannot be deployed as a static website in this version.`,
        { rootDirectory }
      );
    }

    const indexHtml = has((f) => f.endsWith('index.html') && !inNodeModules(f));
    if (indexHtml.length) {
      return supported('static', {
        framework: 'Static website',
        rootDirectory: dirOf(shallowest(indexHtml)),
      });
    }

    return unsupported(
      'node-other',
      'A package.json was found, but no supported web framework (React + Vite, Next.js) or static entry point was detected.',
      { rootDirectory }
    );
  }

  const pythonFiles = has((f) => f.endsWith('.py') && !f.includes('site-packages/'));
  const requirementFiles = has(
    (f, l) => l.endsWith('requirements.txt') || l.endsWith('pipfile') || l.endsWith('pyproject.toml')
  );

  if (pythonFiles.length || requirementFiles.length) {
    const requirementsText = (
      await Promise.all(requirementFiles.slice(0, 3).map((f) => read(f)))
    )
      .filter(Boolean)
      .join('\n');

    const requirementHit = DESKTOP_REQUIREMENTS.find((r) => r.pattern.test(requirementsText));
    const sources = await Promise.all(pythonFiles.slice(0, 15).map((f) => read(f)));
    const sourceText = sources.filter(Boolean).join('\n');
    const sourceHit = DESKTOP_PATTERNS.find((p) => p.pattern.test(sourceText));

    if (requirementHit || sourceHit) {
      const evidence = sourceHit?.label || requirementHit?.label;
      return unsupported(
        'python-desktop',
        `This project appears to be a desktop application (detected ${evidence}) and cannot be directly deployed as a web application.`,
        { evidence }
      );
    }

    const webHit = PYTHON_WEB_FRAMEWORKS.find((p) => p.pattern.test(requirementsText));
    return unsupported(
      'python',
      webHit
        ? 'Python web applications need a server runtime and are not supported yet. Supported project types are React + Vite, Next.js and static HTML/CSS/JS websites.'
        : 'This is a Python project. Only React + Vite, Next.js and static HTML/CSS/JS websites can be deployed in this version.'
    );
  }

  const indexHtml = has((f) => f.endsWith('index.html') && !inNodeModules(f));
  if (indexHtml.length) {
    return supported('static', {
      framework: 'Static website',
      rootDirectory: dirOf(shallowest(indexHtml)),
    });
  }

  return unsupported(
    'unknown',
    'The project type could not be determined. No package.json, index.html or recognizable web project files were found.'
  );
}

module.exports = { detectProject };
