import {
  TickJudgeResult,
  CardJudgeResult,
  TriggerJudgeResult,
  SetJudgeResult,
  RunSummaryStats,
} from './types';

export function cardQuality(scores: CardJudgeResult['scores']): number {
  return (
    0.10 * scores.type_fit +
    0.20 * scores.timing +
    0.20 * scores.goal_fit +
    0.20 * scores.grounding +
    0.10 * scores.actionability +
    0.10 * scores.social_tact +
    0.05 * scores.specificity +
    0.05 * scores.brevity_clarity
  ) / 4;
}

export function triggerBlock(trigger: TriggerJudgeResult): number {
  if (trigger.candidate_decision === 'hold') {
    return 0.70 * trigger.decision_correct + 0.30 * ((trigger.hold_quality ?? 0) / 4);
  }
  return 0.70 * trigger.decision_correct + 0.30 * (trigger.count_appropriateness / 4);
}

export function setBlock(set: SetJudgeResult): number {
  const s = set.set_scores;
  return (
    0.30 * (s.coverage / 4) +
    0.20 * (s.diversity / 4) +
    0.20 * (s.ranking / 4) +
    0.15 * (s.restraint / 4) +
    0.15 * (s.consistency / 4)
  );
}

export function compositeScore(
  trigger: TriggerJudgeResult,
  cards: CardJudgeResult[],
  set: SetJudgeResult | null
): number {
  const tBlock = triggerBlock(trigger);

  if (trigger.candidate_decision === 'hold') {
    return 100 * tBlock;
  }

  if (cards.length === 0) {
    return 100 * tBlock;
  }

  const firstCardQ = cardQuality(cards[0].scores);
  const bestCardQ = cards.length > 1
    ? Math.max(...cards.map((c) => cardQuality(c.scores)))
    : firstCardQ;
  const sBlock = set ? setBlock(set) : 0;

  return 100 * (0.25 * tBlock + 0.35 * firstCardQ + 0.20 * bestCardQ + 0.20 * sBlock);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeSummary(ticks: TickJudgeResult[]): RunSummaryStats {
  if (ticks.length === 0) {
    return {
      meanScore: 0, medianScore: 0, interventionRate: 0,
      criticalFailRate: 0, genericUngroundedRate: 0,
      judgeLowConfidenceRate: 0, meanCardQuality: 0, meanSetQuality: 0,
    };
  }

  const scores = ticks.map((t) => t.compositeScore);
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const medianScore = median(scores);

  const interventions = ticks.filter((t) => t.trigger.candidate_decision === 'intervene');
  const interventionRate = interventions.length / ticks.length;

  const allCards = ticks.flatMap((t) => t.cards);
  const criticalFails = allCards.filter((c) =>
    c.hard_fail_flags.some((f) => ['generic', 'ungrounded', 'manipulative'].includes(f))
  );
  const criticalFailRate = allCards.length > 0 ? criticalFails.length / allCards.length : 0;

  const genericUngrounded = allCards.filter((c) =>
    c.hard_fail_flags.includes('generic') || c.hard_fail_flags.includes('ungrounded')
  );
  const genericUngroundedRate = allCards.length > 0 ? genericUngrounded.length / allCards.length : 0;

  const allConfidences = ticks.map((t) => t.trigger.confidence);
  const lowConf = allConfidences.filter((c) => c < 0.5);
  const judgeLowConfidenceRate = allConfidences.length > 0 ? lowConf.length / allConfidences.length : 0;

  const cardQualities = allCards.map((c) => cardQuality(c.scores));
  const meanCardQuality = cardQualities.length > 0
    ? cardQualities.reduce((a, b) => a + b, 0) / cardQualities.length
    : 0;

  const setTicks = ticks.filter((t) => t.set !== null);
  const setQualities = setTicks.map((t) => setBlock(t.set!));
  const meanSetQuality = setQualities.length > 0
    ? setQualities.reduce((a, b) => a + b, 0) / setQualities.length
    : 0;

  return {
    meanScore, medianScore, interventionRate, criticalFailRate,
    genericUngroundedRate, judgeLowConfidenceRate, meanCardQuality, meanSetQuality,
  };
}

export function aggregateSummaries(summaries: RunSummaryStats[]): RunSummaryStats {
  const n = summaries.length;
  if (n === 0) {
    return {
      meanScore: 0, medianScore: 0, interventionRate: 0, criticalFailRate: 0,
      genericUngroundedRate: 0, judgeLowConfidenceRate: 0, meanCardQuality: 0, meanSetQuality: 0,
    };
  }
  const avg = (fn: (s: RunSummaryStats) => number) =>
    summaries.reduce((sum, s) => sum + fn(s), 0) / n;
  return {
    meanScore: avg((s) => s.meanScore),
    medianScore: avg((s) => s.medianScore),
    interventionRate: avg((s) => s.interventionRate),
    criticalFailRate: avg((s) => s.criticalFailRate),
    genericUngroundedRate: avg((s) => s.genericUngroundedRate),
    judgeLowConfidenceRate: avg((s) => s.judgeLowConfidenceRate),
    meanCardQuality: avg((s) => s.meanCardQuality),
    meanSetQuality: avg((s) => s.meanSetQuality),
  };
}
