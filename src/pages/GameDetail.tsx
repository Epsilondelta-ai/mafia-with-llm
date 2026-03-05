import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { GameRecord, GameEvent, ChatMessage } from '@shared/types';

type Tab = 'timeline' | 'chat' | 'events';

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('timeline');
  const [filterTurn, setFilterTurn] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setRecord(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-mafia-muted">불러오는 중...</p></div>;
  }

  if (!record) {
    return (
      <div className="text-center py-8">
        <p className="text-mafia-muted">게임을 찾을 수 없습니다</p>
        <Link to="/history" className="btn-primary inline-block mt-4">목록으로</Link>
      </div>
    );
  }

  const turns = Array.from(new Set([
    ...record.events.map(e => {
      const turnData = e.data?.turnNumber as number | undefined;
      if (turnData !== undefined) return turnData;
      // Find closest turn_start event before this event
      return null;
    }),
    ...record.chatLog.map(m => m.turnNumber),
  ].filter((t): t is number => t !== null))).sort((a, b) => a - b);

  // Build timeline: merge events and chat by timestamp
  const timelineItems = buildTimeline(record.events, record.chatLog, filterTurn);

  const roleLabel = (role: string) => role === 'police' ? '경찰' : role === 'citizen' ? '시민' : '마피아';
  const roleColor = (role: string) => role === 'police' ? 'text-mafia-police' : role === 'citizen' ? 'text-mafia-citizen' : 'text-mafia-accent';

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/history" className="text-mafia-muted hover:text-mafia-text text-sm">&larr; 목록</Link>
        <h1 className="text-xl font-bold flex-1">게임 상세</h1>
      </div>

      {/* Game Info */}
      <div className="card-base">
        <div className={`text-lg font-bold ${record.winner === 'citizen_team' ? 'text-mafia-citizen' : 'text-mafia-accent'}`}>
          {record.winnerText}
        </div>
        <div className="text-xs text-mafia-muted mt-1">
          {record.playerCount}인 | {record.totalTurns}턴 | {record.mode === 'spectate' ? '관전' : '플레이'} |{' '}
          {new Date(record.startedAt).toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </div>
        {/* Players */}
        <div className="mt-3 flex flex-wrap gap-2">
          {record.players.map(p => (
            <span
              key={p.id}
              className={`text-xs px-2 py-1 rounded ${p.isAlive ? 'bg-mafia-card' : 'bg-mafia-surface opacity-60 line-through'}`}
            >
              <span className={roleColor(p.role)}>{p.name}</span>
              <span className="text-mafia-muted"> ({roleLabel(p.role)}) HP:{p.finalHealth}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Turn Filter */}
      {turns.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-mafia-muted shrink-0">턴:</span>
          <button
            onClick={() => setFilterTurn(null)}
            className={`text-xs px-2 py-0.5 rounded shrink-0 ${filterTurn === null ? 'bg-mafia-accent text-white' : 'bg-mafia-card text-mafia-muted hover:text-mafia-text'}`}
          >
            전체
          </button>
          {turns.map(t => (
            <button
              key={t}
              onClick={() => setFilterTurn(t)}
              className={`text-xs px-2 py-0.5 rounded shrink-0 ${filterTurn === t ? 'bg-mafia-accent text-white' : 'bg-mafia-card text-mafia-muted hover:text-mafia-text'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-mafia-card">
        {([['timeline', '타임라인'], ['chat', '대화'], ['events', '이벤트']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-mafia-accent text-mafia-accent' : 'border-transparent text-mafia-muted hover:text-mafia-text'
            }`}
          >
            {label}
            <span className="ml-1 text-xs text-mafia-muted">
              ({key === 'timeline' ? timelineItems.length : key === 'chat' ? getFilteredChat(record.chatLog, filterTurn).length : getFilteredEvents(record.events, filterTurn).length})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card-base max-h-[60vh] overflow-y-auto">
        {tab === 'timeline' && <TimelineView items={timelineItems} />}
        {tab === 'chat' && <ChatView messages={getFilteredChat(record.chatLog, filterTurn)} />}
        {tab === 'events' && <EventsView events={getFilteredEvents(record.events, filterTurn)} />}
      </div>
    </div>
  );
}

// ===== Timeline (merged chat + events) =====

interface TimelineItem {
  type: 'chat' | 'event';
  timestamp: number;
  chat?: ChatMessage;
  event?: GameEvent;
}

function buildTimeline(events: GameEvent[], chatLog: ChatMessage[], filterTurn: number | null): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const e of getFilteredEvents(events, filterTurn)) {
    items.push({ type: 'event', timestamp: e.timestamp, event: e });
  }
  for (const m of getFilteredChat(chatLog, filterTurn)) {
    items.push({ type: 'chat', timestamp: m.timestamp, chat: m });
  }

  items.sort((a, b) => a.timestamp - b.timestamp);
  return items;
}

function getFilteredEvents(events: GameEvent[], filterTurn: number | null): GameEvent[] {
  if (filterTurn === null) return events;
  // Filter events between turn_start of filterTurn and next turn_start
  let inRange = false;
  const result: GameEvent[] = [];
  for (const e of events) {
    if (e.type === 'turn_start' && (e.data?.turnNumber as number) === filterTurn) {
      inRange = true;
    } else if (e.type === 'turn_start' && inRange) {
      break;
    }
    if (inRange) result.push(e);
  }
  // Also include game_start/game_over if they match
  if (filterTurn === 0) {
    const gameStart = events.find(e => e.type === 'game_start');
    if (gameStart && !result.includes(gameStart)) result.unshift(gameStart);
  }
  return result;
}

function getFilteredChat(chatLog: ChatMessage[], filterTurn: number | null): ChatMessage[] {
  if (filterTurn === null) return chatLog;
  return chatLog.filter(m => m.turnNumber === filterTurn);
}

// ===== Sub-views =====

function TimelineView({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-mafia-muted text-sm text-center py-4">기록이 없습니다</p>;

  let lastTurn: number | null = null;

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        let turnHeader: React.ReactNode = null;
        const turn = item.type === 'event' && item.event?.type === 'turn_start'
          ? (item.event.data?.turnNumber as number)
          : null;

        if (turn !== null && turn !== lastTurn) {
          lastTurn = turn;
          turnHeader = (
            <div className="text-xs font-bold text-mafia-gold mt-3 mb-1 border-b border-mafia-card pb-1">
              --- 턴 {turn} ---
            </div>
          );
        }

        return (
          <div key={i}>
            {turnHeader}
            {item.type === 'chat' && item.chat ? (
              <ChatItem msg={item.chat} />
            ) : item.event ? (
              <EventItem event={item.event} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ChatView({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) return <p className="text-mafia-muted text-sm text-center py-4">대화 기록이 없습니다</p>;

  let lastTurn: number | null = null;

  return (
    <div className="space-y-1">
      {messages.map((msg, i) => {
        let turnHeader: React.ReactNode = null;
        if (msg.turnNumber !== lastTurn) {
          lastTurn = msg.turnNumber;
          turnHeader = (
            <div className="text-xs font-bold text-mafia-gold mt-3 mb-1 border-b border-mafia-card pb-1">
              --- 턴 {msg.turnNumber} ---
            </div>
          );
        }
        return (
          <div key={i}>
            {turnHeader}
            <ChatItem msg={msg} />
          </div>
        );
      })}
    </div>
  );
}

function EventsView({ events }: { events: GameEvent[] }) {
  if (events.length === 0) return <p className="text-mafia-muted text-sm text-center py-4">이벤트가 없습니다</p>;

  return (
    <div className="space-y-1">
      {events.map((event, i) => (
        <EventItem key={i} event={event} />
      ))}
    </div>
  );
}

// ===== Individual items =====

function ChatItem({ msg }: { msg: ChatMessage }) {
  return (
    <div className="text-sm flex items-start gap-1 py-0.5">
      <span className="text-mafia-muted text-xs shrink-0 w-5">💬</span>
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
  );
}

const eventIcons: Record<string, string> = {
  game_start: '🎮', turn_start: '🔄', cards_drawn: '🃏', card_used: '⚡',
  player_damaged: '💥', player_healed: '💚', player_eliminated: '💀', player_revived: '🚑',
  identity_revealed: '👁', arrest_applied: '🔒', reward_given: '🎁', penalty_applied: '⚠️',
  game_over: '🏆', card_destroyed: '🗑', chat_public: '💬', chat_question: '❓',
  chat_answer: '💡', chat_refuse: '🚫', turn_end: '⏹', turn_timeout: '⏰',
  seize_applied: '✋', search_applied: '🔍',
};

function EventItem({ event }: { event: GameEvent }) {
  const icon = eventIcons[event.type] || '📋';
  const isImportant = ['player_eliminated', 'player_revived', 'identity_revealed', 'game_over', 'game_start'].includes(event.type);

  return (
    <div className={`text-xs flex items-start gap-1.5 py-0.5 ${isImportant ? 'font-medium' : ''}`}>
      <span className="shrink-0 w-5">{icon}</span>
      <span className={isImportant ? 'text-mafia-gold' : 'text-mafia-text'}>{event.messageKo}</span>
    </div>
  );
}
