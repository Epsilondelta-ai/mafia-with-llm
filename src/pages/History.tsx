import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GameRecord, GameEvent, ChatMessage } from '@shared/types';

type GameRecordSummary = Omit<GameRecord, 'events' | 'chatLog'>;

export default function History() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<GameRecordSummary[]>([]);
  const [stats, setStats] = useState<{ total: number; citizenWins: number; mafiaWins: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/games').then(r => r.json()),
      fetch('/api/games/stats').then(r => r.json()),
    ]).then(([games, statsData]) => {
      setRecords(games);
      setStats(statsData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/games/${id}`, { method: 'DELETE' });
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-mafia-muted">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold">게임 기록</h1>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="card-base grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-mafia-text">{stats.total}</div>
            <div className="text-xs text-mafia-muted">총 게임</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-mafia-citizen">{stats.citizenWins}</div>
            <div className="text-xs text-mafia-muted">시민 승리</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-mafia-accent">{stats.mafiaWins}</div>
            <div className="text-xs text-mafia-muted">마피아 승리</div>
          </div>
        </div>
      )}

      {/* Game list */}
      {records.length === 0 ? (
        <div className="card-base text-center py-8">
          <p className="text-mafia-muted">아직 게임 기록이 없습니다</p>
          <Link to="/" className="btn-primary inline-block mt-4">
            첫 게임 시작하기
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(record => (
            <div
              key={record.id}
              className="card-base cursor-pointer hover:ring-1 hover:ring-mafia-accent/50 transition-all"
              onClick={() => navigate(`/history/${record.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-sm font-bold ${
                    record.winner === 'citizen_team' ? 'text-mafia-citizen' : 'text-mafia-accent'
                  }`}>
                    {record.winnerText}
                  </div>
                  <div className="text-xs text-mafia-muted mt-1">
                    {record.playerCount}인 | {record.totalTurns}턴 |{' '}
                    {record.mode === 'spectate' ? '관전' : '플레이'}
                  </div>
                  <div className="text-xs text-mafia-muted">
                    {new Date(record.startedAt).toLocaleDateString('ko-KR', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    {record.players.map(p => (
                      <div key={p.id} className={`text-xs ${p.isAlive ? 'text-mafia-text' : 'text-mafia-muted line-through'}`}>
                        {p.name} ({p.role === 'police' ? '경찰' : p.role === 'citizen' ? '시민' : '마피아'})
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
                    className="text-mafia-muted hover:text-red-400 text-xs p-1"
                    title="삭제"
                  >
                    X
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
