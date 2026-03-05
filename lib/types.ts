export type CardType =
  | 'ask'
  | 'frame'
  | 'summarize'
  | 'challenge'
  | 'search'
  | 'decide'
  | 'relate'
  | 'capture'
  | 'hold'; // internal no-op; filtered from visible UI per PRD §8.7

export type ReplayQuality = 'exact' | 'estimated' | 'approximate' | 'generated';

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
  provenance: ReplayQuality;
}

export interface CardResult {
  type: CardType;
  text: string;
}

export interface TickResult {
  intervene: boolean;
  why: string;
  cards: CardResult[];
}

export interface TickLog {
  tickTime: number;
  contextWindowSeconds: number;
  transcriptSlice: TranscriptSegment[];
  recentCards: CardResult[];
  filledPrompt: string;
  result: TickResult;
  rawResponse: string;
  uiEvents: string[];
  error?: string;
}

export interface RunLog {
  runId: string;
  startTime: string;
  sourceFile: string;
  sourceType: string;
  replayQuality: ReplayQuality;
  promptHash: string;
  targetParticipant: string;
  prompt: string;
  contextWindowSeconds: number;
  stepInterval: number;
  modelId: string;
  ticks: TickLog[];
}

export type RunConfig = { targetParticipant: string; contextWindowSeconds: number; prompt: string };

export type RunStatus = 'draft' | 'processing' | 'ready' | 'failed';

export interface RunSummary {
  runId: string;
  name: string;
  sourceFile: string;
  sourceType: string;
  status: RunStatus;
  targetParticipant: string;
  contextWindowSeconds: number;
  replayQuality: ReplayQuality;
  lastUpdated: string;
  tickCount: number;
  interventionCount: number;
}
