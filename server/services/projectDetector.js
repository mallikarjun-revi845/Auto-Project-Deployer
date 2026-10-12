const DESKTOP_PATTERNS = [
  { pattern: /cv2\s*\.\s*VideoCapture/, label: 'OpenCV webcam capture (cv2.VideoCapture)' },
  { pattern: /^\s*import\s+cv2|^\s*from\s+cv2\s+import/m, label: 'OpenCV (cv2)' },
  {
    pattern: /^\s*import\s+tkinter|^\s*from\s+tkinter\s+import|Tk\s*\(\s*\)/m,
    label: 'Tkinter GUI toolkit',
  },
  {
    pattern: /^\s*(?:import|from)\s+(?:PyQt5|PyQt6|PySide2|PySide6)/m,
    label: 'PyQt / PySide desktop GUI',
  },
  {
    pattern: /^\s*import\s+pygame|^\s*from\s+pygame\s+import/m,
    label: 'pygame',
  },
  {
    pattern: /^\s*(?:import|from)\s+mediapipe/m,
    label: 'MediaPipe',
  },
  {
    pattern: /^\s*(?:import|from)\s+kivy/m,
    label: 'Kivy desktop GUI',
  },
  {
    pattern: /pyautogui|win32api|pywin32/,
    label: 'desktop automation libraries',
  },
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
  { pattern: /^(?:django)/im, label: 'Django' },
  { pattern: /^(?:flask)/im, label: 'Flask' },
  { pattern: /^(?:fastapi)/im, label: 'FastAPI' },
  { pattern: /^(?:streamlit)/im, label: 'Streamlit' },
  { pattern: /^(?:gradio)/im, label: 'Gradio' },
];

function depth(path) {
  return path.split('/').length;
}

function shallowest(paths) {
  return paths
    .slice()
    .sort((a, b) => depth(a) - depth(b) || a.length - b.length)[0];
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

/**
 * A project can be "supported" by the detector even when
 * the project cannot be deployed directly by Vercel.
 *
 * supported = our system knows how to handle the project.
 */
function supported(projectType, platform, extra = {}) {
  return {
    projectType,
    supported: true,
    platform,
    reason: null,
    ...extra,
  };
}

function unsupported(projectType, reason, extra = {}) {
  return {
    projectType,
    supported: false,
    platform: null,
    reason,
    ...extra,
  };
}

async function detectProject({ files, readFile }) {
  const list = Array.isArray(files) ? files : [];
  const read = typeof readFile === 'function' ? readFile : async () => null;

  const lower = list.map((f) => f.toLowerCase());

  const has = (predicate) =>
    list.filter((f, i) => predicate(f, lower[i]));

  const inNodeModules = (f) =>
    f.toLowerCase().includes('node_modules/');

  /*
   * ---------------------------------------------------------
   * DOCKER
   * ---------------------------------------------------------
   */

  const dockerFiles = has(
    (f, l) =>
      !inNodeModules(f) &&
      (
        l === 'dockerfile' ||
        l.endsWith('/dockerfile') ||
        l === 'docker-compose.yml' ||
        l === 'docker-compose.yaml')
  );

  if (dockerFiles.length) {
    return supported('docker', 'docker', {
      framework: 'Docker',
      rootDirectory: '',
    });
  }

  /*
   * ---------------------------------------------------------
   * NODE / JAVASCRIPT / TYPESCRIPT
   * ---------------------------------------------------------
   */

  const packageJsons = has(
    (f) =>
      f.toLowerCase().endsWith('package.json') &&
      !inNodeModules(f)
  );

  if (packageJsons.length) {
    const pkgPath = shallowest(packageJsons);
    const rootDirectory = dirOf(pkgPath);

    const pkg =
      safeParseJson((await read(pkgPath)) || '') || {};

    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const scopedFiles = list.filter((f) =>
      rootDirectory
        ? f.startsWith(`${rootDirectory}/`)
        : true
    );

    const hasFile = (name) =>
      scopedFiles.some(
        (f) =>
          f.replace(
            `${rootDirectory ? `${rootDirectory}/` : ''}`,
            ''
          ) === name
      );

    /*
     * Next.js
     */

    const nextConfig = [
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'next.config.cjs',
    ].some(hasFile);

    if (nextConfig || deps.next) {
      return supported('nextjs', 'vercel', {
        framework: 'Next.js',
        rootDirectory,
        packageName: pkg.name || null,
        buildCommand: pkg.scripts?.build
          ? 'npm run build'
          : null,
      });
    }

    /*
     * Vite / React
     */

    const viteConfig = [
      'vite.config.js',
      'vite.config.ts',
      'vite.config.mjs',
      'vite.config.cjs',
    ].some(hasFile);

    if (viteConfig || deps.vite) {
      const isReact = Boolean(deps.react);

      return supported(
        isReact ? 'react-vite' : 'vite',
        'vercel',
        {
          framework: isReact ? 'React + Vite' : 'Vite',
          rootDirectory,
          packageName: pkg.name || null,
          buildCommand: pkg.scripts?.build
            ? 'npm run build'
            : null,
          outputDirectory: 'dist',
        }
      );
    }

    /*
     * Create React App
     */

    if (deps['react-scripts']) {
      return supported('create-react-app', 'vercel', {
        framework: 'Create React App',
        rootDirectory,
        packageName: pkg.name || null,
        buildCommand: pkg.scripts?.build
          ? 'npm run build'
          : 'npm run build',
        outputDirectory: 'build',
      });
    }

    /*
     * Node backend
     */

    const serverDeps = [
      'express',
      'koa',
      'fastify',
      '@nestjs/core',
    ].filter((d) => deps[d]);

    if (serverDeps.length) {
      return supported('node-server', 'backend', {
        framework: serverDeps.join(', '),
        rootDirectory,
        packageName: pkg.name || null,
        startCommand:
          pkg.scripts?.start ||
          pkg.scripts?.['start:prod'] ||
          null,
      });
    }

    /*
     * Static website
     */

    const indexHtml = has(
      (f) =>
        f.toLowerCase().endsWith('index.html') &&
        !inNodeModules(f)
    );

    if (indexHtml.length) {
      return supported('static', 'vercel', {
        framework: 'Static website',
        rootDirectory: dirOf(
          shallowest(indexHtml)
        ),
      });
    }

    return unsupported(
      'node-other',
      'A package.json was found, but the project type could not be determined.',
      {
        rootDirectory,
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * PYTHON
   * ---------------------------------------------------------
   */

  const pythonFiles = has(
    (f) =>
      f.toLowerCase().endsWith('.py') &&
      !f.toLowerCase().includes('site-packages/')
  );

  const requirementFiles = has(
    (f, l) =>
      l.endsWith('requirements.txt') ||
      l.endsWith('pipfile') ||
      l.endsWith('pyproject.toml')
  );

  if (pythonFiles.length || requirementFiles.length) {
    const requirementsText = (
      await Promise.all(
        requirementFiles
          .slice(0, 3)
          .map((f) => read(f))
      )
    )
      .filter(Boolean)
      .join('\n');

    const sources = await Promise.all(
      pythonFiles
        .slice(0, 15)
        .map((f) => read(f))
    );

    const sourceText =
      sources
        .filter(Boolean)
        .join('\n');

    /*
     * Desktop / hardware dependent Python
     */

    const requirementHit =
      DESKTOP_REQUIREMENTS.find(
        (r) => r.pattern.test(requirementsText)
      );

    const sourceHit =
      DESKTOP_PATTERNS.find(
        (p) => p.pattern.test(sourceText)
      );

    if (requirementHit || sourceHit) {
      const evidence =
        sourceHit?.label ||
        requirementHit?.label;

      return unsupported(
        'python-desktop',
        `This project appears to be a desktop or hardware-dependent application (detected ${evidence}). It cannot be automatically deployed as a normal web application without adapting the application.`,
        {
          evidence,
          platform: null,
        }
      );
    }

    /*
     * Python web frameworks
     */

    const webHit =
      PYTHON_WEB_FRAMEWORKS.find(
        (p) => p.pattern.test(requirementsText)
      );

    if (webHit) {
      const framework =
        webHit.label.toLowerCase();

      return supported(
        `python-${framework}`,
        'backend',
        {
          framework: webHit.label,
          rootDirectory: '',
        }
      );
    }

    /*
     * Generic Python
     */

    return unsupported(
      'python',
      'A Python project was detected, but no supported web framework was found. The project may require a custom deployment configuration.'
    );
  }

  /*
   * ---------------------------------------------------------
   * STATIC WEBSITE WITHOUT PACKAGE.JSON
   * ---------------------------------------------------------
   */

  const indexHtml = has(
    (f) =>
      f.toLowerCase().endsWith('index.html') &&
      !inNodeModules(f)
  );

  if (indexHtml.length) {
    return supported('static', 'vercel', {
      framework: 'Static website',
      rootDirectory: dirOf(
        shallowest(indexHtml)
      ),
    });
  }

  /*
   * ---------------------------------------------------------
   * UNKNOWN
   * ---------------------------------------------------------
   */

  return unsupported(
    'unknown',
    'The project type could not be determined. No recognizable web, backend, Python or Docker project files were found.'
  );
}

module.exports = {
  detectProject,
};