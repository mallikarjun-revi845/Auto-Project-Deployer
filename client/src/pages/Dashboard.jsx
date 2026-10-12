import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Github, Loader2, Rocket, Wifi, WifiOff } from 'lucide-react';
import Header from '../components/Header.jsx';
import DeploymentProgress from '../components/DeploymentProgress.jsx';
import DeploymentResult from '../components/DeploymentResult.jsx';
import { api, apiErrorMessage } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

const TERMINAL = ['live', 'failed', 'unsupported'];

export default function Dashboard() {
  const [repoUrl, setRepoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [deployment, setDeployment] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);
  const activeId = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onUpdate = (payload) => {
      if (activeId.current && payload.deploymentId !== activeId.current) return;
      setDeployment(payload.deployment);
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('deployment:update', onUpdate);
    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('deployment:update', onUpdate);
    };
  }, []);

  // Fallback polling in case the websocket connection drops mid-deployment.
  useEffect(() => {
    if (!deployment || TERMINAL.includes(deployment.status) || connected) return undefined;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/deploy/${deployment.id}`);
        setDeployment(data.deployment);
      } catch {
        /* keep the last known state */
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [deployment, connected]);

  const submit = useCallback(
    async (event) => {
      event.preventDefault();
      setError('');
      setSubmitting(true);
      try {
        const { data } = await api.post('/deploy', { repoUrl: repoUrl.trim(), projectName: projectName.trim() });
        activeId.current = data.deployment.id;
        setDeployment(data.deployment);
      } catch (requestError) {
        setError(apiErrorMessage(requestError, 'Could not start the deployment.'));
      } finally {
        setSubmitting(false);
      }
    },
    [repoUrl, projectName]
  );

  const running = deployment && !TERMINAL.includes(deployment.status);

  return (
    <div className="min-h-screen grid-glow">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Deploy a project</h1>
            <p className="mt-2 text-sm text-slate-400">
              Paste a public GitHub repository URL. Supported: React + Vite, Next.js and static HTML/CSS/JS websites.
            </p>
          </div>
          <span
            className={`badge ${
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
            }`}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Live updates connected' : 'Live updates offline'}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={submit} className="card h-fit">
            <label className="label" htmlFor="repoUrl">
              GitHub repository URL
            </label>
            <div className="relative">
              <Github className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="repoUrl"
                className="input pl-11"
                placeholder="https://github.com/username/project"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                required
                disabled={running || submitting}
              />
            </div>

            <label className="label mt-5" htmlFor="projectName">
              Project name (optional)
            </label>
            <input
              id="projectName"
              className="input"
              placeholder="my-portfolio"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              disabled={running || submitting}
            />

            <button type="submit" className="btn-primary mt-6 w-full" disabled={running || submitting}>
              {submitting || running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {running ? 'Deployment in progress…' : 'Deploy Project'}
            </button>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="space-y-6">
            {deployment ? (
              <>
                <DeploymentProgress status={deployment.status} logs={deployment.logs} />
                <DeploymentResult deployment={deployment} />
              </>
            ) : (
              <div className="card grid place-items-center py-16 text-center">
                <Rocket className="h-10 w-10 animate-float text-accent-purple" />
                <p className="mt-4 max-w-sm text-sm text-slate-400">
                  Deployment progress will appear here in real time once you start a deployment.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
