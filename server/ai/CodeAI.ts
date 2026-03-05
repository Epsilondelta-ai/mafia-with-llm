import type {
  Player, GameAction, ClientGameView, CardInstance, CardId,
} from '../../shared/types.js';
import { CARD_DEFS } from '../game/constants.js';

// Rule-based AI: probability-driven decisions with template messages
export class CodeAI {
  private templates = {
    police: {
      public: [
        '수상한 움직임이 감지되었습니다. 모두 주의하세요.',
        '마피아의 행동 패턴을 분석 중입니다.',
        '시민 여러분, 협력해서 마피아를 찾아냅시다.',
      ],
      question: [
        '당신의 역할에 대해 설명해 주시겠습니까?',
        '지난 턴에 왜 그런 행동을 했습니까?',
        '누가 가장 의심스럽다고 생각합니까?',
      ],
    },
    citizen: {
      public: [
        '저는 시민입니다. 마피아를 찾아야 합니다.',
        '모두 침착하게 행동합시다.',
        '공격 카드가 많다고 마피아는 아닙니다.',
      ],
      question: [
        '혹시 마피아 아닌가요?',
        '왜 그 사람을 공격했나요?',
        '당신은 누구를 의심하고 있나요?',
      ],
    },
    mafia: {
      public: [
        '저는 시민입니다. 함께 마피아를 찾읍시다.',
        '저 사람이 좀 수상해 보입니다.',
        '경찰을 도와서 마피아를 찾아야 합니다.',
      ],
      question: [
        '혹시 다른 의심 가는 사람이 있나요?',
        '왜 저를 의심하시는 건가요?',
        '그 행동의 이유가 뭔가요?',
      ],
    },
    answer: [
      '저는 시민입니다.',
      '그건 전략적인 판단이었습니다.',
      '마피아가 아닙니다. 믿어주세요.',
      '상황을 좀 더 지켜봐야 할 것 같습니다.',
    ],
  };

  decideAction(view: ClientGameView, player: Player): GameAction {
    switch (view.phase) {
      case 'chat': return this.decideChat(view, player);
      case 'draw': return { type: 'draw_cards', playerId: player.id };
      case 'use_cards': return this.decideCardUse(view, player);
      default: return { type: 'end_turn', playerId: player.id };
    }
  }

  generateAnswer(_view: ClientGameView, player: Player): GameAction {
    const content = this.pickRandom(this.templates.answer);
    return { type: 'chat_answer', playerId: player.id, content };
  }

  generateRefusal(_view: ClientGameView, player: Player): GameAction {
    // 30% chance to refuse
    if (Math.random() < 0.3) {
      return { type: 'chat_refuse', playerId: player.id };
    }
    const content = this.pickRandom(this.templates.answer);
    return { type: 'chat_answer', playerId: player.id, content };
  }

  private decideChat(view: ClientGameView, player: Player): GameAction {
    const role = player.role;
    const templates = this.templates[role];

    // 20% skip, 50% public, 30% question
    const roll = Math.random();

    if (roll < 0.2) {
      return { type: 'skip_chat', playerId: player.id };
    }

    if (roll < 0.7) {
      return {
        type: 'chat_public',
        playerId: player.id,
        content: this.pickRandom(templates.public),
      };
    }

    // Question: pick a random alive player that isn't self
    const targets = view.players.filter(p => p.id !== player.id && p.isAlive);
    if (targets.length === 0) {
      return { type: 'skip_chat', playerId: player.id };
    }

    const target = this.pickRandom(targets);
    return {
      type: 'chat_question',
      playerId: player.id,
      targetPlayerId: target.id,
      content: this.pickRandom(templates.question),
    };
  }

  private decideCardUse(view: ClientGameView, player: Player): GameAction {
    const hand = player.hand;

    // Priority: heal if low health, attack enemies, disrupt, then end turn
    if (player.health <= 1) {
      const healCard = this.findCard(hand, ['hospital', 'first_aid']);
      if (healCard) {
        return { type: 'use_card', playerId: player.id, cardInstanceId: healCard.instanceId };
      }
    }

    // Mafia: consider revealing if advantageous (low health enemies, have attack cards)
    if (player.role === 'mafia' && !player.isIdentityRevealed) {
      const attackCards = hand.filter(c => CARD_DEFS[c.cardId].type === 'attack');
      if (attackCards.length >= 3 && Math.random() < 0.3) {
        return { type: 'reveal_identity', playerId: player.id };
      }
    }

    // Attack if possible
    if (!player.isArrested) {
      const attackCard = this.findCard(hand, ['shot', 'snipe']);
      if (attackCard) {
        const target = this.pickTarget(view, player);
        if (target) {
          return {
            type: 'use_card',
            playerId: player.id,
            cardInstanceId: attackCard.instanceId,
            targetPlayerId: target.id,
          };
        }
      }
    }

    // Heal if not full
    if (player.health < player.maxHealth) {
      const healCard = this.findCard(hand, ['first_aid', 'hospital']);
      if (healCard) {
        return { type: 'use_card', playerId: player.id, cardInstanceId: healCard.instanceId };
      }
    }

    // Disrupt
    const disruptCard = this.findCard(hand, ['arrest', 'seize', 'search']);
    if (disruptCard) {
      const targets = view.players.filter(p => p.id !== player.id && p.isAlive);
      if (targets.length > 0) {
        const target = this.pickRandom(targets);

        // For seize, need to pick a public card
        if (disruptCard.cardId === 'seize') {
          const targetPublicCards = target.publicCards;
          if (targetPublicCards.length > 0) {
            return {
              type: 'use_card',
              playerId: player.id,
              cardInstanceId: disruptCard.instanceId,
              targetPlayerId: target.id,
              targetCardInstanceId: targetPublicCards[0].instanceId,
            };
          }
        } else {
          return {
            type: 'use_card',
            playerId: player.id,
            cardInstanceId: disruptCard.instanceId,
            targetPlayerId: target.id,
          };
        }
      }
    }

    return { type: 'end_turn', playerId: player.id };
  }

  private pickTarget(view: ClientGameView, player: Player) {
    const enemies = view.players.filter(p => {
      if (p.id === player.id || !p.isAlive) return false;

      // Police can only attack revealed mafia
      if (player.role === 'police') {
        return p.role === 'mafia' && p.isIdentityRevealed;
      }

      // Only revealed mafia can attack police
      if (p.role === 'police' && !(player.role === 'mafia' && player.isIdentityRevealed)) {
        return false;
      }

      // Mafia targets non-mafia preferentially
      if (player.role === 'mafia') {
        return p.role !== 'mafia';
      }

      // Citizens target revealed mafia or suspicious players
      if (p.isIdentityRevealed && p.role === 'mafia') return true;

      return true;
    });

    if (enemies.length === 0) return null;

    // Prefer low-health targets
    enemies.sort((a, b) => a.health - b.health);
    return Math.random() < 0.7 ? enemies[0] : this.pickRandom(enemies);
  }

  private findCard(hand: CardInstance[], cardIds: CardId[]): CardInstance | undefined {
    for (const id of cardIds) {
      const card = hand.find(c => c.cardId === id);
      if (card) return card;
    }
    return undefined;
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}
