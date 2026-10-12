import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, Cloud, ExternalLink, Github, PartyPopper, XCircle } from 'lucide-react';
import { formatDate, projectTypeLabel } from '../lib/deployment.js';

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 text-accent-blue" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-100">{value}</p>
      </div>
    </div>
  );
}

export default function DeploymentResult({ deployment }) {
  if (!deployment || !['live', 'failed', 'unsupported'].includes(deployment.status)) return null;

  const success = deployment.status === 'live';
  const unsupported = deployment.status === 'unsupported';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card border ${
        success ? 'border-emerald-500/30' : unsupported ? 'border-amber-500/30' : 'border-rose-500/30'
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        {success ? (
          <PartyPopper className="h-6 w-6 text-emerald-400" />
        ) : unsupported ? (
          <AlertTriangle className="h-6 w-6 text-amber-400" />
        ) : (
          <XCircle className="h-6 w-6 text-rose-400" />
        )}
        <h3 className="text-xl font-bold text-white">
          {success ? 'Deployment Successful!' : unsupported ? 'Project Not Supported' : 'Deployment Failed'}
        </h3>
      </div>

      {success ? (
        <>
          <p className="text-sm text-slate-400">Your project is live at:</p>
          <a
            href={deployment.liveUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 break-all text-base font-semibold text-accent-blue hover:underline"
          >
            {deployment.liveUrl}
          </a>
          <div className="mt-4">
            <a href={deployment.liveUrl} target="_blank" rel="noreferrer" className="btn-primary">
              <ExternalLink className="h-4 w-4" />
              Open Website
            </a>
          </div>
        </>
      ) : (
        <p className={`text-sm ${unsupported ? 'text-amber-200' : 'text-rose-200'}`}>{deployment.errorMessage}</p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Detail icon={Github} label="Project name" value={deployment.projectName} />
        <Detail icon={Cloud} label="Project type" value={projectTypeLabel(deployment.projectType)} />
        <Detail icon={Cloud} label="Platform" value={success ? deployment.platform : '—'} />
        <Detail icon={Calendar} label="Deployment date" value={formatDate(deployment.deployDate)} />
      </div>
    </motion.div>
  );
}
