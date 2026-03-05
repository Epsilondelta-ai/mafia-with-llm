import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import type { GameAction, CardInstance, ClientPlayerView } from '@shared/types';
import PlayerList from '../components/PlayerList';
import ChatLog from '../components/ChatLog';
import CardHand from '../components/CardHand';
import GameOverModal from '../components/GameOverModal';

export default function Game() {
  const navigate = useNavigate();
  const { sendAction } = useSocket();
  const view = useGameStore(s => s.view);
  const aiThinking = useGameStore(s => s.aiThinking);
  const error = useGameStore(s => s.error);
  const setError = useGameStore(s => s.setError);

  const turnDeadline = useGameStore(s => s.turnDeadline);
  const [chatInput, setChatInput] = useState('');
  const [questionTarget, setQuestionTarget] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [cardTarget, setCardTarget] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!turnDeadline) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  if (!view) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-mafia-muted">게임 연결 중...</p>
      </div>
    );
  }

  const isMyTurn = view.myPlayerId === view.players[view.currentPlayerIndex]?.id;
  const currentPlayer = view.players[view.currentPlayerIndex];
  const me = view.players.find(p => p.id === view.myPlayerId);

  const handlePublicChat = () => {
    if (!chatInput.trim() || !view.myPlayerId) return;
    sendAction({ type: 'chat_public', playerId: view.myPlayerId, content: chatInput.trim() });
    setChatInput('');
  };

  const handleQuestion = () => {
    if (!chatInput.trim() || !questionTarget || !view.myPlayerId) return;
    sendAction({ type: 'chat_question', playerId: view.myPlayerId, targetPlayerId: questionTarget, content: chatInput.trim() });
    setChatInput('');
    setQuestionTarget(null);
  };

  const handleSkipChat = () => {
    if (!view.myPlayerId) return;
    sendAction({ type: 'skip_chat', playerId: view.myPlayerId });
  };

  const handleDraw = () => {
    if (!view.myPlayerId) return;
    sendAction({ type: 'draw_cards', playerId: view.myPlayerId });
  };

  const handleUseCard = (cardInstanceId: string, targetPlayerId?: string, targetCardInstanceId?: string) => {
    if (!view.myPlayerId) return;
    sendAction({ type: 'use_card', playerId: view.myPlayerId, cardInstanceId, targetPlayerId, targetCardInstanceId });
    setSelectedCard(null);
    setCardTarget(null);
  };

  const handleReveal = () => {
    if (!view.myPlayerId) return;
    sendAction({ type: 'reveal_identity', playerId: view.myPlayerId });
  };

  const handleEndTurn = () => {
    if (!view.myPlayerId) return;
    sendAction({ type: 'end_turn', playerId: view.myPlayerId });
  };

  const phaseLabel = {
    chat: '채팅',
    draw: '카드 드로',
    use_cards: '카드 사용',
    game_over: '게임 종료',
    lobby: '로비',
    setup: '준비',
  }[view.phase] || view.phase;

  return (
    <div className="space-y-3 pb-24">
      {/* Status bar */}
      <div className="card-base flex items-center justify-between text-sm">
        <div>
          <span className="text-mafia-muted">턴 {view.turnNumber}</span>
          <span className="mx-2 text-mafia-card">|</span>
          <span className="text-mafia-accent font-medium">{phaseLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft !== null && timeLeft > 0 && (
            <span className={`font-mono font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-mafia-accent'}`}>
              {timeLeft}초
            </span>
          )}
          <span className="text-mafia-muted">
            덱: {view.deckSize}장
          </span>
        </div>
      </div>

      {/* Current turn indicator */}
      <div className={`text-center py-2 rounded-lg text-sm font-medium ${
        isMyTurn ? 'bg-mafia-accent/20 text-mafia-accent' : 'bg-mafia-card/50 text-mafia-muted'
      }`}>
        {aiThinking ? (
          <span className="animate-pulse">
            {view.players.find(p => p.id === aiThinking)?.name} 생각 중...
          </span>
        ) : isMyTurn ? (
          '당신의 차례입니다!'
        ) : (
          `${currentPlayer?.name}의 차례`
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Players */}
      <PlayerList
        players={view.players}
        currentPlayerId={currentPlayer?.id}
        myPlayerId={view.myPlayerId}
        onSelectTarget={(id) => {
          if (view.phase === 'chat') setQuestionTarget(id);
          else setCardTarget(id);
        }}
        selectedTarget={view.phase === 'chat' ? questionTarget : cardTarget}
      />

      {/* Chat phase */}
      {isMyTurn && view.phase === 'chat' && (
        <div className="card-base space-y-2">
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={questionTarget ? '질문을 입력...' : '발언을 입력...'}
              onKeyDown={e => e.key === 'Enter' && (questionTarget ? handleQuestion() : handlePublicChat())}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1 text-sm" onClick={handlePublicChat} disabled={!chatInput.trim()}>
              공개 발언
            </button>
            <button
              className="btn-secondary flex-1 text-sm"
              onClick={handleQuestion}
              disabled={!chatInput.trim() || !questionTarget}
            >
              질문 {questionTarget ? `(${view.players.find(p => p.id === questionTarget)?.name})` : ''}
            </button>
            <button className="btn-secondary text-sm px-3" onClick={handleSkipChat}>
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {/* Draw phase */}
      {isMyTurn && view.phase === 'draw' && (
        <div className="card-base text-center">
          <button className="btn-primary w-full py-3" onClick={handleDraw}>
            카드 2장 뽑기
          </button>
        </div>
      )}

      {/* Card use phase */}
      {isMyTurn && view.phase === 'use_cards' && (
        <div className="card-base space-y-2">
          <div className="flex gap-2">
            {me?.role === 'mafia' && !me.isIdentityRevealed && (
              <button className="btn-secondary flex-1 text-sm" onClick={handleReveal}>
                정체 공개
              </button>
            )}
            <button className="btn-primary flex-1 text-sm" onClick={handleEndTurn}>
              턴 종료
            </button>
          </div>
        </div>
      )}

      {/* Chat log */}
      <ChatLog messages={view.chatLog} />

      {/* My hand */}
      {view.myHand.length > 0 && (
        <CardHand
          cards={view.myHand}
          canUse={isMyTurn && view.phase === 'use_cards'}
          selectedCard={selectedCard}
          onSelectCard={setSelectedCard}
          onUseCard={(cardId) => handleUseCard(cardId, cardTarget || undefined)}
          targetPlayers={view.players.filter(p => p.isAlive && p.id !== view.myPlayerId)}
          selectedTarget={cardTarget}
          onSelectTarget={setCardTarget}
        />
      )}

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
