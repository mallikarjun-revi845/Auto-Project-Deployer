import { motion } from 'framer-motion';
import { Check, CircleDashed, Loader2, X } from 'lucide-react';
import { DEPLOY_STEPS, stepState } from '../lib/deployment.js';

function StepIcon({ state }) {
  if (state === 'done') return <Check className="h-4 w-4 text-emerald-400" />;
  if (state === 'active') return <Loader2 className="h-4 w-4 animate-spin text-accent-blue" />;
  if (state === 'stopped') return <X className="h-4 w-4 text-rose-400" />;
  return <CircleDashed className="h-4 w-4 text-slate-600" />;
}

export default function DeploymentProgress({ status, logs = [] }) {
  const latestByStep = logs.reduce((acc, log) => ({ ...acc, [log.step]: log.message }), {});

  return (
    <div className="card">
      <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Deployment progress</h3>
      <ol className="space-y-1">
        {DEPLOY_STEPS.map((step, index) => {
          const state = stepState(step.key, status);
          return (
            <motion.li
              key={step.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                state === 'active' ? 'bg-accent-blue/10' : ''
              }`}
            >
              <span className="mt-0.5">
                <StepIcon state={state} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${
                    state === 'pending' ? 'text-slate-500' : state === 'stopped' ? 'text-slate-500' : 'text-slate-100'
                  }`}
                >
                  {step.label}
                </span>
                {latestByStep[step.key] && (
                  <span className="mt-0.5 block break-words text-xs text-slate-500">{latestByStep[step.key]}</span>
                )}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
