import Groq from 'groq-sdk';
import { TranscriptSegment, TickLog, CardResult, TickResult } from '../types';
import { formatTime, getMaxEnd } from '../transcript';
import { fillPrompt, formatTranscriptWindow, DEFAULT_USER_TEMPLATE } from '../prompt';
import { MODEL_ID, TICK_INTERVAL, hashPrompt } from '../constants';
import { GeneratorRun } from './types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function runBenchmarkTicks(
  segments: TranscriptSegment[],
  config: {
    targetParticipant: string;
    contextWindowSeconds: number;
    promptText: string;
    promptLabel: string;
    meetingId: string;
    tickIntervalSeconds?: number;
  }
): Promise<GeneratorRun> {
  const tickInterval = config.tickIntervalSeconds ?? TICK_INTERVAL;
  const lastEnd = getMaxEnd(segments);
  const tickTimes: number[] = [];
  for (let t = tickInterval; t <= Math.ceil(lastEnd); t += tickInterval) {
    tickTimes.push(t);
  }

  const recentCards: CardResult[] = [];
  const ticks: TickLog[] = [];
  const startTime = new Date().toISOString();
  const t0 = Date.now();

  for (const tickTime of tickTimes) {
    const windowStart = Math.max(0, tickTime - config.contextWindowSeconds);
    const transcriptSlice = segments.filter(
      (seg) => seg.start < tickTime && seg.end > windowStart
    );

    const { system, user } = fillPrompt(
      { systemPrompt: config.promptText, userMessage: DEFAULT_USER_TEMPLATE },
      {
        target_participant: config.targetParticipant,
        current_time: formatTime(tickTime),
        context_window: `${config.contextWindowSeconds}s`,
        transcript_slice: formatTranscriptWindow(transcriptSlice),
      }
    );

    const filledPrompt = system + '\n---\n' + user;
    let result: TickResult;
    let rawResponse = '';
    let error: string | undefined;

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL_ID,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const text = completion.choices[0]?.message?.content ?? '';
      rawResponse = text;
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      try {
        result = JSON.parse(cleaned) as TickResult;
      } catch {
        result = { intervene: false, why: 'parse error', cards: [] };
        error = 'JSON parse error';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      result = { intervene: false, why: 'error', cards: [] };
    }

    const log: TickLog = {
      tickTime,
      contextWindowSeconds: config.contextWindowSeconds,
      transcriptSlice,
      recentCards: [...recentCards.slice(-5)],
      filledPrompt,
      result,
      rawResponse,
      uiEvents: [],
      error,
    };

    ticks.push(log);

    if (result.intervene) {
      recentCards.push(...result.cards.filter((c) => c.type !== 'hold'));
    }
  }

  const ph = hashPrompt(config.promptText);
  return {
    runId: `${config.meetingId}_${config.contextWindowSeconds}_${ph}`,
    meetingId: config.meetingId,
    dataset: 'qmsum-product',
    targetParticipant: config.targetParticipant,
    contextWindowSeconds: config.contextWindowSeconds,
    promptHash: ph,
    promptLabel: config.promptLabel,
    modelId: MODEL_ID,
    ticks,
    startTime,
    durationMs: Date.now() - t0,
  };
}
