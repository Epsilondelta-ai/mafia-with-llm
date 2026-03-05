import { v4 as uuid } from 'uuid';
import type {
  GameState, GameAction, GameEvent, GameConfig, Player, PlayerConfig,
  Role, Team, CardInstance, CardId, ChatMessage, ClientGameView, ClientPlayerView,
  GamePhase,
} from '../../shared/types.js';
import { Deck } from './Deck.js';
import {
  ROLE_DISTRIBUTION, BASE_HEALTH, POLICE_HEALTH, STARTING_HAND_SIZE,
  CARDS_PER_DRAW, CARD_DEFS, MAFIA_REVEAL_DRAW, MAFIA_KILL_HEAL, MAFIA_KILL_DRAW,
} from './constants.js';

export class GameEngine {
  private state: GameState;
  private deck: Deck;
  private onEvent: (event: GameEvent) => void;

  constructor(config: GameConfig, onEvent: (event: GameEvent) => void) {
    this.onEvent = onEvent;
    this.deck = new Deck(config.playerCount);

    const roles = this.assignRoles(config.playerCount);
    const players = this.createPlayers(config.players, roles);

    this.state = {
      id: uuid(),
      phase: 'setup',
      mode: config.mode,
      players,
      currentPlayerIndex: 0,
      deck: [],
      discardPile: [],
      chatLog: [],
      turnNumber: 0,
      turnPhaseComplete: { chat: false, draw: false },
      winner: null,
      gameLog: [],
    };

    // Deal starting hands
    for (const player of this.state.players) {
      const cards = this.deck.draw(STARTING_HAND_SIZE);
      player.hand.push(...cards);
    }

    this.emit('game_start', undefined, undefined, {
      message: 'Game started!',
      messageKo: '게임이 시작되었습니다!',
    });

    // Start first turn (police goes first)
    const policeIndex = this.state.players.findIndex(p => p.role === 'police');
    this.state.currentPlayerIndex = policeIndex >= 0 ? policeIndex : 0;
    this.state.phase = 'chat';
    this.state.turnNumber = 1;

    this.emit('turn_start', this.currentPlayer().id, undefined, {
      message: `Turn ${this.state.turnNumber}: ${this.currentPlayer().name}'s turn`,
      messageKo: `턴 ${this.state.turnNumber}: ${this.currentPlayer().name}의 차례`,
    });
  }

  // ===== Public API =====

  processAction(action: GameAction): { success: boolean; error?: string } {
    if (this.state.phase === 'game_over') {
      return { success: false, error: 'Game is over' };
    }

    const currentPlayer = this.currentPlayer();
    if (action.playerId !== currentPlayer.id) {
      return { success: false, error: 'Not your turn' };
    }

    switch (action.type) {
      case 'chat_public': return this.handleChatPublic(action.playerId, action.content);
      case 'chat_question': return this.handleChatQuestion(action.playerId, action.targetPlayerId, action.content);
      case 'chat_answer': return this.handleChatAnswer(action.playerId, action.content);
      case 'chat_refuse': return this.handleChatRefuse(action.playerId);
      case 'skip_chat': return this.handleSkipChat(action.playerId);
      case 'draw_cards': return this.handleDrawCards(action.playerId);
      case 'use_card': return this.handleUseCard(action.playerId, action.cardInstanceId, action.targetPlayerId, action.targetCardInstanceId);
      case 'reveal_identity': return this.handleRevealIdentity(action.playerId);
      case 'end_turn': return this.handleEndTurn(action.playerId);
      default: return { success: false, error: 'Unknown action' };
    }
  }

  getState(): GameState {
    return { ...this.state, deck: [], discardPile: [] };
  }

  getClientView(playerId: string | null): ClientGameView {
    const myPlayer = playerId ? this.state.players.find(p => p.id === playerId) : null;

    const players: ClientPlayerView[] = this.state.players.map(p => {
      const isMe = p.id === playerId;
      const isMafiaAlly = myPlayer?.role === 'mafia' && p.role === 'mafia';
      const isGameOver = this.state.phase === 'game_over';
      const showRole = isGameOver || isMe || p.isIdentityRevealed || !p.isAlive || isMafiaAlly || p.role === 'police';

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        role: showRole ? p.role : 'unknown',
        health: p.health,
        maxHealth: p.maxHealth,
        handSize: p.hand.length,
        publicCards: p.hand.filter(c => CARD_DEFS[c.cardId].isPublic),
        isAlive: p.isAlive,
        isIdentityRevealed: p.isIdentityRevealed,
        isArrested: p.isArrested,
      };
    });

    return {
      id: this.state.id,
      phase: this.state.phase,
      mode: this.state.mode,
      players,
      currentPlayerIndex: this.state.currentPlayerIndex,
      myPlayerId: playerId,
      myHand: myPlayer?.hand ?? [],
      deckSize: this.deck.getDrawPileSize(),
      chatLog: this.state.chatLog,
      turnNumber: this.state.turnNumber,
      turnPhaseComplete: { ...this.state.turnPhaseComplete },
      winner: this.state.winner,
      gameLog: this.state.gameLog,
    };
  }

  getGameId(): string {
    return this.state.id;
  }

  isGameOver(): boolean {
    return this.state.phase === 'game_over';
  }

  getCurrentPlayerId(): string {
    return this.currentPlayer().id;
  }

  getCurrentPlayerType() {
    const p = this.currentPlayer();
    return { type: p.type, llmProvider: p.llmProvider, llmModel: p.llmModel };
  }

  getPhase(): GamePhase {
    return this.state.phase;
  }

  // ===== Action Handlers =====

  private handleChatPublic(playerId: string, content: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'chat') return { success: false, error: 'Not chat phase' };
    if (this.state.turnPhaseComplete.chat) return { success: false, error: 'Chat already done' };

    const player = this.getPlayer(playerId);
    const msg: ChatMessage = {
      id: uuid(), turnNumber: this.state.turnNumber,
      playerId, playerName: player.name, type: 'public',
      content, timestamp: Date.now(),
    };
    this.state.chatLog.push(msg);
    this.state.turnPhaseComplete.chat = true;

    this.emit('chat_public', playerId, undefined, {
      message: `${player.name}: "${content}"`,
      messageKo: `${player.name}: "${content}"`,
    });

    this.advancePhase();
    return { success: true };
  }

  private handleChatQuestion(playerId: string, targetPlayerId: string, content: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'chat') return { success: false, error: 'Not chat phase' };
    if (this.state.turnPhaseComplete.chat) return { success: false, error: 'Chat already done' };

    const player = this.getPlayer(playerId);
    const target = this.getPlayer(targetPlayerId);
    if (!target.isAlive) return { success: false, error: 'Target is dead' };

    const msg: ChatMessage = {
      id: uuid(), turnNumber: this.state.turnNumber,
      playerId, playerName: player.name, type: 'question',
      targetPlayerId, targetPlayerName: target.name,
      content, timestamp: Date.now(),
    };
    this.state.chatLog.push(msg);

    this.emit('chat_question', playerId, targetPlayerId, {
      message: `${player.name} asks ${target.name}: "${content}"`,
      messageKo: `${player.name}이(가) ${target.name}에게 질문: "${content}"`,
    });

    // Phase stays at chat - waiting for answer
    // The answer will come as a separate action (from the target player or AI)
    // For simplicity, we'll handle the answer flow through a pending state
    this.state.turnPhaseComplete.chat = true;
    this.advancePhase();
    return { success: true };
  }

  private handleChatAnswer(playerId: string, content: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    const msg: ChatMessage = {
      id: uuid(), turnNumber: this.state.turnNumber,
      playerId, playerName: player.name, type: 'answer',
      content, timestamp: Date.now(),
    };
    this.state.chatLog.push(msg);

    this.emit('chat_answer', playerId, undefined, {
      message: `${player.name} answers: "${content}"`,
      messageKo: `${player.name}의 대답: "${content}"`,
    });
    return { success: true };
  }

  private handleChatRefuse(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    const msg: ChatMessage = {
      id: uuid(), turnNumber: this.state.turnNumber,
      playerId, playerName: player.name, type: 'refuse',
      content: '(답변 거부)', timestamp: Date.now(),
    };
    this.state.chatLog.push(msg);

    this.emit('chat_refuse', playerId, undefined, {
      message: `${player.name} refuses to answer`,
      messageKo: `${player.name}이(가) 답변을 거부했습니다`,
    });
    return { success: true };
  }

  private handleSkipChat(playerId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'chat') return { success: false, error: 'Not chat phase' };
    this.state.turnPhaseComplete.chat = true;
    this.advancePhase();
    return { success: true };
  }

  private handleDrawCards(playerId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'draw') return { success: false, error: 'Not draw phase' };
    if (this.state.turnPhaseComplete.draw) return { success: false, error: 'Already drew cards' };

    const player = this.getPlayer(playerId);

    if (player.skipNextDraw) {
      player.skipNextDraw = false;
      this.state.turnPhaseComplete.draw = true;
      this.emit('cards_drawn', playerId, undefined, {
        message: `${player.name} skips draw (snipe penalty)`,
        messageKo: `${player.name}이(가) 드로를 건너뜁니다 (저격 패널티)`,
      });
      this.advancePhase();
      return { success: true };
    }

    const cards = this.deck.draw(CARDS_PER_DRAW);
    player.hand.push(...cards);
    this.state.turnPhaseComplete.draw = true;

    // Check for public attack cards drawn
    const attackCards = cards.filter(c => CARD_DEFS[c.cardId].isPublic);
    const cardNames = cards.map(c => CARD_DEFS[c.cardId].nameKo).join(', ');

    this.emit('cards_drawn', playerId, undefined, {
      message: `${player.name} draws ${cards.length} cards`,
      messageKo: `${player.name}이(가) 카드 ${cards.length}장을 뽑았습니다`,
      data: { drawnCards: cards, publicCards: attackCards },
    });

    this.advancePhase();
    return { success: true };
  }

  private handleUseCard(
    playerId: string, cardInstanceId: string,
    targetPlayerId?: string, targetCardInstanceId?: string
  ): { success: boolean; error?: string } {
    if (this.state.phase !== 'use_cards') return { success: false, error: 'Not card use phase' };

    const player = this.getPlayer(playerId);
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return { success: false, error: 'Card not in hand' };

    const card = player.hand[cardIndex];
    const cardDef = CARD_DEFS[card.cardId];

    // Validate and execute card effect
    const result = this.executeCard(player, card, cardDef.cardId, targetPlayerId, targetCardInstanceId);
    if (!result.success) return result;

    // Remove card from hand
    player.hand.splice(cardIndex, 1);

    // Discard or remove
    if (card.cardId === 'ambulance') {
      this.deck.removeFromGame(card);
    } else {
      this.deck.discard([card]);
    }

    return { success: true };
  }

  private handleRevealIdentity(playerId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'use_cards') return { success: false, error: 'Not card use phase' };

    const player = this.getPlayer(playerId);
    if (player.role !== 'mafia') return { success: false, error: 'Only mafia can reveal' };
    if (player.isIdentityRevealed) return { success: false, error: 'Already revealed' };

    player.isIdentityRevealed = true;

    // Bonus: draw 2 cards
    const bonusCards = this.deck.draw(MAFIA_REVEAL_DRAW);
    player.hand.push(...bonusCards);

    this.emit('identity_revealed', playerId, undefined, {
      message: `${player.name} reveals as MAFIA! Draws ${MAFIA_REVEAL_DRAW} bonus cards.`,
      messageKo: `${player.name}이(가) 마피아 정체를 공개했습니다! 카드 ${MAFIA_REVEAL_DRAW}장 추가 드로.`,
    });

    return { success: true };
  }

  private handleEndTurn(playerId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'use_cards') return { success: false, error: 'Not card use phase' };

    const player = this.getPlayer(playerId);

    // Reset turn-specific flags
    player.usedSnipeThisTurn = false;
    player.usedAttackThisTurn = false;
    player.hospitalUsedThisTurn = false;

    // Clear arrest status at end of turn (arrested player couldn't attack this turn)
    if (player.isArrested) {
      player.isArrested = false;
    }

    this.emit('turn_end', playerId, undefined, {
      message: `${player.name}'s turn ends`,
      messageKo: `${player.name}의 턴이 종료되었습니다`,
    });

    // Check victory
    const winner = this.checkVictory();
    if (winner) {
      this.state.winner = winner;
      this.state.phase = 'game_over';
      this.emit('game_over', undefined, undefined, {
        message: `Game Over! ${winner === 'citizen_team' ? 'Citizens' : 'Mafia'} win!`,
        messageKo: `게임 종료! ${winner === 'citizen_team' ? '시민 진영' : '마피아 진영'} 승리!`,
      });
      return { success: true };
    }

    // Move to next alive player
    this.nextPlayer();

    return { success: true };
  }

  // ===== Card Execution =====

  private executeCard(
    player: Player, card: CardInstance, cardId: CardId,
    targetPlayerId?: string, targetCardInstanceId?: string
  ): { success: boolean; error?: string } {
    const target = targetPlayerId ? this.state.players.find(p => p.id === targetPlayerId) : undefined;

    switch (cardId) {
      case 'shot': return this.executeShot(player, target);
      case 'snipe': return this.executeSnipe(player, target);
      case 'first_aid': return this.executeFirstAid(player);
      case 'hospital': return this.executeHospital(player);
      case 'arrest': return this.executeArrest(player, target);
      case 'seize': return this.executeSeize(player, target, targetCardInstanceId);
      case 'search': return this.executeSearch(player, target);
      default: return { success: false, error: 'Cannot use this card directly' };
    }
  }

  private executeShot(player: Player, target?: Player): { success: boolean; error?: string } {
    if (!target || !target.isAlive) return { success: false, error: 'Invalid target' };
    if (player.isArrested) return { success: false, error: 'You are arrested - cannot attack' };
    if (player.usedSnipeThisTurn) return { success: false, error: 'Cannot use shot after snipe' };
    if (player.hospitalUsedThisTurn) return { success: false, error: 'Cannot attack this turn (hospital)' };

    // Police can only attack revealed mafia
    if (player.role === 'police' && !(target.role === 'mafia' && target.isIdentityRevealed)) {
      return { success: false, error: 'Police can only attack revealed mafia' };
    }

    // Only revealed mafia can attack police
    if (target.role === 'police' && !(player.role === 'mafia' && player.isIdentityRevealed)) {
      return { success: false, error: 'Only revealed mafia can attack police' };
    }

    player.usedAttackThisTurn = true;
    this.dealDamage(player, target, 1);

    this.emit('card_used', player.id, target.id, {
      message: `${player.name} shoots ${target.name} for 1 damage`,
      messageKo: `${player.name}이(가) ${target.name}에게 총격! (1 데미지)`,
      data: { cardId: 'shot', damage: 1 },
    });

    return { success: true };
  }

  private executeSnipe(player: Player, target?: Player): { success: boolean; error?: string } {
    if (!target || !target.isAlive) return { success: false, error: 'Invalid target' };
    if (player.isArrested) return { success: false, error: 'You are arrested - cannot attack' };
    if (player.usedAttackThisTurn) return { success: false, error: 'Cannot use snipe after other attacks' };
    if (player.hospitalUsedThisTurn) return { success: false, error: 'Cannot attack this turn (hospital)' };

    if (player.role === 'police' && !(target.role === 'mafia' && target.isIdentityRevealed)) {
      return { success: false, error: 'Police can only attack revealed mafia' };
    }

    // Only revealed mafia can attack police
    if (target.role === 'police' && !(player.role === 'mafia' && player.isIdentityRevealed)) {
      return { success: false, error: 'Only revealed mafia can attack police' };
    }

    player.usedSnipeThisTurn = true;
    player.usedAttackThisTurn = true;
    player.skipNextDraw = true;

    this.dealDamage(player, target, 2);

    this.emit('card_used', player.id, target.id, {
      message: `${player.name} snipes ${target.name} for 2 damage! (skip next draw)`,
      messageKo: `${player.name}이(가) ${target.name}을(를) 저격! (2 데미지, 다음 턴 드로 불가)`,
      data: { cardId: 'snipe', damage: 2 },
    });

    return { success: true };
  }

  private executeFirstAid(player: Player): { success: boolean; error?: string } {
    if (player.health >= player.maxHealth) return { success: false, error: 'Already at max health' };

    player.health = Math.min(player.health + 1, player.maxHealth);

    this.emit('player_healed', player.id, undefined, {
      message: `${player.name} uses First Aid (+1 HP)`,
      messageKo: `${player.name}이(가) 응급처치 사용 (체력 +1)`,
    });

    return { success: true };
  }

  private executeHospital(player: Player): { success: boolean; error?: string } {
    if (player.health >= player.maxHealth) return { success: false, error: 'Already at max health' };
    if (player.usedAttackThisTurn) return { success: false, error: 'Cannot use hospital after attacking' };

    player.health = Math.min(player.health + 2, player.maxHealth);
    player.hospitalUsedThisTurn = true;

    this.emit('player_healed', player.id, undefined, {
      message: `${player.name} goes to Hospital (+2 HP, no attacks this turn)`,
      messageKo: `${player.name}이(가) 입원 (체력 +2, 이번 턴 공격 불가)`,
    });

    return { success: true };
  }

  private executeArrest(player: Player, target?: Player): { success: boolean; error?: string } {
    if (!target || !target.isAlive) return { success: false, error: 'Invalid target' };

    // Only mafia can use interference cards against police
    if (target.role === 'police' && player.role !== 'mafia') {
      return { success: false, error: 'Only mafia can use interference cards against police' };
    }

    target.isArrested = true;

    this.emit('arrest_applied', player.id, target.id, {
      message: `${player.name} arrests ${target.name} (no attacks next turn)`,
      messageKo: `${player.name}이(가) ${target.name}을(를) 체포 (다음 턴 공격 불가)`,
    });

    return { success: true };
  }

  private executeSeize(player: Player, target?: Player, targetCardInstanceId?: string): { success: boolean; error?: string } {
    if (!target || !target.isAlive) return { success: false, error: 'Invalid target' };
    if (!targetCardInstanceId) return { success: false, error: 'Must specify card to seize' };

    // Only mafia can use interference cards against police
    if (target.role === 'police' && player.role !== 'mafia') {
      return { success: false, error: 'Only mafia can use interference cards against police' };
    }

    const cardIdx = target.hand.findIndex(
      c => c.instanceId === targetCardInstanceId && CARD_DEFS[c.cardId].isPublic
    );
    if (cardIdx === -1) return { success: false, error: 'Target card not found or not public' };

    const seized = target.hand.splice(cardIdx, 1)[0];
    this.deck.discard([seized]);

    this.emit('card_destroyed', player.id, target.id, {
      message: `${player.name} seizes a ${CARD_DEFS[seized.cardId].nameKo} from ${target.name}`,
      messageKo: `${player.name}이(가) ${target.name}의 ${CARD_DEFS[seized.cardId].nameKo}을(를) 압수`,
    });

    return { success: true };
  }

  private executeSearch(player: Player, target?: Player): { success: boolean; error?: string } {
    if (!target || !target.isAlive) return { success: false, error: 'Invalid target' };

    // Only mafia can use interference cards against police
    if (target.role === 'police' && player.role !== 'mafia') {
      return { success: false, error: 'Only mafia can use interference cards against police' };
    }

    const hiddenCards = target.hand.filter(c => !CARD_DEFS[c.cardId].isPublic);
    if (hiddenCards.length === 0) return { success: false, error: 'Target has no hidden cards' };

    const randomIdx = Math.floor(Math.random() * hiddenCards.length);
    const searchedCard = hiddenCards[randomIdx];
    const cardIdx = target.hand.findIndex(c => c.instanceId === searchedCard.instanceId);
    target.hand.splice(cardIdx, 1);
    this.deck.discard([searchedCard]);

    this.emit('card_destroyed', player.id, target.id, {
      message: `${player.name} searches ${target.name} and destroys a hidden card`,
      messageKo: `${player.name}이(가) ${target.name}을(를) 수색하여 비공개 카드 1장 파괴`,
    });

    return { success: true };
  }

  // ===== Combat =====

  private dealDamage(attacker: Player, target: Player, damage: number): void {
    target.health -= damage;

    this.emit('player_damaged', attacker.id, target.id, {
      message: `${target.name} takes ${damage} damage (HP: ${target.health}/${target.maxHealth})`,
      messageKo: `${target.name}이(가) ${damage} 데미지를 받았습니다 (체력: ${target.health}/${target.maxHealth})`,
    });

    if (target.health <= 0) {
      this.handleElimination(attacker, target);
    }
  }

  private handleElimination(attacker: Player, target: Player): void {
    // Check for ambulance
    const ambulanceIdx = target.hand.findIndex(c => c.cardId === 'ambulance');

    if (ambulanceIdx !== -1) {
      const ambulance = target.hand.splice(ambulanceIdx, 1)[0];
      this.deck.removeFromGame(ambulance);
      target.health = 1;

      this.emit('player_revived', target.id, undefined, {
        message: `${target.name}'s ambulance activates! Revived with 1 HP.`,
        messageKo: `${target.name}의 구급차가 발동! 체력 1로 부활.`,
      });
      return;
    }

    // Permanent death
    target.isAlive = false;
    target.isIdentityRevealed = true; // role revealed on death

    // Discard all cards
    this.deck.discard(target.hand.filter(c => c.cardId !== 'ambulance'));
    target.hand = [];

    this.emit('player_eliminated', attacker.id, target.id, {
      message: `${target.name} (${target.role}) has been eliminated!`,
      messageKo: `${target.name} (${this.roleToKo(target.role)})이(가) 탈락했습니다!`,
    });

    // Penalties and rewards
    this.handleKillConsequences(attacker, target);
  }

  private handleKillConsequences(attacker: Player, target: Player): void {
    // Penalty: non-revealed killing citizen -> arrest
    if (target.role === 'citizen') {
      const isRevealedMafia = attacker.role === 'mafia' && attacker.isIdentityRevealed;
      if (!isRevealedMafia) {
        // Police, citizen, or unrevealed mafia killing citizen = arrest
        attacker.isArrested = true;
        this.emit('penalty_applied', attacker.id, undefined, {
          message: `${attacker.name} is arrested for killing a citizen!`,
          messageKo: `${attacker.name}이(가) 시민을 죽여 체포되었습니다!`,
        });
      }
    }

    // Reward: anyone killing mafia → +1 HP + 2 cards
    if (target.role === 'mafia') {
      attacker.health = Math.min(attacker.health + MAFIA_KILL_HEAL, attacker.maxHealth);
      const bonusCards = this.deck.draw(MAFIA_KILL_DRAW);
      attacker.hand.push(...bonusCards);

      this.emit('reward_given', attacker.id, undefined, {
        message: `${attacker.name} gets +${MAFIA_KILL_HEAL} HP and ${MAFIA_KILL_DRAW} cards for eliminating mafia!`,
        messageKo: `${attacker.name}이(가) 마피아 제거 보상: 체력 +${MAFIA_KILL_HEAL}, 카드 ${MAFIA_KILL_DRAW}장`,
      });
    } else if (attacker.role === 'mafia' && attacker.isIdentityRevealed) {
      // Reward: revealed mafia killing non-mafia → +1 HP + 2 cards
      attacker.health = Math.min(attacker.health + MAFIA_KILL_HEAL, attacker.maxHealth);
      const bonusCards = this.deck.draw(MAFIA_KILL_DRAW);
      attacker.hand.push(...bonusCards);

      this.emit('reward_given', attacker.id, undefined, {
        message: `${attacker.name} (revealed mafia) gets kill reward!`,
        messageKo: `${attacker.name} (공개 마피아) 처치 보상 획득!`,
      });
    }
  }

  // ===== Victory =====

  private checkVictory(): Team | null {
    const alivePlayers = this.state.players.filter(p => p.isAlive);
    const alivePolice = alivePlayers.filter(p => p.role === 'police');
    const aliveMafia = alivePlayers.filter(p => p.role === 'mafia');

    // Mafia wins if police is eliminated
    if (alivePolice.length === 0) {
      return 'mafia_team';
    }

    // Citizen team wins if all mafia eliminated
    if (aliveMafia.length === 0) {
      return 'citizen_team';
    }

    return null;
  }

  // ===== Turn Management =====

  private advancePhase(): void {
    if (this.state.phase === 'chat' && this.state.turnPhaseComplete.chat) {
      this.state.phase = 'draw';
    } else if (this.state.phase === 'draw' && this.state.turnPhaseComplete.draw) {
      this.state.phase = 'use_cards';
    }
  }

  private nextPlayer(): void {
    let nextIdx = (this.state.currentPlayerIndex + 1) % this.state.players.length;

    // Skip dead players
    let attempts = 0;
    while (!this.state.players[nextIdx].isAlive && attempts < this.state.players.length) {
      nextIdx = (nextIdx + 1) % this.state.players.length;
      attempts++;
    }

    this.state.currentPlayerIndex = nextIdx;
    this.state.turnNumber++;
    this.state.phase = 'chat';
    this.state.turnPhaseComplete = { chat: false, draw: false };

    this.emit('turn_start', this.currentPlayer().id, undefined, {
      message: `Turn ${this.state.turnNumber}: ${this.currentPlayer().name}'s turn`,
      messageKo: `턴 ${this.state.turnNumber}: ${this.currentPlayer().name}의 차례`,
    });
  }

  // ===== Helpers =====

  private currentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex];
  }

  private getPlayer(id: string): Player {
    const p = this.state.players.find(p => p.id === id);
    if (!p) throw new Error(`Player ${id} not found`);
    return p;
  }

  private assignRoles(playerCount: number): Role[] {
    const dist = ROLE_DISTRIBUTION[playerCount];
    if (!dist) throw new Error(`Unsupported player count: ${playerCount}`);

    const roles: Role[] = [];
    for (const [role, count] of Object.entries(dist)) {
      for (let i = 0; i < count; i++) {
        roles.push(role as Role);
      }
    }

    // Shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    return roles;
  }

  private createPlayers(configs: PlayerConfig[], roles: Role[]): Player[] {
    return configs.map((config, i) => ({
      id: uuid(),
      name: config.name,
      type: config.type,
      llmProvider: config.llmProvider,
      llmModel: config.llmModel,
      role: roles[i],
      health: roles[i] === 'police' ? POLICE_HEALTH : BASE_HEALTH,
      maxHealth: roles[i] === 'police' ? POLICE_HEALTH : BASE_HEALTH,
      hand: [],
      isAlive: true,
      isIdentityRevealed: roles[i] === 'police', // police is always revealed
      isArrested: false,
      skipNextDraw: false,
      usedSnipeThisTurn: false,
      usedAttackThisTurn: false,
      hospitalUsedThisTurn: false,
    }));
  }

  private emit(
    type: GameEvent['type'], playerId?: string, targetPlayerId?: string,
    extra?: { message: string; messageKo: string; data?: Record<string, unknown> }
  ): void {
    const event: GameEvent = {
      id: uuid(),
      type,
      playerId,
      targetPlayerId,
      data: extra?.data,
      message: extra?.message ?? type,
      messageKo: extra?.messageKo ?? type,
      timestamp: Date.now(),
    };
    this.state.gameLog.push(event);
    this.onEvent(event);
  }

  private roleToKo(role: Role): string {
    switch (role) {
      case 'police': return '경찰';
      case 'citizen': return '시민';
      case 'mafia': return '마피아';
    }
  }
}
