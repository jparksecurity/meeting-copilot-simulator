import OpenAI from 'openai';
import { TickLog } from '../types';
import { formatTranscriptWindow } from '../prompt';
import { JUDGE_MODEL, JUDGE_REASONING_EFFORT } from './constants';
import {
  TickJudgeResult,
  TriggerJudgeResult,
  CardJudgeResult,
  SetJudgeResult,
} from './types';
import { validateCards } from './deterministic';
import { compositeScore } from './scorer';
import {
  TRIGGER_JUDGE_SYSTEM,
  buildTriggerJudgeUser,
  CARD_JUDGE_SYSTEM,
  buildCardJudgeUser,
  SET_JUDGE_SYSTEM,
  buildSetJudgeUser,
} from './judge-prompts';

const openai = new OpenAI();

async function callJudge<T>(system: string, user: string): Promise<T> {
  const completion = await openai.chat.completions.create({
    model: JUDGE_MODEL,
    reasoning_effort: JUDGE_REASONING_EFFORT,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  });
  const text = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(text) as T;
}

export async function judgeTick(
  tick: TickLog,
  targetParticipant: string
): Promise<TickJudgeResult> {
  // 1. Deterministic validation
  const { results: deterministicResults } = validateCards(tick.result.cards);

  // Pre-format transcript once for all judge calls
  const formattedTranscript = formatTranscriptWindow(tick.transcriptSlice);

  // 2. Trigger + card judges in parallel (independent evaluations)
  const triggerPromise = callJudge<TriggerJudgeResult>(
    TRIGGER_JUDGE_SYSTEM,
    buildTriggerJudgeUser(tick, targetParticipant, formattedTranscript)
  );

  const cardPromises = tick.result.cards.map((card, i) =>
    callJudge<CardJudgeResult>(
      CARD_JUDGE_SYSTEM,
      buildCardJudgeUser(card, i, formattedTranscript, targetParticipant)
    ).then((result) => ({ ...result, index: i }))
  );

  const [trigger, ...cards] = await Promise.all([triggerPromise, ...cardPromises]);

  // 3. Set judge (only if intervene and has cards)
  let set: SetJudgeResult | null = null;
  if (tick.result.intervene && tick.result.cards.length > 0) {
    set = await callJudge<SetJudgeResult>(
      SET_JUDGE_SYSTEM,
      buildSetJudgeUser(tick, targetParticipant, formattedTranscript)
    );
  }

  // 4. Composite score
  const score = compositeScore(trigger, cards, set);

  return {
    tickTime: tick.tickTime,
    trigger,
    cards,
    set,
    deterministic: deterministicResults,
    compositeScore: score,
  };
}

const JUDGE_CONCURRENCY = 10;

export async function judgeAllTicks(
  ticks: TickLog[],
  targetParticipant: string
): Promise<TickJudgeResult[]> {
  const results: TickJudgeResult[] = new Array(ticks.length);
  let next = 0;

  async function worker() {
    while (next < ticks.length) {
      const idx = next++;
      results[idx] = await judgeTick(ticks[idx], targetParticipant);
    }
  }

  const workers = Array.from({ length: Math.min(JUDGE_CONCURRENCY, ticks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
