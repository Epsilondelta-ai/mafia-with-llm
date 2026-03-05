import { useRef, useEffect } from 'react';
import type { ChatMessage } from '@shared/types';

interface Props {
  messages: ChatMessage[];
}

export default function ChatLog({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div className="card-base">
      <div className="text-xs text-mafia-muted mb-2 font-medium">채팅 로그</div>
      <div className="max-h-48 overflow-y-auto space-y-1.5">
        {messages.slice(-20).map(msg => (
          <div key={msg.id} className="text-sm">
            {msg.type === 'system' ? (
              <span className="text-mafia-gold italic">{msg.content}</span>
            ) : msg.type === 'question' ? (
              <span>
                <span className="text-mafia-accent font-medium">{msg.playerName}</span>
                <span className="text-mafia-muted"> → </span>
                <span className="text-mafia-police font-medium">{msg.targetPlayerName}</span>
                <span className="text-mafia-muted">: </span>
                <span className="text-mafia-text">{msg.content}</span>
              </span>
            ) : msg.type === 'answer' ? (
              <span>
                <span className="text-mafia-police font-medium">{msg.playerName}</span>
                <span className="text-mafia-citizen"> (답변)</span>
                <span className="text-mafia-muted">: </span>
                <span className="text-mafia-text">{msg.content}</span>
              </span>
            ) : msg.type === 'refuse' ? (
              <span>
                <span className="text-mafia-police font-medium">{msg.playerName}</span>
                <span className="text-yellow-500"> (답변 거부)</span>
              </span>
            ) : (
              <span>
                <span className="text-mafia-accent font-medium">{msg.playerName}</span>
                <span className="text-mafia-muted">: </span>
                <span className="text-mafia-text">{msg.content}</span>
              </span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
