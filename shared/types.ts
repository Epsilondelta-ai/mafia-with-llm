// ===== Roles & Teams =====
export type Role = 'police' | 'citizen' | 'mafia';
export type Team = 'citizen_team' | 'mafia_team';

// ===== Cards =====
export type CardType = 'attack' | 'heal' | 'disrupt' | 'special';
export type CardId =
  | 'shot'
  | 'snipe'
  | 'first_aid'
  | 'hospital'
  | 'arrest'
  | 'seize'
  | 'search'
  | 'ambulance';

export interface CardInstance {
  instanceId: string;
  cardId: CardId;
}

export interface CardDef {
  cardId: CardId;
  type: CardType;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  isPublic: boolean; // attack cards are public when held
}

// ===== Players =====
export type PlayerType = 'human' | 'code_ai' | 'llm_ai';
export type LLMProvider = 'ollama' | 'openai' | 'claude' | 'gemini' | 'xai';

export interface PlayerConfig {
  name: string;
  type: PlayerType;
  llmProvider?: LLMProvider;
  llmModel?: string;
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  llmProvider?: LLMProvider;
  llmModel?: string;
  role: Role;
  health: number;
  maxHealth: number;
  hand: CardInstance[];
  isAlive: boolean;
  isIdentityRevealed: boolean; // mafia voluntary reveal
  isArrested: boolean;
  skipNextDraw: boolean; // snipe penalty
  usedSnipeThisTurn: boolean;
  usedAttackThisTurn: boolean;
  hospitalUsedThisTurn: boolean;
}

// ===== Chat =====
export type ChatType = 'public' | 'question' | 'answer' | 'refuse' | 'system';

export interface ChatMessage {
  id: string;
  turnNumber: number;
  playerId: string;
  playerName: string;
  type: ChatType;
  targetPlayerId?: string;
  targetPlayerName?: string;
  content: string;
  timestamp: number;
}

// ===== Game Phases =====
export type GamePhase =
  | 'lobby'
  | 'setup'
  | 'chat'
  | 'draw'
  | 'use_cards'
  | 'game_over';

// ===== Game State =====
export type GameMode = 'play' | 'spectate';

export interface PendingQuestion {
  askerId: string;
  targetId: string;
  content: string;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  mode: GameMode;
  players: Player[];
  currentPlayerIndex: number;
  deck: CardInstance[];
  discardPile: CardInstance[];
  chatLog: ChatMessage[];
  turnNumber: number;
  turnPhaseComplete: {
    chat: boolean;
    draw: boolean;
  };
  pendingQuestion: PendingQuestion | null;
  winner: Team | null;
  gameLog: GameEvent[];
}

// ===== Game Events =====
export type GameEventType =
  | 'game_start'
  | 'turn_start'
  | 'chat_public'
  | 'chat_question'
  | 'chat_answer'
  | 'chat_refuse'
  | 'cards_drawn'
  | 'card_used'
  | 'identity_revealed'
  | 'player_damaged'
  | 'player_healed'
  | 'player_eliminated'
  | 'player_revived'
  | 'card_destroyed'
  | 'arrest_applied'
  | 'reward_given'
  | 'penalty_applied'
  | 'turn_end'
  | 'turn_timeout'
  | 'game_over';

export interface GameEvent {
  id: string;
  type: GameEventType;
  playerId?: string;
  targetPlayerId?: string;
  data?: Record<string, unknown>;
  message: string;
  messageKo: string;
  timestamp: number;
}

// ===== Actions (client -> server) =====
export type GameAction =
  | { type: 'chat_public'; playerId: string; content: string }
  | { type: 'chat_question'; playerId: string; targetPlayerId: string; content: string }
  | { type: 'chat_answer'; playerId: string; content: string }
  | { type: 'chat_refuse'; playerId: string }
  | { type: 'skip_chat'; playerId: string }
  | { type: 'draw_cards'; playerId: string }
  | { type: 'use_card'; playerId: string; cardInstanceId: string; targetPlayerId?: string; targetCardInstanceId?: string }
  | { type: 'reveal_identity'; playerId: string }
  | { type: 'end_turn'; playerId: string };

// ===== Client View (filtered game state) =====
export interface ClientGameView {
  id: string;
  phase: GamePhase;
  mode: GameMode;
  players: ClientPlayerView[];
  currentPlayerIndex: number;
  myPlayerId: string | null;
  myHand: CardInstance[];
  deckSize: number;
  chatLog: ChatMessage[];
  turnNumber: number;
  turnPhaseComplete: {
    chat: boolean;
    draw: boolean;
  };
  pendingQuestion: PendingQuestion | null;
  winner: Team | null;
  gameLog: GameEvent[];
}

export interface ClientPlayerView {
  id: string;
  name: string;
  type: PlayerType;
  role: Role | 'unknown'; // hidden unless revealed or self
  health: number;
  maxHealth: number;
  handSize: number;
  publicCards: CardInstance[]; // attack cards (public)
  isAlive: boolean;
  isIdentityRevealed: boolean;
  isArrested: boolean;
}

// ===== Game History =====
export interface GameRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  playerCount: number;
  winner: Team;
  winnerText: string;
  mode: GameMode;
  totalTurns: number;
  players: GameRecordPlayer[];
  events: GameEvent[];
  chatLog: ChatMessage[];
}

export interface GameRecordPlayer {
  id: string;
  name: string;
  type: PlayerType;
  role: Role;
  isAlive: boolean;
  finalHealth: number;
}

// ===== Socket Events =====
export interface ServerToClientEvents {
  'game:state': (view: ClientGameView) => void;
  'game:event': (event: GameEvent) => void;
  'game:error': (message: string) => void;
  'game:ai_thinking': (playerId: string) => void;
  'game:ai_done': (playerId: string) => void;
  'game:turn_timer': (deadline: number) => void;
}

export interface ClientToServerEvents {
  'game:create': (config: GameConfig, callback: (gameId: string) => void) => void;
  'game:join': (gameId: string, playerName: string) => void;
  'game:action': (action: GameAction) => void;
  'game:spectate': (config: GameConfig, callback: (gameId: string) => void) => void;
}

export interface GameConfig {
  playerCount: number;
  players: PlayerConfig[];
  mode: GameMode;
  spectateSpeed?: number; // ms delay between AI turns in spectate mode
}

// ===== LLM =====
export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
}
