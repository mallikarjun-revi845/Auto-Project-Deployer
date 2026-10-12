import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ExternalLink, Github, Inbox, Loader2, RefreshCw } from 'lucide-react';
import Header from '../components/Header.jsx';
import { api, apiErrorMessage } from '../lib/api.js';
import { formatDate, projectTypeLabel, statusStyle } from '../lib/deployment.js';

export default function History() {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/deploy/history');
      setDeployments(data.deployments);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Could not load deployment history.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen grid-glow">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Deployment history</h1>
            <p className="mt-2 text-sm text-slate-400">Every deployment you have started, newest first.</p>
          </div>
          <button type="button" onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-accent-blue" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="card grid place-items-center py-20 text-center">
            <Inbox className="h-10 w-10 text-slate-600" />
            <p className="mt-4 text-sm text-slate-400">No deployments yet. Start one from the dashboard.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {deployments.map((deployment, index) => (
              <motion.article
                key={deployment.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                className="card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{deployment.projectName}</h2>
                    <a
                      href={deployment.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent-blue"
                    >
                      <Github className="h-3.5 w-3.5" /> {deployment.repoUrl.replace('https://github.com/', '')}
                    </a>
                  </div>
                  <span className={`badge ${statusStyle(deployment.status)}`}>{deployment.status}</span>
                </div>

                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-500">Project type</dt>
                    <dd className="mt-1 text-slate-200">{projectTypeLabel(deployment.projectType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-500">Platform</dt>
                    <dd className="mt-1 text-slate-200">{deployment.status === 'live' ? deployment.platform : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-slate-500">Date</dt>
                    <dd className="mt-1 text-slate-200">{formatDate(deployment.deployDate)}</dd>
                  </div>
                </dl>

                {deployment.liveUrl && deployment.status === 'live' && (
                  <a
                    href={deployment.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent-blue hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" /> {deployment.liveUrl}
                  </a>
                )}

                {deployment.errorMessage && (
                  <p className="mt-5 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    {deployment.errorMessage}
                  </p>
                )}
              </motion.article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
