import { useRef, useEffect } from 'react';
import type { GameEvent } from '@shared/types';

interface Props {
  events: GameEvent[];
}

export default function EventLog({ events }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'game_start': return '🎮';
      case 'turn_start': return '🔄';
      case 'cards_drawn': return '🃏';
      case 'card_used': return '⚡';
      case 'player_damaged': return '💥';
      case 'player_healed': return '💚';
      case 'player_eliminated': return '💀';
      case 'player_revived': return '🚑';
      case 'identity_revealed': return '👁';
      case 'arrest_applied': return '🔒';
      case 'reward_given': return '🎁';
      case 'penalty_applied': return '⚠️';
      case 'game_over': return '🏆';
      default: return '📋';
    }
  };

  return (
    <div className="card-base">
      <div className="text-xs text-mafia-muted mb-2 font-medium">이벤트 로그</div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {events.slice(-30).map(event => (
          <div key={event.id} className="text-xs flex items-start gap-1.5">
            <span>{getIcon(event.type)}</span>
            <span className="text-mafia-text">{event.messageKo}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
