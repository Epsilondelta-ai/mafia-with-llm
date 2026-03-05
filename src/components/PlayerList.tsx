import type { ClientPlayerView } from '@shared/types';

interface Props {
  players: ClientPlayerView[];
  currentPlayerId?: string;
  myPlayerId: string | null;
  showAllRoles?: boolean;
  onSelectTarget?: (id: string) => void;
  selectedTarget?: string | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  police: { label: '경찰', color: 'text-mafia-police' },
  citizen: { label: '시민', color: 'text-mafia-citizen' },
  mafia: { label: '마피아', color: 'text-mafia-accent' },
  unknown: { label: '???', color: 'text-mafia-muted' },
};

export default function PlayerList({ players, currentPlayerId, myPlayerId, showAllRoles, onSelectTarget, selectedTarget }: Props) {
  return (
    <div className="card-base">
      <div className="text-xs text-mafia-muted mb-2 font-medium">플레이어</div>
      <div className="grid grid-cols-2 gap-2">
        {players.map(p => {
          const role = ROLE_LABELS[p.role] || ROLE_LABELS.unknown;
          const isMe = p.id === myPlayerId;
          const isCurrent = p.id === currentPlayerId;
          const isSelected = p.id === selectedTarget;

          return (
            <button
              key={p.id}
              onClick={() => onSelectTarget && p.isAlive && p.id !== myPlayerId && onSelectTarget(p.id)}
              disabled={!onSelectTarget || !p.isAlive || p.id === myPlayerId}
              className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-mafia-accent/20 border border-mafia-accent'
                  : isCurrent
                    ? 'bg-mafia-card border border-mafia-accent/30'
                    : 'bg-mafia-bg/50 border border-transparent'
              } ${!p.isAlive ? 'opacity-40' : ''} ${
                onSelectTarget && p.isAlive && p.id !== myPlayerId ? 'cursor-pointer hover:bg-mafia-card' : 'cursor-default'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-medium truncate ${isMe ? 'text-mafia-gold' : 'text-mafia-text'}`}>
                    {p.name}
                  </span>
                  {isMe && <span className="text-[10px] text-mafia-gold">(나)</span>}
                  {p.isIdentityRevealed && p.role === 'mafia' && p.isAlive && (
                    <span className="text-[10px] text-mafia-accent font-medium">정체공개</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs ${role.color}`}>{role.label}</span>
                  <span className="text-xs text-mafia-muted">
                    {p.type === 'code_ai' ? '🤖' : p.type === 'llm_ai' ? '🧠' : '👤'}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {p.isAlive ? (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: p.maxHealth }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < p.health ? 'bg-red-500' : 'bg-mafia-card'
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-mafia-muted">탈락</span>
                )}
                {p.isArrested && <div className="text-[10px] text-yellow-500 mt-0.5">체포됨</div>}
                {p.publicCards.length > 0 && (
                  <div className="text-[10px] text-mafia-muted mt-0.5">
                    공격 {p.publicCards.length}장
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
