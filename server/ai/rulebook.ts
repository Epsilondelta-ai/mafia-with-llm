/**
 * 마피아 카드게임 룰북
 * LLM AI 플레이어에게 게임 시작 시 전달되는 전체 규칙서
 * 루트 경로의 RULEBOOK.md에서 로드
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const rulebookPath = resolve(import.meta.dirname, '../../docs/RULEBOOK.md');
export const RULEBOOK = readFileSync(rulebookPath, 'utf-8').trim();
