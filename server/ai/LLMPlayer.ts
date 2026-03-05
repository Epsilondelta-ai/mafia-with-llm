import type {
  Player, GameAction, ClientGameView, ClientPlayerView, CardInstance,
} from '../../shared/types.js';
import type { AIProvider } from './types.js';
import { CARD_DEFS } from '../game/constants.js';

export class LLMPlayer {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async decideAction(view: ClientGameView, player: Player): Promise<GameAction> {
    const systemPrompt = this.buildSystemPrompt(player);
    const userPrompt = this.buildActionPrompt(view, player);

    try {
      const response = await this.provider.chat({
        systemPrompt,
        userPrompt,
        maxTokens: 500,
      });
      return this.parseAction(response.content, view, player);
    } catch (error) {
      console.error(`LLM error (${this.provider.provider}):`, error);
      // Fallback to simple action
      return this.fallbackAction(view, player);
    }
  }

  async generateAnswer(view: ClientGameView, player: Player, question: string, askerId: string): Promise<GameAction> {
    const systemPrompt = this.buildSystemPrompt(player);
    const asker = view.players.find(p => p.id === askerId);
    const userPrompt = `${asker?.name || '누군가'}가 당신에게 질문했습니다: "${question}"

한 문장으로 대답하세요. 거부하려면 "거부"라고만 쓰세요.
당신의 역할(${this.roleToKo(player.role)})에 맞게 전략적으로 대답하세요.`;

    try {
      const response = await this.provider.chat({ systemPrompt, userPrompt, maxTokens: 100 });
      const content = response.content.trim();

      if (content === '거부' || content.toLowerCase() === 'refuse') {
        return { type: 'chat_refuse', playerId: player.id };
      }

      // Limit to one sentence
      const sentence = content.split(/[.!?。]\s/)[0] + '.';
      return { type: 'chat_answer', playerId: player.id, content: sentence };
    } catch {
      return { type: 'chat_answer', playerId: player.id, content: '잘 모르겠습니다.' };
    }
  }

  private buildSystemPrompt(player: Player): string {
    const roleDesc = {
      police: '당신은 경찰입니다. 정체가 공개되어 있습니다. 마피아를 찾아 제거해야 합니다. 정체가 공개된 마피아만 공격할 수 있습니다. 정체를 공개한 마피아가 있다면 반드시 최우선으로 공격하세요!',
      citizen: '당신은 시민입니다. 역할이 비공개입니다. 마피아를 찾아 제거하고 경찰을 보호해야 합니다. 정체를 공개한 마피아가 있다면 적극적으로 공격하세요! 마피아를 죽이면 체력+1 카드+2 보상을 받습니다.',
      mafia: '당신은 마피아입니다. 역할이 비공개입니다. 경찰을 제거하면 승리합니다. 다른 마피아가 누구인지 알고 있습니다. 시민인 척 행동하세요. 정체를 공개하면 카드 2장 보너스를 받고, 경찰을 직접 공격할 수 있으며, 누구든 죽이면 체력+1 카드+2 보상을 받습니다. 공격카드가 2장 이상이거나 경찰 체력이 낮으면 정체 공개를 적극 고려하세요!',
    };

    return `당신은 마피아 카드게임의 AI 플레이어입니다.
이름: ${player.name}
${roleDesc[player.role]}

게임 규칙:
- 턴마다: 채팅 → 카드 드로 → 카드 사용
- 공격 카드(총격/저격)는 공개됨
- 시민을 죽이면 체포됨 (다음 턴 공격 불가)
- 마피아를 죽이면 체력 회복 + 카드 보상
- 경찰에게 공격/방해 카드를 사용할 수 있는 것은 마피아만 가능
- 경찰을 직접 공격하려면 정체를 공개해야 함

⚠️ 정체 공개 시스템:
- 마피아가 자발적으로 정체를 공개할 수 있음
- 플레이어 목록에서 "🔴마피아[정체공개]"로 표시된 플레이어는 마피아임이 확인된 상태
- 정체가 공개된 마피아는 모든 플레이어가 공격 가능
- 정체가 공개된 마피아를 죽이면 체력+1 카드+2 보상
- 채팅에서 정체가 공개된 마피아에 대해 적극적으로 언급하고 협력 공격을 유도하세요

전략적으로 행동하고, 한국어로 자연스럽게 대화하세요.`;
  }

  private buildActionPrompt(view: ClientGameView, player: Player): string {
    const phase = view.phase;
    const playerInfo = this.formatPlayers(view.players, player);
    const handInfo = this.formatHand(player.hand);
    const recentChat = view.chatLog.slice(-5).map(m =>
      `[${m.playerName}] ${m.content}`
    ).join('\n');

    // Highlight revealed mafia players
    const revealedMafia = view.players.filter(p => p.role === 'mafia' && p.isIdentityRevealed && p.isAlive);
    const revealedMafiaAlert = revealedMafia.length > 0
      ? `\n🚨 정체가 공개된 마피아: ${revealedMafia.map(p => `${p.name}(체력:${p.health})`).join(', ')} — 누구나 공격 가능! 죽이면 체력+1 카드+2 보상!\n`
      : '';

    let prompt = `현재 상태:
턴: ${view.turnNumber}
페이즈: ${phase}
당신의 체력: ${player.health}/${player.maxHealth}
${player.isArrested ? '⚠️ 체포 상태 (공격 불가)\n' : ''}${revealedMafiaAlert}
플레이어:
${playerInfo}

손패:
${handInfo}

최근 채팅:
${recentChat || '(없음)'}

`;

    if (phase === 'chat') {
      prompt += `행동을 선택하세요. JSON으로 응답:
1. 공개 발언: {"action":"public","content":"발언 내용"}
2. 질문: {"action":"question","targetId":"대상ID","content":"질문 내용"}
3. 건너뛰기: {"action":"skip"}`;
    } else if (phase === 'use_cards') {
      const usableCards = player.hand.length;
      prompt += `카드를 사용하세요. 여러 장 연속 사용 가능합니다 (현재 손패: ${usableCards}장).
사용할 카드가 남아있으면 계속 사용하고, 더 이상 쓸 카드가 없을 때만 턴을 종료하세요.
킬 보상으로 새로 뽑은 카드도 즉시 사용 가능합니다.
JSON으로 응답:
1. 카드 사용: {"action":"use","cardId":"카드인스턴스ID","targetId":"대상ID"}`;

      // Only show reveal option if mafia and not yet revealed
      if (player.role === 'mafia' && !player.isIdentityRevealed) {
        prompt += `\n2. 정체 공개 (마피아만): {"action":"reveal"}
3. 턴 종료 (쓸 카드 없을 때만): {"action":"end"}`;
      } else if (player.role === 'mafia' && player.isIdentityRevealed) {
        prompt += `\n2. 턴 종료 (쓸 카드 없을 때만): {"action":"end"}
⚠️ 정체 공개 완료! 경찰을 직접 공격할 수 있습니다. 보너스 카드를 포함해 손패의 공격 카드를 적극 활용하세요!`;
      } else {
        prompt += `\n2. 턴 종료 (쓸 카드 없을 때만): {"action":"end"}`;
      }
    }

    return prompt;
  }

  private formatPlayers(players: ClientPlayerView[], self: Player): string {
    return players.map(p => {
      const isRevealedMafia = p.role === 'mafia' && p.isIdentityRevealed;
      const role = p.role === 'unknown' ? '???' : this.roleToKo(p.role as any);
      const status = !p.isAlive ? '💀탈락' : `❤️${p.health}/${p.maxHealth}`;
      const arrested = p.isArrested ? ' [체포]' : '';
      const revealed = isRevealedMafia ? ' 🔴마피아[정체공개]=공격가능!' : (p.isIdentityRevealed ? ' [공개]' : '');
      const me = p.id === self.id ? ' (나)' : '';
      const publicCards = p.publicCards.length > 0
        ? ` 공격카드: ${p.publicCards.map(c => CARD_DEFS[c.cardId].nameKo).join(',')}`
        : '';
      return `- ${p.name}${me}: ${role} ${status}${arrested}${revealed}${publicCards} [ID:${p.id.slice(0,8)}]`;
    }).join('\n');
  }

  private formatHand(hand: CardInstance[]): string {
    if (hand.length === 0) return '(비어있음)';
    return hand.map(c => {
      const def = CARD_DEFS[c.cardId];
      return `- ${def.nameKo} (${def.descriptionKo}) [ID:${c.instanceId.slice(0,8)}]`;
    }).join('\n');
  }

  private parseAction(response: string, view: ClientGameView, player: Player): GameAction {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[^}]+\}/);
      if (!jsonMatch) return this.fallbackAction(view, player);

      const parsed = JSON.parse(jsonMatch[0]);

      if (view.phase === 'chat') {
        if (parsed.action === 'public') {
          return { type: 'chat_public', playerId: player.id, content: parsed.content || '...' };
        }
        if (parsed.action === 'question' && parsed.targetId) {
          const target = this.resolvePlayerId(parsed.targetId, view);
          if (target) {
            return { type: 'chat_question', playerId: player.id, targetPlayerId: target, content: parsed.content || '?' };
          }
        }
        return { type: 'skip_chat', playerId: player.id };
      }

      if (view.phase === 'use_cards') {
        if (parsed.action === 'reveal' && player.role === 'mafia' && !player.isIdentityRevealed) {
          return { type: 'reveal_identity', playerId: player.id };
        }
        if (parsed.action === 'use' && parsed.cardId) {
          const cardInstanceId = this.resolveCardId(parsed.cardId, player.hand);
          if (cardInstanceId) {
            const target = parsed.targetId ? this.resolvePlayerId(parsed.targetId, view) : undefined;
            return { type: 'use_card', playerId: player.id, cardInstanceId, targetPlayerId: target };
          }
        }
        // If LLM tried to reveal but already revealed, try to find a card to use instead of ending turn
        if (parsed.action === 'reveal' && player.isIdentityRevealed) {
          const fallback = this.findFallbackCardAction(view, player);
          if (fallback) return fallback;
        }
        if (parsed.action === 'end') {
          return { type: 'end_turn', playerId: player.id };
        }
        return { type: 'end_turn', playerId: player.id };
      }
    } catch {
      // Parse failed
    }

    return this.fallbackAction(view, player);
  }

  private resolvePlayerId(partialId: string, view: ClientGameView): string | undefined {
    const player = view.players.find(p => p.id.startsWith(partialId) && p.isAlive);
    return player?.id;
  }

  private resolveCardId(partialId: string, hand: CardInstance[]): string | undefined {
    const card = hand.find(c => c.instanceId.startsWith(partialId));
    return card?.instanceId;
  }

  private findFallbackCardAction(view: ClientGameView, player: Player): GameAction | null {
    // Try to find an attack card and valid target (used when LLM tries reveal after already revealed)
    const attackCards = player.hand.filter(c => CARD_DEFS[c.cardId].type === 'attack');
    if (attackCards.length > 0 && !player.isArrested) {
      const enemies = view.players.filter(p => {
        if (p.id === player.id || !p.isAlive) return false;
        // Revealed mafia can attack police
        if (p.role === 'police' && player.role === 'mafia' && player.isIdentityRevealed) return true;
        // Don't attack fellow mafia
        if (player.role === 'mafia' && p.role === 'mafia') return false;
        return true;
      });
      if (enemies.length > 0) {
        // Prefer police target if revealed mafia
        const police = enemies.find(p => p.role === 'police');
        const target = police || enemies.sort((a, b) => a.health - b.health)[0];
        return {
          type: 'use_card',
          playerId: player.id,
          cardInstanceId: attackCards[0].instanceId,
          targetPlayerId: target.id,
        };
      }
    }
    return null;
  }

  private fallbackAction(view: ClientGameView, player: Player): GameAction {
    switch (view.phase) {
      case 'chat': return { type: 'skip_chat', playerId: player.id };
      case 'draw': return { type: 'draw_cards', playerId: player.id };
      case 'use_cards': return { type: 'end_turn', playerId: player.id };
      default: return { type: 'end_turn', playerId: player.id };
    }
  }

  private roleToKo(role: 'police' | 'citizen' | 'mafia'): string {
    const map = { police: '경찰', citizen: '시민', mafia: '마피아' };
    return map[role];
  }
}
