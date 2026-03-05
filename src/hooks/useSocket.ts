import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, GameConfig, GameAction } from '@shared/types';
import { useGameStore } from '../store/gameStore';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<TypedSocket>(getSocket());
  const { setView, addEvent, setConnected, setAiThinking, setError, setTurnDeadline } = useGameStore();

  useEffect(() => {
    const socket = socketRef.current;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('game:state', (view) => setView(view));
    socket.on('game:event', (event) => addEvent(event));
    socket.on('game:error', (msg) => setError(msg));
    socket.on('game:ai_thinking', (id) => setAiThinking(id));
    socket.on('game:ai_done', () => setAiThinking(null));
    socket.on('game:turn_timer', (deadline) => setTurnDeadline(deadline));

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('game:state');
      socket.off('game:event');
      socket.off('game:error');
      socket.off('game:ai_thinking');
      socket.off('game:ai_done');
      socket.off('game:turn_timer');
    };
  }, [setView, addEvent, setConnected, setAiThinking, setError, setTurnDeadline]);

  const createGame = useCallback((config: GameConfig): Promise<string> => {
    return new Promise((resolve) => {
      socketRef.current.emit('game:create', config, (gameId) => resolve(gameId));
    });
  }, []);

  const spectateGame = useCallback((config: GameConfig): Promise<string> => {
    return new Promise((resolve) => {
      socketRef.current.emit('game:spectate', config, (gameId) => resolve(gameId));
    });
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    socketRef.current.emit('game:action', action);
  }, []);

  return { createGame, spectateGame, sendAction };
}
