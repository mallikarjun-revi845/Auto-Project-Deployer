import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const token = params.get('token');
    if (!token) {
      navigate('/login?error=github_auth_failed', { replace: true });
      return;
    }
    completeLogin(token).then((user) => {
      navigate(user ? '/dashboard' : '/login?error=github_auth_failed', { replace: true });
    });
  }, [params, completeLogin, navigate]);

  return (
    <div className="grid min-h-screen place-items-center">
      <div className="flex items-center gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
        Completing GitHub sign-in…
      </div>
    </div>
  );
}
