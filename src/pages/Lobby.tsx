import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerConfig, PlayerType, LLMProvider, GameConfig, GameMode } from '@shared/types';
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

const PROVIDER_MODELS: Record<LLMProvider, { value: string; label: string }[]> = {
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'llama3', label: 'Llama 3' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'gemma2', label: 'Gemma 2' },
    { value: 'phi3', label: 'Phi 3' },
    { value: 'codellama', label: 'Code Llama' },
    { value: 'qwen3.5:122b', label: 'Qwen 3.5 122B' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  claude: [
    { value: 'claude-sonnet-4-20250514', label: 'Sonnet 4' },
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    { value: 'claude-opus-4-20250514', label: 'Opus 4' },
  ],
  gemini: [
    { value: 'gemini-3-flash-preview', label: '3.0 Flash' },
    { value: 'gemini-3.1-flash-lite-preview', label: '3.1 Flash Lite' },
    { value: 'gemini-3.1-pro-preview', label: '3.1 Pro' },
    { value: 'gemini-2.5-flash', label: '2.5 Flash' },
    { value: 'gemini-2.5-pro', label: '2.5 Pro' },
    { value: 'gemini-2.0-flash', label: '2.0 Flash' },
  ],
  xai: [
    { value: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast Reasoning' },
    { value: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast' },
  ],
};

const AI_NAMES = ['Luna', 'Rex', 'Nova', 'Kai', 'Zara', 'Finn', 'Maya', 'Axel'];

export default function Lobby() {
  const navigate = useNavigate();
  const { createGame, spectateGame } = useSocket();
  const reset = useGameStore(s => s.reset);

  const [playerCount, setPlayerCount] = useState(5);
  const [playerName, setPlayerName] = useState('Player');
  const [gameMode, setGameMode] = useState<GameMode>('play');
  const [aiConfigs, setAiConfigs] = useState<{ type: PlayerType; provider: LLMProvider; model: string }[]>(
    Array(8).fill(null).map(() => ({ type: 'code_ai' as PlayerType, provider: 'ollama' as LLMProvider, model: '' }))
  );
  const [spectateSpeed, setSpectateSpeed] = useState(2000);
  const [isCreating, setIsCreating] = useState(false);

  const handleAIChange = (index: number, field: 'type' | 'provider' | 'model', value: string) => {
    setAiConfigs(prev => {
      const next = [...prev];
      if (field === 'type') {
        next[index] = { ...next[index], type: value as PlayerType };
      } else if (field === 'provider') {
        next[index] = { ...next[index], provider: value as LLMProvider, model: '' };
      } else if (field === 'model') {
        next[index] = { ...next[index], model: value };
      }
      return next;
    });
  };

  const aiSlots = gameMode === 'spectate' ? playerCount : playerCount - 1;

  const buildPlayers = (includeHuman: boolean): PlayerConfig[] => {
    const players: PlayerConfig[] = [];

    if (includeHuman) {
      players.push({ name: playerName || 'Player', type: 'human' });
    }

    const aiCount = includeHuman ? playerCount - 1 : playerCount;
    for (let i = 0; i < aiCount; i++) {
      const cfg = aiConfigs[i] || { type: 'code_ai', provider: 'ollama', model: '' };
      players.push({
        name: AI_NAMES[i] || `AI-${i + 1}`,
        type: cfg.type,
        llmProvider: cfg.type === 'llm_ai' ? cfg.provider : undefined,
        llmModel: cfg.type === 'llm_ai' && cfg.model ? cfg.model : undefined,
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

  const handleStart = () => {
    if (gameMode === 'play') handlePlay();
    else handleSpectate();
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold text-mafia-accent">MAFIA CARD GAME</h1>
        <p className="text-mafia-muted text-sm mt-1">AI와 함께하는 마피아 카드게임</p>
      </div>

      {/* Game mode toggle */}
      <div className="card-base">
        <label className="block text-sm font-medium text-mafia-muted mb-2">게임 모드</label>
        <div className="flex gap-2">
          <button
            onClick={() => setGameMode('play')}
            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
              gameMode === 'play'
                ? 'bg-mafia-accent text-white'
                : 'bg-mafia-card text-mafia-muted hover:text-mafia-text'
            }`}
          >
            직접 플레이
          </button>
          <button
            onClick={() => setGameMode('spectate')}
            className={`flex-1 py-2 rounded-lg font-bold transition-colors ${
              gameMode === 'spectate'
                ? 'bg-mafia-accent text-white'
                : 'bg-mafia-card text-mafia-muted hover:text-mafia-text'
            }`}
          >
            관전 모드
          </button>
        </div>
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
        <p className="text-xs text-mafia-muted mt-1">
          {gameMode === 'play'
            ? `나 1명 + AI ${playerCount - 1}명`
            : `AI ${playerCount}명 (관전)`}
        </p>
      </div>

      {/* Player name - only in play mode */}
      {gameMode === 'play' && (
        <div className="card-base">
          <label className="block text-sm font-medium text-mafia-muted mb-2">내 이름</label>
          <input
            className="input-field"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="이름을 입력하세요"
          />
        </div>
      )}

      {/* AI config */}
      <div className="card-base">
        <label className="block text-sm font-medium text-mafia-muted mb-3">AI 플레이어 설정</label>
        <div className="space-y-3">
          {Array.from({ length: aiSlots }, (_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-mafia-muted w-14 shrink-0">{AI_NAMES[i]}</span>
                <select
                  className="input-field text-sm py-1.5"
                  value={aiConfigs[i]?.type || 'code_ai'}
                  onChange={e => handleAIChange(i, 'type', e.target.value)}
                >
                  <option value="code_ai">코드 AI (무료)</option>
                  <option value="llm_ai">LLM AI (유료)</option>
                </select>
              </div>
              {aiConfigs[i]?.type === 'llm_ai' && (
                <div className="flex items-center gap-2 ml-16">
                  <select
                    className="input-field text-sm py-1.5"
                    value={aiConfigs[i]?.provider || 'ollama'}
                    onChange={e => handleAIChange(i, 'provider', e.target.value)}
                  >
                    {LLM_PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    className="input-field text-sm py-1.5"
                    value={aiConfigs[i]?.model || ''}
                    onChange={e => handleAIChange(i, 'model', e.target.value)}
                  >
                    <option value="">기본 모델</option>
                    {PROVIDER_MODELS[aiConfigs[i]?.provider || 'ollama'].map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Spectate speed - only in spectate mode */}
      {gameMode === 'spectate' && (
        <div className="card-base">
          <label className="block text-sm font-medium text-mafia-muted mb-2">관전 속도</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-mafia-muted">빠름</span>
            <input
              type="range"
              min={500}
              max={5000}
              step={500}
              value={spectateSpeed}
              onChange={e => setSpectateSpeed(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-mafia-muted">느림</span>
            <span className="text-xs text-mafia-muted w-12">{spectateSpeed / 1000}초</span>
          </div>
        </div>
      )}

      {/* Start button */}
      <button
        className="btn-primary w-full py-3 text-lg"
        onClick={handleStart}
        disabled={isCreating}
      >
        {isCreating
          ? '생성 중...'
          : gameMode === 'play' ? '게임 시작' : '관전 시작'}
      </button>
    </div>
  );
}
