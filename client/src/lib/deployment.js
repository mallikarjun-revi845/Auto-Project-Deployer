export const DEPLOY_STEPS = [
  { key: 'validating', label: 'Validating Repository' },
  { key: 'detecting', label: 'Detecting Project Type' },
  { key: 'checking', label: 'Checking Compatibility' },
  { key: 'cloning', label: 'Preparing Deployment' },
  { key: 'deploying', label: 'Deploying' },
  { key: 'building', label: 'Building Project' },
  { key: 'verifying', label: 'Verifying Deployment URL' },
  { key: 'live', label: 'Project Live' },
];

const STEP_ORDER = DEPLOY_STEPS.map((step) => step.key);

export function stepState(stepKey, currentStatus) {
  if (currentStatus === 'failed' || currentStatus === 'unsupported') {
    const failedAt = STEP_ORDER.indexOf(stepKey);
    return failedAt === -1 ? 'pending' : 'stopped';
  }
  const currentIndex = STEP_ORDER.indexOf(currentStatus);
  const index = STEP_ORDER.indexOf(stepKey);
  if (currentIndex === -1) return 'pending';
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return currentStatus === 'live' ? 'done' : 'active';
  return 'pending';
}

export const PROJECT_TYPE_LABELS = {
  'react-vite': 'React + Vite',
  vite: 'Vite',
  nextjs: 'Next.js',
  static: 'Static HTML/CSS/JS',
  python: 'Python',
  'python-desktop': 'Python desktop application',
  'create-react-app': 'Create React App',
  'node-server': 'Node.js server',
  'node-other': 'Node.js project',
  unknown: 'Unknown',
};

export function projectTypeLabel(type) {
  return PROJECT_TYPE_LABELS[type] || type || 'Unknown';
}

export const STATUS_STYLES = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  failed: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  unsupported: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  queued: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

export function statusStyle(status) {
  return STATUS_STYLES[status] || 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue';
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
