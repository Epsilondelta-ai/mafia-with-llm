# Deep Interview Spec: 마피아 게임 완전 재구축

## Metadata
- Interview ID: mafia-rebuild-2026-03-06
- Rounds: 13
- Final Ambiguity Score: 15%
- Type: brownfield (문서 추출 → 새 프로젝트)
- Generated: 2026-03-06
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.9 | 35% | 0.315 |
| Constraint Clarity | 0.75 | 25% | 0.188 |
| Success Criteria | 0.85 | 25% | 0.213 |
| Context Clarity | 0.9 | 15% | 0.135 |
| **Total Clarity** | | | **0.850** |
| **Ambiguity** | | | **15%** |

## Goal
기존 마피아 카드게임 프로젝트(mafia-with-llm)에서 **룰북, 게임 기획, 시스템 문서만 추출**한 뒤, **완전히 새로운 프로젝트**로 처음부터 재구축한다. 핵심 차별점은:

1. **원형(circular) 게임보드 UI** - 플레이어가 테이블 주위에 둥글게 배치
2. **카드게임 스타일 비주얼** - 포커/보드게임 느낌의 2D UI (CSS + SVG 애니메이션)
3. **경찰부터 시계방향 진행** - 턴 순서가 시각적으로 표현
4. **멀티플레이어 지원** - 여러 명의 인간 플레이어가 접속하여 함께 플레이
5. **기존 게임 규칙 유지** - 카드 밸런스는 테스트하며 점진적 조정

## Constraints
- **프론트엔드**: React (TypeScript)
- **백엔드**: NestJS (TypeScript)
- **실시간 통신**: Socket.IO
- **데이터베이스**: SQLite (better-sqlite3)
- **코드**: 100% 새로 작성 (기존 코드 참조만, 복사 금지)
- **입력 문서**: 기존 프로젝트의 RULEBOOK.md, RULEBOOK.ko.md, DESIGN.md만 추출하여 참조
- **AI Provider**: 기존 5개 프로바이더 유지 (Claude, OpenAI, Gemini, Ollama, X AI)
- **한국어 UI**: 기존처럼 한국어 중심 인터페이스

## Non-Goals
- 3D 그래픽이나 WebGL/Canvas 기반 렌더링 (2D CSS/SVG로 충분)
- 게임 규칙의 근본적 재설계 (기존 규칙 유지, 밸런스만 후속 조정)
- 모바일 네이티브 앱 (웹 앱으로 충분)
- 실시간 음성/영상 채팅
- 랭킹/매치메이킹 시스템 (1단계에서는 불필요)

## Acceptance Criteria

### 1단계 (MVP - 핵심)
- [ ] **원형 게임보드**: 플레이어가 테이블 주위에 원형으로 배치되는 게임보드 UI
- [ ] **현재 턴 강조**: 현재 턴인 플레이어의 테두리/아바타가 시각적으로 강조됨
- [ ] **중앙 액션 영역**: 카드 사용 시 테이블 중앙으로 카드가 이동하는 애니메이션
- [ ] **시계방향 진행 표시**: 경찰부터 시계방향으로 턴이 진행되며 방향이 시각적으로 보임
- [ ] **로비 화면**: 게임 설정 (플레이어 수, AI 구성, 인간 플레이어 참여)
- [ ] **게임 화면**: 원형 보드 + 채팅 + 이벤트 로그 + 카드 핸드
- [ ] **결과 화면**: 승패 결과 + 플레이어별 역할/상태 표시
- [ ] **멀티플레이어**: 여러 인간 플레이어가 각자 기기에서 접속하여 함께 플레이
- [ ] **AI 대전**: Code AI (규칙 기반) + LLM AI (5개 프로바이더) 모두 작동
- [ ] **관전 모드**: AI끼리 대전하는 것을 관전 가능
- [ ] **전체 게임 흐름**: 로비 → 역할 배정 → 채팅 → 드로우 → 카드 사용 → 다음 턴 → 승패 판정

### 2단계 (풀 피처)
- [ ] 게임 기록 저장 및 히스토리 페이지
- [ ] 게임 리플레이 기능
- [ ] 카드 밸런스 조정 (테스트 기반)
- [ ] PWA 지원
- [ ] AI 플레이어 일괄 설정 UI 개선

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 기존 코드를 리팩토링하면 됨 | [Contrarian] GameEngine 789줄이 잘 구현되어 있는데 정말 새로 쓸 필요? | 문서만 추출하고 코드는 100% 새로 작성. 구조적 개선 목적 |
| 풀 피처를 한번에 만들어야 함 | [Simplifier] 범위가 크므로 단계적 접근 제안 | 1단계: 원형 보드 + 기본 대전 + 멀티플레이어. 2단계: 기록/리플레이 등 |
| 카드 밸런스를 미리 결정해야 함 | 구체적으로 뭘 바꿀지? | 1단계에서는 기존 카드 그대로, 테스트하며 점진적 조정 |
| 싱글플레이어만 지원 | 멀티플레이어 필요? | 멀티플레이어 지원 확정 (여러 인간 플레이어 접속) |

## Technical Context

### 기존 프로젝트에서 추출할 문서
| 파일 | 용도 |
|------|------|
| `docs/RULEBOOK.md` | 영문 룰북 |
| `docs/RULEBOOK.ko.md` | 한국어 룰북 |
| `DESIGN.md` | 게임 기획 문서 (한국어) |

### 새 프로젝트 기술 스택
| 영역 | 기술 |
|------|------|
| Frontend | React 18+ / TypeScript / Vite |
| Backend | NestJS / TypeScript |
| Real-time | Socket.IO (NestJS Gateway) |
| Database | SQLite (better-sqlite3) |
| Styling | Tailwind CSS + CSS/SVG Animations |
| AI Providers | Claude, OpenAI, Gemini, Ollama, X AI |
| State Management | Zustand (or TBD) |

### 핵심 아키텍처 변경점 (기존 대비)
1. **Express → NestJS**: 모듈 기반 아키텍처, DI, Gateway 패턴
2. **싱글 플레이어 → 멀티플레이어**: Room 기반 세션 관리, 플레이어별 뷰 필터링
3. **리스트형 UI → 원형 게임보드**: CSS transform으로 원형 배치, SVG 애니메이션
4. **텍스트 중심 → 카드게임 비주얼**: 카드 컴포넌트, 액션 애니메이션, 시각적 피드백

## Ontology (Key Entities)
| Entity | Fields | Relationships |
|--------|--------|---------------|
| Game | id, status, turn, phase, winner | has many Players, has Deck |
| Player | id, name, role, health, isHuman, isAlive | belongs to Game, has Cards |
| Card | id, type, isPublic | belongs to Deck, held by Player |
| Deck | id, cards[] | belongs to Game |
| Room | id, code, hostId, status | has one Game, has many Connections |
| ChatMessage | id, sender, content, type | belongs to Game |
| GameEvent | id, type, data, turn | belongs to Game |
| AIPlayer | id, type(code/llm), provider, model | extends Player |

## Interview Transcript
<details>
<summary>Full Q&A (13 rounds)</summary>

### Round 1
**Q:** 새 프로젝트에서 기존 게임 규칙(역할, 카드, 턴 구조 등)은 그대로 유지하려는 건가요, 아니면 규칙 자체도 변경/개선하고 싶은 부분이 있나요?
**A:** 규칙 일부 수정
**Ambiguity:** 80% (Goal: 0.3, Constraints: 0.1, Criteria: 0.1, Context: 0.3)

### Round 2
**Q:** 규칙을 일부 수정하고 싶다고 하셨는데, 현재 게임에서 불편하거나 바꾸고 싶었던 부분이 구체적으로 어떤 게 있나요?
**A:** 카드 밸런스/종류 조정
**Ambiguity:** 76% (Goal: 0.4, Constraints: 0.1, Criteria: 0.1, Context: 0.35)

### Round 3
**Q:** "게임 그래픽적인 요소"라고 하셨는데, 구체적으로 어떤 수준의 비주얼을 생각하시나요?
**A:** 카드게임 스타일 UI (포커/보드게임처럼 테이블 위에 카드가 놓이고, 플레이어 아바타가 원형으로 배치된 2D UI)
**Ambiguity:** 69% (Goal: 0.55, Constraints: 0.1, Criteria: 0.15, Context: 0.35)

### Round 4
**Q:** 새 프로젝트의 기술 스택은 어떻게 하시려고 하나요?
**A:** 프론트: React, 백엔드: NestJS
**Ambiguity:** 62% (Goal: 0.55, Constraints: 0.35, Criteria: 0.15, Context: 0.4)

### Round 5 [Contrarian Mode]
**Q:** 처음부터 다시 만든다고 하셨는데, 게임 로직은 기존 코드를 기반으로 리팩토링하고 UI/백엔드 아키텍처만 새로 만드는 게 더 효율적일 수 있지 않을까요?
**A:** 문서만 추출하고 새로 (코드는 100% 새로 작성)
**Ambiguity:** 58% (Goal: 0.6, Constraints: 0.4, Criteria: 0.15, Context: 0.5)

### Round 6 [Simplifier Mode]
**Q:** 풀 피처 대체를 목표로 하시지만, 한 번에 다 만들면 범위가 큽니다. 가장 먼저 만들어야 할 핵심 기능 1순위는?
**A:** 원형 게임보드 + 기본 대전
**Ambiguity:** 49% (Goal: 0.65, Constraints: 0.45, Criteria: 0.55, Context: 0.55)

### Round 7
**Q:** 새 프로젝트가 완성되었다고 판단할 수 있는 최소 기준이 뭐라고 생각하시나요?
**A:** 풀 피처 대체 (기존 프로젝트의 모든 기능을 새 UI로 완전히 대체)
**Ambiguity:** 42% (Goal: 0.7, Constraints: 0.45, Criteria: 0.55, Context: 0.6)

### Round 8
**Q:** 원형 게임보드에서 플레이어의 턴이 진행될 때, 시각적으로 어떻게 표현되었으면 하나요?
**A:** 해당 플레이어 강조 + 중앙 액션 (현재 턴인 플레이어 테두리 발광, 카드 사용 시 테이블 중앙에 카드가 표시되며 애니메이션으로 이동)
**Ambiguity:** 39% (Goal: 0.75, Constraints: 0.45, Criteria: 0.55, Context: 0.65)

### Round 9
**Q:** NestJS 백엔드에서 실시간 통신과 데이터베이스는 어떻게 하시려고 하나요?
**A:** Socket.IO + SQLite 유지
**Ambiguity:** 33% (Goal: 0.75, Constraints: 0.65, Criteria: 0.55, Context: 0.7)

### Round 10
**Q:** 현재는 인간 1명 + AI 여러 명 구성인데, 새 프로젝트에서도 동일한가요?
**A:** 멀티플레이어 지원 (여러 명의 인간이 각자 기기로 접속하여 함께 플레이)
**Ambiguity:** 31% (Goal: 0.8, Constraints: 0.65, Criteria: 0.55, Context: 0.75)

### Round 11
**Q:** 카드 밸런스/종류 조정을 원하셨는데, 구체적으로 뭘 바꾸고 싶으신가요?
**A:** 나중에 테스트하며 조정 (1단계에서는 기존 카드 그대로)
**Ambiguity:** 26% (Goal: 0.85, Constraints: 0.7, Criteria: 0.6, Context: 0.8)

### Round 12
**Q:** 1단계 완성의 구체적 기준으로, 반드시 되어야 할 것은?
**A:** 원형 게임보드 + 카드 애니메이션, 로비 + 게임 + 결과 화면 (전체 흐름)
**Ambiguity:** 20% (Goal: 0.9, Constraints: 0.7, Criteria: 0.75, Context: 0.85)

### Round 13
**Q:** 1단계에서 AI 대전과 멀티플레이어를 선택하지 않았는데, 대전 상대는?
**A:** AI + 멀티 모두 1단계 (Code AI, LLM AI, 멀티플레이어 모두 1단계에 포함)
**Ambiguity:** 15% (Goal: 0.9, Constraints: 0.75, Criteria: 0.85, Context: 0.9)

</details>
