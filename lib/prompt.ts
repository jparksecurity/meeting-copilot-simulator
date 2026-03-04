import { TranscriptSegment, CardResult } from './types';
import { formatTime } from './transcript';

export const DEFAULT_PROMPT = `You are a private meeting copilot for one participant.

Your job is to decide whether the target participant should receive a private intervention right now.
Do not try to manage the whole meeting. Optimize for the target participant's next best move.

Rules:
- It is valid to return no intervention.
- If you intervene, return at most 3 one-line cards. Each card line must be one sentence of 12 words or fewer.
- Each card must be grounded in the recent transcript.
- Be specific, tactful, and immediately actionable.
- Avoid generic advice, repetition, manipulation, and long explanations.
- Good card types include: ask, frame, summarize, challenge, search, decide, relate, capture.
- Favor hold when there is no clear opportunity.

Think silently about:
1) meeting purpose
2) live conversational move
3) what would help this participant most right now
4) social tact and timing

Return strict JSON only:
{
  "intervene": boolean,
  "confidence": number,
  "reason": "one short sentence",
  "cards": [
    {"type": "ask|frame|summarize|challenge|search|decide|relate|capture", "line": "one line"}
  ]
}

Target participant: {{target_participant}}
Current meeting time: {{tick_time}}
Context window size: {{context_window}}
Recent cards shown: {{recent_cards}}
Recent transcript:
{{transcript_window}}
`;

export function formatTranscriptWindow(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => `[${formatTime(seg.start)}] ${seg.speaker}: ${seg.text}`)
    .join('\n');
}

interface PromptVars {
  target_participant: string;
  tick_time: string;
  context_window: string;
  recent_cards: string;
  transcript_window: string;
}

export function fillPrompt(template: string, vars: PromptVars): string {
  return template
    .replaceAll('{{target_participant}}', vars.target_participant)
    .replaceAll('{{tick_time}}', vars.tick_time)
    .replaceAll('{{context_window}}', vars.context_window)
    .replaceAll('{{recent_cards}}', vars.recent_cards)
    .replaceAll('{{transcript_window}}', vars.transcript_window);
}

export function formatRecentCards(cards: CardResult[]): string {
  if (cards.length === 0) return '(none)';
  return cards.map((c) => `[${c.type}] ${c.line}`).join('\n');
}
