import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Github,
  Globe,
  RadioTower,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Automatic project detection',
    description:
      'We read your repository tree and package manifests to detect React + Vite, Next.js and static websites — no configuration required.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest compatibility checks',
    description:
      'Desktop apps built with OpenCV, Tkinter, PyQt or pygame are flagged as unsupported instead of being falsely marked as deployed.',
  },
  {
    icon: RadioTower,
    title: 'Real-time progress',
    description: 'Every step streams to your dashboard over Socket.IO, from validation to the final URL verification.',
  },
  {
    icon: Globe,
    title: 'Verified live URLs',
    description:
      'Success is only reported after the generated deployment URL actually responds — no more "ready" deployments that return 404.',
  },
];

const STEPS = [
  { title: 'Sign in with GitHub', description: 'Authenticate securely with OAuth. No passwords are stored.' },
  { title: 'Paste a repository URL', description: 'Any public GitHub repository, plus an optional project name.' },
  { title: 'We analyze the project', description: 'Structure and dependencies decide whether it can run on the web.' },
  { title: 'Deploy and verify', description: 'Supported projects go live on Vercel and the URL is verified for you.' },
];

export default function Landing() {
  const { user, login } = useAuth();

  return (
    <div className="min-h-screen grid-glow">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo />
        {user ? (
          <Link to="/dashboard" className="btn-primary">
            Go to dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={login} className="btn-primary">
            <Github className="h-4 w-4" /> Login with GitHub
          </button>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <section className="py-16 text-center sm:py-24">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge border-accent-blue/30 bg-accent-blue/10 text-accent-blue"
          >
            <Sparkles className="h-3.5 w-3.5" /> Deploy from a GitHub URL in one click
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl"
          >
            Auto Project{' '}
            <span className="bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
              Deployer
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-base text-slate-400 sm:text-lg"
          >
            Paste a public GitHub repository URL. We detect the project type, verify it can actually run on the web,
            deploy it to Vercel, and confirm the live URL responds before telling you it worked.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <button type="button" onClick={user ? undefined : login} className="btn-primary w-full sm:w-auto">
              <Github className="h-4 w-4" />
              {user ? 'Signed in with GitHub' : 'Login with GitHub'}
            </button>
            <a href="#how-it-works" className="btn-ghost w-full sm:w-auto">
              How it works
            </a>
          </motion.div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="card"
            >
              <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20">
                <feature.icon className="h-5 w-5 text-accent-blue" />
              </span>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.description}</p>
            </motion.div>
          ))}
        </section>

        <section id="how-it-works" className="mt-24 scroll-mt-20">
          <h2 className="text-center text-3xl font-bold text-white">How it works</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
            Four steps from repository URL to a verified, live website.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="card"
              >
                <span className="badge border-white/10 bg-white/5 text-slate-300">Step {index + 1}</span>
                <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-24">
          <div className="card flex flex-col items-center gap-4 bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 text-center">
            <Zap className="h-8 w-8 text-accent-purple" />
            <h2 className="text-2xl font-bold text-white">Ready to deploy your first project?</h2>
            <p className="max-w-xl text-sm text-slate-400">
              Supported today: React + Vite, Next.js and static HTML/CSS/JS websites, deployed to Vercel.
            </p>
            <button type="button" onClick={login} className="btn-primary">
              <Github className="h-4 w-4" /> Get started with GitHub
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        Auto Project Deployer — built with React, Express, MongoDB and Socket.IO.
      </footer>
    </div>
  );
}
