import { Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple shadow-glow">
        <Rocket className="h-5 w-5 text-white" />
      </span>
      <span className="text-lg font-bold tracking-tight text-white">
        Auto Project <span className="text-accent-blue">Deployer</span>
      </span>
    </Link>
  );
}
