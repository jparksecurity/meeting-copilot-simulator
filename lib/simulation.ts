import { TranscriptSegment, TickLog, CardResult, TickResult } from './types';
import { formatTime } from './transcript';
import { fillPrompt, formatTranscriptWindow, DEFAULT_USER_TEMPLATE } from './prompt';

interface SimulationConfig {
  targetParticipant: string;
  contextWindowSeconds: number;
  promptTemplate: string;
  tickIntervalSeconds?: number;
}

export async function runTick(
  tickTime: number,
  segments: TranscriptSegment[],
  config: SimulationConfig,
  recentCards: CardResult[]
): Promise<TickLog> {
  const { targetParticipant, contextWindowSeconds, promptTemplate } = config;

  const windowStart = Math.max(0, tickTime - contextWindowSeconds);
  const transcriptSlice = segments.filter(
    (seg) => seg.start < tickTime && seg.end > windowStart
  );

  const { system, user } = fillPrompt(
    { systemPrompt: promptTemplate, userMessage: DEFAULT_USER_TEMPLATE },
    {
      target_participant: targetParticipant,
      current_time: formatTime(tickTime),
      context_window: `${contextWindowSeconds}s`,
      transcript_slice: formatTranscriptWindow(transcriptSlice),
    }
  );

  const filledPrompt = system + '\n---\n' + user;

  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: system, userMessage: user }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error');
    const { result, raw } = data as { result: TickResult; raw: string };

    return {
      tickTime,
      contextWindowSeconds,
      transcriptSlice,
      recentCards: [...recentCards],
      filledPrompt,
      result,
      rawResponse: raw ?? '',
      uiEvents: [],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      tickTime,
      contextWindowSeconds,
      transcriptSlice,
      recentCards: [...recentCards],
      filledPrompt,
      result: { intervene: false, why: 'error', cards: [] },
      rawResponse: '',
      uiEvents: [],
      error: errorMsg,
    };
  }
}

export async function* runAllTicks(
  segments: TranscriptSegment[],
  config: SimulationConfig
): AsyncGenerator<TickLog> {
  const tickInterval = config.tickIntervalSeconds ?? 30;
  const lastEnd = segments.reduce((max, s) => s.end > max ? s.end : max, 0);
  const tickTimes: number[] = [];
  for (let t = tickInterval; t <= Math.ceil(lastEnd); t += tickInterval) {
    tickTimes.push(t);
  }

  const recentCards: CardResult[] = [];

  for (const t of tickTimes) {
    const log = await runTick(t, segments, config, recentCards.slice(-5));
    if (log.result.intervene) {
      recentCards.push(...log.result.cards.filter((c) => c.type !== 'hold'));
    }
    yield log;
  }
}
