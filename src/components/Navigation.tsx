import { Link, useLocation } from 'react-router-dom';

export default function Navigation() {
  const { pathname } = useLocation();
  const isInGame = pathname.startsWith('/game') || pathname.startsWith('/spectate');

  return (
    <nav className="bg-mafia-surface border-b border-mafia-card px-4 py-3">
      <div className="container mx-auto max-w-lg flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-mafia-accent">
          MAFIA
        </Link>
        {!isInGame && (
          <div className="flex gap-4 text-sm">
            <Link
              to="/"
              className={`${pathname === '/' ? 'text-mafia-accent' : 'text-mafia-muted'} hover:text-mafia-text transition-colors`}
            >
              로비
            </Link>
            <Link
              to="/history"
              className={`${pathname === '/history' ? 'text-mafia-accent' : 'text-mafia-muted'} hover:text-mafia-text transition-colors`}
            >
              기록
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
