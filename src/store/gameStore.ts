import { create } from 'zustand';
import type { ClientGameView, GameEvent } from '@shared/types';

interface GameStore {
  view: ClientGameView | null;
  events: GameEvent[];
  connected: boolean;
  aiThinking: string | null; // player ID of thinking AI
  error: string | null;
  turnDeadline: number | null; // timestamp when turn expires

  setView: (view: ClientGameView) => void;
  addEvent: (event: GameEvent) => void;
  setConnected: (connected: boolean) => void;
  setAiThinking: (playerId: string | null) => void;
  setError: (error: string | null) => void;
  setTurnDeadline: (deadline: number | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  view: null,
  events: [],
  connected: false,
  aiThinking: null,
  error: null,
  turnDeadline: null,

  setView: (view) => set({ view }),
  addEvent: (event) => set((s) => ({ events: [...s.events.slice(-100), event] })),
  setConnected: (connected) => set({ connected }),
  setAiThinking: (playerId) => set({ aiThinking: playerId }),
  setError: (error) => set({ error }),
  setTurnDeadline: (deadline) => set({ turnDeadline: deadline && deadline > 0 ? deadline : null }),
  reset: () => set({ view: null, events: [], aiThinking: null, error: null, turnDeadline: null }),
}));
