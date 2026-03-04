import { TranscriptSegment, ReplayQuality } from './types';

const SECONDS_PER_WORD = 1 / 3;

type RawSegment = { speaker: string; text: string };

function estimateTimestamps(
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

export function parseTranscript(content: string): TranscriptSegment[] {
  try {
    const parsed = JSON.parse(content);
    // QMSum format: top-level object with meeting_transcripts array using "content" field
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.meeting_transcripts)) {
      const rawSegments: RawSegment[] = (parsed.meeting_transcripts as { speaker: string; content: string }[])
        .filter((s) => s.speaker && s.content)
        .map((s) => ({ speaker: s.speaker, text: s.content }));
      return estimateTimestamps(rawSegments, 'estimated');
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if ('start' in first && 'end' in first && 'speaker' in first && 'text' in first) {
        return (parsed as Omit<TranscriptSegment, 'provenance'>[]).map((s) => ({
          ...s,
          provenance: 'exact' as ReplayQuality,
        }));
      }
      if ('start' in first && 'end' in first && 'text' in first && !('speaker' in first)) {
        return (parsed as { start: number; end: number; text: string }[]).map((s) => ({
          start: s.start,
          end: s.end,
          speaker: 'Unknown',
          text: s.text,
          provenance: 'exact' as ReplayQuality,
        }));
      }
      if ('speaker' in first && 'text' in first) {
        return estimateTimestamps(parsed as RawSegment[], 'estimated');
      }
    }
  } catch {
    // not JSON — fall through to text parsing
  }

  const speakerLineRegex = /^([A-Za-z][A-Za-z0-9 _-]{0,30}):\s+(.+)$/;
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const speakerLines = lines.filter((l) => speakerLineRegex.test(l.trim()));

  if (speakerLines.length > 0 && speakerLines.length >= lines.length * 0.5) {
    const rawSegments: RawSegment[] = speakerLines.map((line) => {
      const m = line.trim().match(speakerLineRegex)!;
      return { speaker: m[1].trim(), text: m[2].trim() };
    });
    return estimateTimestamps(rawSegments, 'estimated');
  }

  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const rawSegments: RawSegment[] = sentences.map((text) => ({ speaker: 'Unknown', text }));
  return estimateTimestamps(rawSegments, 'approximate');
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
