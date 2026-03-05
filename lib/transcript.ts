import { TranscriptSegment, ReplayQuality } from './types';

const SECONDS_PER_WORD = 1 / 3;

type RawSegment = { speaker: string; text: string };

export function estimateTimestamps(
  segments: RawSegment[],
  provenance: ReplayQuality
): TranscriptSegment[] {
  let cursor = 0;
  return segments.map((seg) => {
    const wordCount = seg.text.trim().split(/\s+/).length;
    const duration = Math.max(1, wordCount * SECONDS_PER_WORD);
    const start = cursor;
    const end = cursor + duration;
    cursor = end + 0.5;
    return { ...seg, start, end, provenance };
  });
}

export function getReplayQuality(segments: TranscriptSegment[]): ReplayQuality {
  return segments[0]?.provenance ?? 'approximate';
}

/**
 * Fast-path parser: only recognizes JSON arrays already in canonical
 * [{start: number, end: number, speaker: string, text: string}] format.
 * Returns null for anything else (caller should use /api/normalize).
 */
export function tryFastParse(content: string): TranscriptSegment[] | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (
        typeof first.start === 'number' &&
        typeof first.end === 'number' &&
        typeof first.speaker === 'string' &&
        typeof first.text === 'string'
      ) {
        return (parsed as Omit<TranscriptSegment, 'provenance'>[]).map((s) => ({
          ...s,
          provenance: 'exact' as ReplayQuality,
        }));
      }
    }
  } catch {
    // not JSON or not the right shape
  }
  return null;
}

export function getMaxEnd(segments: TranscriptSegment[]): number {
  return segments.reduce((max, s) => s.end > max ? s.end : max, 0);
}

export function getSpeakers(segments: TranscriptSegment[]): string[] {
  return Array.from(new Set(segments.map((s) => s.speaker)));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
