import { TickLog } from '../types';

export interface GeneratorRun {
  runId: string;
  meetingId: string;
  dataset: string;
  targetParticipant: string;
  contextWindowSeconds: number;
  promptHash: string;
  promptLabel: string;
  modelId: string;
  ticks: TickLog[];
  startTime: string;
  durationMs: number;
}

export interface TriggerJudgeResult {
  candidate_decision: 'hold' | 'intervene';
  decision_correct: 0 | 1;
  count_appropriateness: number;
  hold_quality: number | null;
  short_reason: string;
  confidence: number;
}

export interface CardScores {
  type_fit: number;
  timing: number;
  goal_fit: number;
  grounding: number;
  actionability: number;
  social_tact: number;
  specificity: number;
  brevity_clarity: number;
}

export interface CardJudgeResult {
  index: number;
  declared_type: string;
  inferred_type: string;
  admissible: boolean;
  hard_fail_flags: string[];
  scores: CardScores;
  primary_failure_mode: string;
  short_reason: string;
  confidence: number;
}

export interface SetJudgeResult {
  set_scores: {
    coverage: number;
    diversity: number;
    ranking: number;
    restraint: number;
    consistency: number;
  };
  duplicate_pairs: [number, number][];
  best_card_index: number;
  should_reduce_card_count: boolean;
  short_reason: string;
  confidence: number;
}

export interface DeterministicResult {
  card_index: number;
  word_count: number;
  char_count: number;
  has_bullets: boolean;
  has_semicolons: boolean;
  passes: boolean;
}

export interface TickJudgeResult {
  tickTime: number;
  trigger: TriggerJudgeResult;
  cards: CardJudgeResult[];
  set: SetJudgeResult | null;
  deterministic: DeterministicResult[];
  compositeScore: number;
}

export interface JudgedRun {
  generatorRun: GeneratorRun;
  judgedTicks: TickJudgeResult[];
  summary: RunSummaryStats;
}

export interface RunSummaryStats {
  meanScore: number;
  medianScore: number;
  interventionRate: number;
  criticalFailRate: number;
  genericUngroundedRate: number;
  judgeLowConfidenceRate: number;
  meanCardQuality: number;
  meanSetQuality: number;
}

export type BenchmarkStage = 'configure' | 'running' | 'results';

export interface BenchmarkConfig {
  meetingIds: string[];
  contextWindows: number[];
  promptLabel: string;
  promptText: string;
  targetStrategy: 'most-active' | 'manual';
  manualTarget?: string;
}

export interface BenchmarkProgress {
  phase: 'load' | 'generate' | 'judge';
  current: number;
  total: number;
  currentLabel: string;
}
