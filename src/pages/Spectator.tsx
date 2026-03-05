import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import PlayerList from '../components/PlayerList';
import ChatLog from '../components/ChatLog';
import GameOverModal from '../components/GameOverModal';
import EventLog from '../components/EventLog';

export default function Spectator() {
  const navigate = useNavigate();
  useSocket(); // keep connection alive
  const view = useGameStore(s => s.view);
  const events = useGameStore(s => s.events);
  const aiThinking = useGameStore(s => s.aiThinking);

  if (!view) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-mafia-muted animate-pulse">관전 모드 연결 중...</p>
      </div>
    );
  }

  const currentPlayer = view.players[view.currentPlayerIndex];

  const phaseLabel = {
    chat: '채팅',
    draw: '카드 드로',
    use_cards: '카드 사용',
    game_over: '게임 종료',
    lobby: '로비',
    setup: '준비',
  }[view.phase] || view.phase;

  return (
    <div className="space-y-3 pb-8">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-block px-3 py-1 bg-mafia-gold/20 text-mafia-gold rounded-full text-xs font-medium">
          관전 모드
        </div>
      </div>

      {/* Status */}
      <div className="card-base flex items-center justify-between text-sm">
        <div>
          <span className="text-mafia-muted">턴 {view.turnNumber}</span>
          <span className="mx-2 text-mafia-card">|</span>
          <span className="text-mafia-accent font-medium">{phaseLabel}</span>
        </div>
        <div className="text-mafia-muted">덱: {view.deckSize}장</div>
      </div>

      {/* Current turn */}
      <div className="text-center py-2 rounded-lg text-sm font-medium bg-mafia-card/50 text-mafia-muted">
        {aiThinking ? (
          <span className="animate-pulse">
            {view.players.find(p => p.id === aiThinking)?.name} 생각 중...
          </span>
        ) : (
          `${currentPlayer?.name}의 차례`
        )}
      </div>

      {/* Players - all roles visible in spectator mode */}
      <PlayerList
        players={view.players}
        currentPlayerId={currentPlayer?.id}
        myPlayerId={null}
        showAllRoles
      />

      {/* Chat log */}
      <ChatLog messages={view.chatLog} />

      {/* Event log */}
      <EventLog events={events} />

      {/* Game over */}
      {view.phase === 'game_over' && view.winner && (
        <GameOverModal
          winner={view.winner}
          players={view.players}
          onBack={() => navigate('/')}
        />
      )}
    </div>
  );
}
