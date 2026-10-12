import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Github, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const error = params.get('error');

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="grid min-h-screen place-items-center grid-glow px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card text-center">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with GitHub to deploy repositories and view your deployment history.
          </p>

          {error && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              GitHub authentication failed. Please try again.
            </div>
          )}

          <button type="button" onClick={login} className="btn-primary mt-6 w-full">
            <Github className="h-4 w-4" /> Login with GitHub
          </button>

          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> We only request read access to your public profile.
          </p>
        </div>
        <div className="mt-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
