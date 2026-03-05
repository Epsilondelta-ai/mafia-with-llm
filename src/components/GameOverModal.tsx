import type { Team, ClientPlayerView } from '@shared/types';

interface Props {
  winner: Team;
  players: ClientPlayerView[];
  onBack: () => void;
}

const ROLE_KO: Record<string, string> = {
  police: '경찰',
  citizen: '시민',
  mafia: '마피아',
  unknown: '???',
};

export default function GameOverModal({ winner, players, onBack }: Props) {
  const isCitizenWin = winner === 'citizen_team';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-base w-full max-w-sm text-center space-y-4">
        <div className={`text-3xl font-bold ${isCitizenWin ? 'text-mafia-citizen' : 'text-mafia-accent'}`}>
          {isCitizenWin ? '시민 진영 승리!' : '마피아 진영 승리!'}
        </div>

        <div className="space-y-2">
          {players.map(p => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                p.isAlive ? 'bg-mafia-card' : 'bg-mafia-bg/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${p.isAlive ? 'text-mafia-text' : 'text-mafia-muted line-through'}`}>
                  {p.name}
                </span>
                <span className="text-xs text-mafia-muted">
                  {p.type === 'code_ai' ? '🤖' : p.type === 'llm_ai' ? '🧠' : '👤'}
                </span>
              </div>
              <span className={`text-xs font-medium ${
                p.role === 'police' ? 'text-mafia-police'
                : p.role === 'mafia' ? 'text-mafia-accent'
                : 'text-mafia-citizen'
              }`}>
                {ROLE_KO[p.role] || p.role}
              </span>
            </div>
          ))}
        </div>

        <button className="btn-primary w-full" onClick={onBack}>
          로비로 돌아가기
        </button>
      </div>
    </div>
  );
}
