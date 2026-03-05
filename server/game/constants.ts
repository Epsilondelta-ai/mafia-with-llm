import type { CardDef, CardId, Role } from '../../shared/types.js';

export const CARD_DEFS: Record<CardId, CardDef> = {
  shot: {
    cardId: 'shot',
    type: 'attack',
    name: 'Shot',
    nameKo: '총격',
    description: 'Deal 1 damage to a target',
    descriptionKo: '대상 1명에게 1데미지',
    isPublic: true,
  },
  snipe: {
    cardId: 'snipe',
    type: 'attack',
    name: 'Snipe',
    nameKo: '저격',
    description: 'Deal 2 damage. Cannot use with Shot. No more attacks. Skip next draw.',
    descriptionKo: '대상 1명에게 2데미지. 총격과 혼용 불가. 추가 공격 불가. 다음 턴 드로 불가.',
    isPublic: true,
  },
  first_aid: {
    cardId: 'first_aid',
    type: 'heal',
    name: 'First Aid',
    nameKo: '응급처치',
    description: 'Heal 1 HP',
    descriptionKo: '체력 1 회복',
    isPublic: false,
  },
  hospital: {
    cardId: 'hospital',
    type: 'heal',
    name: 'Hospital',
    nameKo: '입원',
    description: 'Heal 2 HP. Cannot attack this turn.',
    descriptionKo: '체력 2 회복. 해당 턴 공격 불가.',
    isPublic: false,
  },
  arrest: {
    cardId: 'arrest',
    type: 'disrupt',
    name: 'Arrest',
    nameKo: '체포',
    description: "Target cannot attack next turn",
    descriptionKo: '대상의 다음 턴 공격 불가',
    isPublic: false,
  },
  seize: {
    cardId: 'seize',
    type: 'disrupt',
    name: 'Seize',
    nameKo: '압수',
    description: "Destroy one of target's public attack cards",
    descriptionKo: '대상의 공개된 공격 카드 1장 지정 파괴',
    isPublic: false,
  },
  search: {
    cardId: 'search',
    type: 'disrupt',
    name: 'Search',
    nameKo: '수색',
    description: "Destroy one of target's hidden cards randomly",
    descriptionKo: '대상의 비공개 카드 1장 랜덤 파괴',
    isPublic: false,
  },
  ambulance: {
    cardId: 'ambulance',
    type: 'special',
    name: 'Ambulance',
    nameKo: '구급차',
    description: 'Auto-activate on death. Revive with 1 HP. Permanently removed.',
    descriptionKo: '사망 시 자동 발동. 체력 1로 부활. 영구 제거.',
    isPublic: false,
  },
};

// Deck composition (without ambulance)
export const DECK_COMPOSITION: Record<CardId, number> = {
  shot: 40,
  snipe: 6,
  first_aid: 10,
  hospital: 4,
  arrest: 6,
  seize: 7,
  search: 5,
  ambulance: 0, // added separately based on player count
};

// Ambulance count by player count
export const AMBULANCE_COUNT: Record<number, number> = {
  5: 2,
  6: 3,
  7: 3,
  8: 3,
};

// Role distribution by player count
export const ROLE_DISTRIBUTION: Record<number, Record<Role, number>> = {
  5: { police: 1, citizen: 2, mafia: 2 },
  6: { police: 1, citizen: 3, mafia: 2 },
  7: { police: 1, citizen: 3, mafia: 3 },
  8: { police: 1, citizen: 4, mafia: 3 },
};

// Player health
export const BASE_HEALTH = 3;
export const POLICE_HEALTH = 4;
export const STARTING_HAND_SIZE = 1;
export const CARDS_PER_DRAW = 2;

// Rewards
export const MAFIA_REVEAL_DRAW = 2;
export const MAFIA_KILL_HEAL = 1;
export const MAFIA_KILL_DRAW = 2;

// Turn timer
export const TURN_TIME_LIMIT = 60000; // 60 seconds per action
