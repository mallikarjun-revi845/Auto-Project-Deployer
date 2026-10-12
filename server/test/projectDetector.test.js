const test = require('node:test');
const assert = require('node:assert');
const { detectProject } = require('../services/projectDetector');

function repo(files, contents = {}) {
  return { files, readFile: async (path) => contents[path] ?? null };
}

test('detects React + Vite', async () => {
  const result = await detectProject(
    repo(['package.json', 'vite.config.js', 'src/main.jsx', 'index.html'], {
      'package.json': JSON.stringify({ name: 'app', dependencies: { react: '18.0.0' }, devDependencies: { vite: '5' } }),
    })
  );
  assert.deepEqual(
    { projectType: result.projectType, supported: result.supported, platform: result.platform },
    { projectType: 'react-vite', supported: true, platform: 'vercel' }
  );
});

test('detects Next.js from dependency', async () => {
  const result = await detectProject(
    repo(['package.json', 'pages/index.js'], {
      'package.json': JSON.stringify({ dependencies: { next: '14' } }),
    })
  );
  assert.equal(result.projectType, 'nextjs');
  assert.equal(result.supported, true);
});

test('detects static website', async () => {
  const result = await detectProject(repo(['index.html', 'style.css', 'app.js']));
  assert.equal(result.projectType, 'static');
  assert.equal(result.supported, true);
});

test('detects OpenCV desktop app as unsupported', async () => {
  const result = await detectProject(
    repo(['main.py', 'requirements.txt'], {
      'main.py': 'import cv2\ncap = cv2.VideoCapture(0)\n',
      'requirements.txt': 'opencv-python\nmediapipe\n',
    })
  );
  assert.equal(result.projectType, 'python-desktop');
  assert.equal(result.supported, false);
  assert.match(result.reason, /desktop application|desktop or hardware-dependent application/);
});

test('detects tkinter desktop app as unsupported', async () => {
  const result = await detectProject(
    repo(['gui.py'], { 'gui.py': 'import tkinter as tk\nroot = tk.Tk()\n' })
  );
  assert.equal(result.projectType, 'python-desktop');
  assert.equal(result.supported, false);
});

test('detects plain python project as unsupported', async () => {
  const result = await detectProject(
    repo(['script.py', 'requirements.txt'], { 'script.py': 'print("hi")', 'requirements.txt': 'requests\n' })
  );
  assert.equal(result.projectType, 'python');
  assert.equal(result.supported, false);
});

test('unknown project type', async () => {
  const result = await detectProject(repo(['README.md', 'LICENSE']));
  assert.equal(result.projectType, 'unknown');
  assert.equal(result.supported, false);
});

test('supports monorepo-style nested vite app', async () => {
  const result = await detectProject(
    repo(['apps/web/package.json', 'apps/web/vite.config.ts', 'apps/web/src/main.tsx'], {
      'apps/web/package.json': JSON.stringify({ dependencies: { react: '18' }, devDependencies: { vite: '5' } }),
    })
  );
  assert.equal(result.projectType, 'react-vite');
  assert.equal(result.rootDirectory, 'apps/web');
});
