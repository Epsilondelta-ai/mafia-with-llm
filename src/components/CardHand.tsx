import type { CardInstance, ClientPlayerView } from '@shared/types';

const CARD_INFO: Record<string, { nameKo: string; type: string; color: string; desc: string }> = {
  shot: { nameKo: '총격', type: 'attack', color: 'border-red-500 bg-red-500/10', desc: '1 데미지' },
  snipe: { nameKo: '저격', type: 'attack', color: 'border-red-700 bg-red-700/10', desc: '2 데미지' },
  first_aid: { nameKo: '응급처치', type: 'heal', color: 'border-green-500 bg-green-500/10', desc: '체력 +1' },
  hospital: { nameKo: '입원', type: 'heal', color: 'border-green-700 bg-green-700/10', desc: '체력 +2' },
  arrest: { nameKo: '체포', type: 'disrupt', color: 'border-yellow-500 bg-yellow-500/10', desc: '공격 봉쇄' },
  seize: { nameKo: '압수', type: 'disrupt', color: 'border-yellow-600 bg-yellow-600/10', desc: '카드 파괴' },
  search: { nameKo: '수색', type: 'disrupt', color: 'border-yellow-700 bg-yellow-700/10', desc: '랜덤 파괴' },
  ambulance: { nameKo: '구급차', type: 'special', color: 'border-blue-500 bg-blue-500/10', desc: '자동 부활' },
};

interface Props {
  cards: CardInstance[];
  canUse: boolean;
  selectedCard: string | null;
  onSelectCard: (id: string | null) => void;
  onUseCard: (cardInstanceId: string, targetPlayerId?: string) => void;
  targetPlayers: ClientPlayerView[];
  selectedTarget: string | null;
  onSelectTarget: (id: string | null) => void;
}

export default function CardHand({ cards, canUse, selectedCard, onSelectCard, onUseCard, targetPlayers, selectedTarget, onSelectTarget }: Props) {
  const selectedCardInfo = selectedCard ? CARD_INFO[cards.find(c => c.instanceId === selectedCard)?.cardId || ''] : null;
  const needsTarget = selectedCardInfo && (selectedCardInfo.type === 'attack' || selectedCardInfo.type === 'disrupt');

  return (
    <div className="card-base">
      <div className="text-xs text-mafia-muted mb-2 font-medium">
        내 손패 ({cards.length}장)
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {cards.map(card => {
          const info = CARD_INFO[card.cardId] || { nameKo: card.cardId, type: '', color: 'border-gray-500', desc: '' };
          const isSelected = selectedCard === card.instanceId;

          return (
            <button
              key={card.instanceId}
              onClick={() => {
                if (!canUse) return;
                if (isSelected) {
                  // If no target needed, use directly
                  if (!needsTarget) {
                    onUseCard(card.instanceId);
                  } else {
                    onSelectCard(null);
                  }
                } else {
                  onSelectCard(card.instanceId);
                  onSelectTarget(null);
                }
              }}
              disabled={!canUse}
              className={`shrink-0 w-20 p-2 rounded-lg border-2 text-center transition-all ${info.color} ${
                isSelected ? 'ring-2 ring-mafia-accent scale-105' : ''
              } ${canUse ? 'cursor-pointer active:scale-95' : 'opacity-60 cursor-default'}`}
            >
              <div className="text-sm font-bold">{info.nameKo}</div>
              <div className="text-[10px] text-mafia-muted mt-1">{info.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Target selection for cards that need it */}
      {canUse && selectedCard && needsTarget && (
        <div className="mt-3 pt-3 border-t border-mafia-card">
          <div className="text-xs text-mafia-muted mb-2">대상을 선택하세요:</div>
          <div className="flex flex-wrap gap-2">
            {targetPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectTarget(p.id);
                  onUseCard(selectedCard!, p.id);
                }}
                className={`px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  selectedTarget === p.id
                    ? 'bg-mafia-accent text-white'
                    : 'bg-mafia-card text-mafia-text hover:bg-mafia-accent/30'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
