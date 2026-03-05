import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ServerToClientEvents, ClientToServerEvents, GameConfig, GameAction,
  GameEvent, Player, ClientGameView,
} from '../shared/types.js';
import { GameEngine } from './game/GameEngine.js';
import { CodeAI } from './ai/CodeAI.js';
import { LLMPlayer } from './ai/LLMPlayer.js';
import { createProvider } from './ai/providerFactory.js';
import { saveGameRecord } from './db/history.js';
import { getDb } from './db/index.js';
import historyRouter from './routes/history.js';
import { TURN_TIME_LIMIT } from './game/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3002');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', historyRouter);

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

// Active game sessions
const games = new Map<string, {
  engine: GameEngine;
  codeAI: CodeAI;
  llmPlayers: Map<string, LLMPlayer>;
  startedAt: string;
  spectateSpeed: number;
}>();

// Socket-to-player mapping for personalized views
const socketPlayerMap = new Map<string, { gameId: string; playerId: string | null }>();

// AI turn concurrency guard
const aiRunning = new Set<string>();

// Turn timers for human players
const turnTimers = new Map<string, NodeJS.Timeout>();

// Initialize DB
getDb();

io.on('connection', (socket) => {
  let currentGameId: string | null = null;
  let myPlayerId: string | null = null;

  socket.on('game:create', (config: GameConfig, callback) => {
    const startedAt = new Date().toISOString();
    const codeAI = new CodeAI();
    const llmPlayers = new Map<string, LLMPlayer>();

    let gameId = '';
    const engine = new GameEngine(config, (event: GameEvent) => {
      if (gameId) io.to(gameId).emit('game:event', event);
    });

    gameId = engine.getGameId();
    currentGameId = gameId;

    // Set up AI players
    const state = engine.getState();
    for (const player of state.players) {
      if (player.type === 'llm_ai' && player.llmProvider) {
        const provider = createProvider(player.llmProvider, player.llmModel);
        llmPlayers.set(player.id, new LLMPlayer(provider));
      }
      if (player.type === 'human') {
        myPlayerId = player.id;
      }
    }

    games.set(gameId, { engine, codeAI, llmPlayers, startedAt, spectateSpeed: config.spectateSpeed || 2000 });
    socket.join(gameId);
    socketPlayerMap.set(socket.id, { gameId, playerId: myPlayerId });

    callback(gameId);

    // Send initial state
    broadcastState(gameId);

    // If first player is AI, trigger their turn; otherwise start timer
    const currentType = engine.getCurrentPlayerType();
    if (currentType.type !== 'human') {
      setTimeout(() => processAITurn(gameId), 1000);
    } else {
      startTurnTimer(gameId);
    }
  });

  socket.on('game:spectate', (config: GameConfig, callback) => {
    // All players are AI in spectate mode
    config.mode = 'spectate';
    const startedAt = new Date().toISOString();
    const codeAI = new CodeAI();
    const llmPlayers = new Map<string, LLMPlayer>();

    let gameId = '';
    const engine = new GameEngine(config, (event: GameEvent) => {
      if (gameId) io.to(gameId).emit('game:event', event);
    });

    gameId = engine.getGameId();
    currentGameId = gameId;
    myPlayerId = null;

    const state = engine.getState();
    for (const player of state.players) {
      if (player.type === 'llm_ai' && player.llmProvider) {
        const provider = createProvider(player.llmProvider, player.llmModel);
        llmPlayers.set(player.id, new LLMPlayer(provider));
      }
    }

    games.set(gameId, { engine, codeAI, llmPlayers, startedAt, spectateSpeed: config.spectateSpeed || 2000 });
    socket.join(gameId);
    socketPlayerMap.set(socket.id, { gameId, playerId: null });
    callback(gameId);
    broadcastState(gameId);

    // Start AI loop
    setTimeout(() => processAITurn(gameId), 1500);
  });

  socket.on('game:join', (gameId: string, playerName: string) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('game:error', 'Game not found');
      return;
    }
    currentGameId = gameId;
    socket.join(gameId);
    broadcastState(gameId);
  });

  socket.on('game:action', (action: GameAction) => {
    if (!currentGameId) return;
    const game = games.get(currentGameId);
    if (!game) return;

    const result = game.engine.processAction(action);
    if (!result.success) {
      socket.emit('game:error', result.error || 'Invalid action');
      return;
    }

    broadcastState(currentGameId);

    // If there's a pending question targeting an AI, trigger their answer
    const pending = game.engine.getPendingQuestion();
    if (pending) {
      const targetPlayer = game.engine.getPlayerById(pending.targetId);
      if (targetPlayer.type !== 'human') {
        const gId = currentGameId;
        setTimeout(() => processAIAnswer(gId, pending.targetId, pending.content, pending.askerId), 500);
      } else {
        // Human target needs to answer — restart timer for answer
        startTurnTimer(currentGameId);
      }
      return;
    }

    // Check if game over
    if (game.engine.isGameOver()) {
      clearTurnTimer(currentGameId);
      handleGameOver(currentGameId);
      return;
    }

    // If next player is AI, trigger their turn; otherwise restart timer
    const currentType = game.engine.getCurrentPlayerType();
    if (currentType.type !== 'human') {
      clearTurnTimer(currentGameId);
      setTimeout(() => processAITurn(currentGameId!), 500);
    } else {
      startTurnTimer(currentGameId);
    }
  });

  socket.on('disconnect', () => {
    socketPlayerMap.delete(socket.id);
  });
});

// ===== AI Turn Processing =====

async function processAITurn(gameId: string): Promise<void> {
  if (aiRunning.has(gameId)) return; // prevent concurrent AI turns
  aiRunning.add(gameId);

  try {
    const game = games.get(gameId);
    if (!game || game.engine.isGameOver()) return;

    const engine = game.engine;
    const state = engine.getState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    const playerId = currentPlayer.id;
    const view = engine.getClientView(playerId);

    io.to(gameId).emit('game:ai_thinking', playerId);

    const delay = state.mode === 'spectate' ? game.spectateSpeed : 500;

    try {
      if (currentPlayer.type === 'code_ai') {
        await processCodeAITurn(game, engine, view, currentPlayer, gameId, delay);
      } else if (currentPlayer.type === 'llm_ai') {
        await processLLMAITurn(game, engine, view, currentPlayer, gameId, delay);
      }
    } catch (error) {
      console.error('AI turn error:', error);
      engine.processAction({ type: 'end_turn', playerId });
    }

    io.to(gameId).emit('game:ai_done', playerId);
    broadcastState(gameId);

    if (engine.isGameOver()) {
      clearTurnTimer(gameId);
      handleGameOver(gameId);
      return;
    }

    // Continue with next AI player or start human timer
    const nextType = engine.getCurrentPlayerType();
    if (nextType.type !== 'human') {
      setTimeout(() => processAITurn(gameId), delay);
    } else {
      startTurnTimer(gameId);
    }
  } finally {
    aiRunning.delete(gameId);
  }
}

async function processCodeAITurn(
  game: ReturnType<typeof games.get> & {},
  engine: GameEngine,
  view: ClientGameView,
  player: Player,
  gameId: string,
  delay: number,
): Promise<void> {
  // Chat phase
  if (engine.getPhase() === 'chat') {
    const chatAction = game.codeAI.decideAction(view, player);
    engine.processAction(chatAction);
    broadcastState(gameId);
    await sleep(delay);

    // If AI asked a question, handle the answer
    const pending = engine.getPendingQuestion();
    if (pending) {
      await processAIAnswer(gameId, pending.targetId, pending.content, pending.askerId);
      await sleep(delay);
    }
  }

  // Draw phase
  if (engine.getPhase() === 'draw') {
    engine.processAction({ type: 'draw_cards', playerId: player.id });
    broadcastState(gameId);
    await sleep(delay);
  }

  // Use cards phase - multiple actions possible (no limit per design rules)
  if (engine.getPhase() === 'use_cards') {
    let maxActions = 15; // Safety cap; design says "제한 없음"
    while (engine.getPhase() === 'use_cards' && maxActions > 0) {
      const updatedView = engine.getClientView(player.id);
      const updatedPlayer = engine.getState().players.find(p => p.id === player.id)!;
      const action = game.codeAI.decideAction(updatedView, updatedPlayer);

      if (action.type === 'end_turn') {
        engine.processAction(action);
        break;
      }

      const result = engine.processAction(action);
      if (!result.success) {
        engine.processAction({ type: 'end_turn', playerId: player.id });
        break;
      }

      broadcastState(gameId);
      await sleep(delay);
      maxActions--;
    }

    // Safety: force end turn
    if (engine.getPhase() === 'use_cards') {
      engine.processAction({ type: 'end_turn', playerId: player.id });
    }
  }
}

async function processLLMAITurn(
  game: ReturnType<typeof games.get> & {},
  engine: GameEngine,
  view: ClientGameView,
  player: Player,
  gameId: string,
  delay: number,
): Promise<void> {
  const llmPlayer = game.llmPlayers.get(player.id);
  if (!llmPlayer) {
    // Fallback to code AI
    return processCodeAITurn(game, engine, view, player, gameId, delay);
  }

  // Chat phase
  if (engine.getPhase() === 'chat') {
    const chatAction = await llmPlayer.decideAction(view, player);
    engine.processAction(chatAction);
    broadcastState(gameId);
    await sleep(delay);

    // If AI asked a question, handle the answer
    const pending = engine.getPendingQuestion();
    if (pending) {
      await processAIAnswer(gameId, pending.targetId, pending.content, pending.askerId);
      await sleep(delay);
    }
  }

  // Draw phase
  if (engine.getPhase() === 'draw') {
    engine.processAction({ type: 'draw_cards', playerId: player.id });
    broadcastState(gameId);
    await sleep(delay);
  }

  // Use cards phase - multiple actions possible (no limit per design rules)
  if (engine.getPhase() === 'use_cards') {
    let maxActions = 15; // Safety cap; design says "제한 없음"
    while (engine.getPhase() === 'use_cards' && maxActions > 0) {
      const updatedView = engine.getClientView(player.id);
      const updatedPlayer = engine.getState().players.find(p => p.id === player.id)!;
      const action = await llmPlayer.decideAction(updatedView, updatedPlayer);

      if (action.type === 'end_turn') {
        engine.processAction(action);
        break;
      }

      const result = engine.processAction(action);
      if (!result.success) {
        engine.processAction({ type: 'end_turn', playerId: player.id });
        break;
      }

      broadcastState(gameId);
      await sleep(delay);
      maxActions--;
    }

    if (engine.getPhase() === 'use_cards') {
      engine.processAction({ type: 'end_turn', playerId: player.id });
    }
  }
}

// ===== AI Answer Processing =====

async function processAIAnswer(gameId: string, targetId: string, question: string, askerId: string): Promise<void> {
  const game = games.get(gameId);
  if (!game || game.engine.isGameOver()) return;

  const targetPlayer = game.engine.getPlayerById(targetId);
  const view = game.engine.getClientView(targetId);
  const delay = game.engine.getState().mode === 'spectate' ? game.spectateSpeed : 500;

  io.to(gameId).emit('game:ai_thinking', targetId);

  let answerAction: GameAction;

  if (targetPlayer.type === 'llm_ai') {
    const llmPlayer = game.llmPlayers.get(targetId);
    if (llmPlayer) {
      answerAction = await llmPlayer.generateAnswer(view, targetPlayer, question, askerId);
    } else {
      answerAction = game.codeAI.generateAnswer(view, targetPlayer);
    }
  } else {
    // code_ai: 30% refuse
    answerAction = game.codeAI.generateRefusal(view, targetPlayer);
  }

  await sleep(delay);
  game.engine.processAction(answerAction);

  io.to(gameId).emit('game:ai_done', targetId);
  broadcastState(gameId);

  if (game.engine.isGameOver()) {
    clearTurnTimer(gameId);
    handleGameOver(gameId);
    return;
  }

  // Continue with current player's turn (next phase after chat)
  const nextType = game.engine.getCurrentPlayerType();
  if (nextType.type !== 'human') {
    setTimeout(() => processAITurn(gameId), delay);
  } else {
    startTurnTimer(gameId);
  }
}

// ===== Turn Timer =====

function startTurnTimer(gameId: string): void {
  clearTurnTimer(gameId);
  const game = games.get(gameId);
  if (!game || game.engine.isGameOver()) return;

  const currentType = game.engine.getCurrentPlayerType();
  if (currentType.type !== 'human') return; // AI doesn't need timer

  const deadline = Date.now() + TURN_TIME_LIMIT;
  io.to(gameId).emit('game:turn_timer', deadline);

  turnTimers.set(gameId, setTimeout(() => {
    forceAdvanceTurn(gameId);
  }, TURN_TIME_LIMIT));
}

function clearTurnTimer(gameId: string): void {
  const timer = turnTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(gameId);
  }
  io.to(gameId).emit('game:turn_timer', 0);
}

function forceAdvanceTurn(gameId: string): void {
  const game = games.get(gameId);
  if (!game || game.engine.isGameOver()) return;

  const playerId = game.engine.getCurrentPlayerId();
  const phase = game.engine.getPhase();

  // If there's a pending question, auto-refuse on timeout
  const pending = game.engine.getPendingQuestion();
  if (pending) {
    game.engine.processAction({ type: 'chat_refuse', playerId: pending.targetId });
    broadcastState(gameId);
    // Continue flow after answer
    const nextType = game.engine.getCurrentPlayerType();
    if (nextType.type !== 'human') {
      setTimeout(() => processAITurn(gameId), 500);
    } else {
      startTurnTimer(gameId);
    }
    return;
  }

  // Only advance ONE phase per timeout (timer resets after each action)
  if (phase === 'chat') {
    game.engine.processAction({ type: 'skip_chat', playerId });
  } else if (phase === 'draw') {
    game.engine.processAction({ type: 'draw_cards', playerId });
  } else if (phase === 'use_cards') {
    game.engine.processAction({ type: 'end_turn', playerId });
  }

  broadcastState(gameId);

  if (game.engine.isGameOver()) {
    handleGameOver(gameId);
    return;
  }

  // Continue with next player or reset timer for next phase
  const nextType = game.engine.getCurrentPlayerType();
  if (nextType.type !== 'human') {
    setTimeout(() => processAITurn(gameId), 500);
  } else {
    startTurnTimer(gameId);
  }
}

// ===== Helpers =====

function broadcastState(gameId: string): void {
  const game = games.get(gameId);
  if (!game) return;

  const sockets = io.sockets.adapter.rooms.get(gameId);
  if (!sockets) return;

  for (const socketId of sockets) {
    const mapping = socketPlayerMap.get(socketId);
    const playerId = mapping?.playerId ?? null;
    const view = game.engine.getClientView(playerId);
    io.to(socketId).emit('game:state', view);
  }
}

function handleGameOver(gameId: string): void {
  const game = games.get(gameId);
  if (!game) return;

  const state = game.engine.getState();
  if (!state.winner) return;

  const players = state.players.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    role: p.role,
    isAlive: p.isAlive,
    finalHealth: p.health,
  }));

  saveGameRecord(
    state.id,
    state.winner,
    state.mode,
    state.turnNumber,
    players,
    state.gameLog,
    state.chatLog,
    game.startedAt,
  );

  // Clean up after a delay
  clearTurnTimer(gameId);
  setTimeout(() => games.delete(gameId), 60000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Mafia server running on http://localhost:${PORT}`);
});
