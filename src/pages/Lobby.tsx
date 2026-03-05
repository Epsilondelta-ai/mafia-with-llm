import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerConfig, PlayerType, LLMProvider, GameConfig } from '@shared/types';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';

const PLAYER_COUNTS = [5, 6, 7, 8];
const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'ollama', label: 'Ollama (로컬)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'xai', label: 'X AI (Grok)' },
];

const AI_NAMES = ['Luna', 'Rex', 'Nova', 'Kai', 'Zara', 'Finn', 'Maya'];

export default function Lobby() {
  const navigate = useNavigate();
  const { createGame, spectateGame } = useSocket();
  const reset = useGameStore(s => s.reset);

  const [playerCount, setPlayerCount] = useState(5);
  const [playerName, setPlayerName] = useState('Player');
  const [aiConfigs, setAiConfigs] = useState<{ type: PlayerType; provider: LLMProvider }[]>(
    Array(4).fill(null).map(() => ({ type: 'code_ai' as PlayerType, provider: 'ollama' as LLMProvider }))
  );
  const [spectateSpeed, setSpectateSpeed] = useState(2000);
  const [isCreating, setIsCreating] = useState(false);

  const handleAIChange = (index: number, field: 'type' | 'provider', value: string) => {
    setAiConfigs(prev => {
      const next = [...prev];
      if (field === 'type') next[index] = { ...next[index], type: value as PlayerType };
      if (field === 'provider') next[index] = { ...next[index], provider: value as LLMProvider };
      return next;
    });
  };

  const buildPlayers = (includeHuman: boolean): PlayerConfig[] => {
    const players: PlayerConfig[] = [];

    if (includeHuman) {
      players.push({ name: playerName || 'Player', type: 'human' });
    }

    const aiCount = includeHuman ? playerCount - 1 : playerCount;
    for (let i = 0; i < aiCount; i++) {
      const cfg = aiConfigs[i] || { type: 'code_ai', provider: 'ollama' };
      players.push({
        name: AI_NAMES[i] || `AI-${i + 1}`,
        type: cfg.type,
        llmProvider: cfg.type === 'llm_ai' ? cfg.provider : undefined,
      });
    }

    return players;
  };

  const handlePlay = async () => {
    setIsCreating(true);
    reset();
    const config: GameConfig = {
      playerCount,
      players: buildPlayers(true),
      mode: 'play',
    };
    const gameId = await createGame(config);
    navigate(`/game/${gameId}`);
  };

  const handleSpectate = async () => {
    setIsCreating(true);
    reset();
    const config: GameConfig = {
      playerCount,
      players: buildPlayers(false),
      mode: 'spectate',
      spectateSpeed,
    };
    const gameId = await spectateGame(config);
    navigate(`/spectate/${gameId}`);
  };

  const aiSlots = playerCount - 1;

  return (
    <div className="space-y-6 pb-8">
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold text-mafia-accent">MAFIA CARD GAME</h1>
        <p className="text-mafia-muted text-sm mt-1">AI와 함께하는 마피아 카드게임</p>
      </div>

      {/* Player count */}
      <div className="card-base">
        <label className="block text-sm font-medium text-mafia-muted mb-2">인원 수</label>
        <div className="flex gap-2">
          {PLAYER_COUNTS.map(n => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
                playerCount === n
                  ? 'bg-mafia-accent text-white'
                  : 'bg-mafia-card text-mafia-muted hover:text-mafia-text'
              }`}
            >
              {n}인
            </button>
          ))}
        </div>
      </div>

      {/* Player name */}
      <div className="card-base">
        <label className="block text-sm font-medium text-mafia-muted mb-2">내 이름</label>
        <input
          className="input-field"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          placeholder="이름을 입력하세요"
        />
      </div>

      {/* AI config */}
      <div className="card-base">
        <label className="block text-sm font-medium text-mafia-muted mb-3">AI 플레이어 설정</label>
        <div className="space-y-3">
          {Array.from({ length: aiSlots }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-mafia-muted w-14 shrink-0">{AI_NAMES[i]}</span>
              <select
                className="input-field text-sm py-1.5"
                value={aiConfigs[i]?.type || 'code_ai'}
                onChange={e => handleAIChange(i, 'type', e.target.value)}
              >
                <option value="code_ai">코드 AI (무료)</option>
                <option value="llm_ai">LLM AI (유료)</option>
              </select>
              {aiConfigs[i]?.type === 'llm_ai' && (
                <select
                  className="input-field text-sm py-1.5"
                  value={aiConfigs[i]?.provider || 'ollama'}
                  onChange={e => handleAIChange(i, 'provider', e.target.value)}
                >
                  {LLM_PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          className="btn-primary w-full py-3 text-lg"
          onClick={handlePlay}
          disabled={isCreating}
        >
          {isCreating ? '생성 중...' : '게임 시작'}
        </button>

        <div className="card-base">
          <label className="block text-sm font-medium text-mafia-muted mb-2">관전 모드 (AI끼리만)</label>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-mafia-muted">속도:</span>
            <input
              type="range"
              min={500}
              max={5000}
              step={500}
              value={spectateSpeed}
              onChange={e => setSpectateSpeed(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-mafia-muted w-12">{spectateSpeed / 1000}초</span>
          </div>
          <button
            className="btn-secondary w-full"
            onClick={handleSpectate}
            disabled={isCreating}
          >
            관전 시작
          </button>
        </div>
      </div>
    </div>
  );
}
