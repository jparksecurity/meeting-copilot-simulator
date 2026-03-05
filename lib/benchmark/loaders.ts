import { TranscriptSegment } from '../types';
import { estimateTimestamps, getSpeakers } from '../transcript';

interface QMSumTranscriptEntry {
  speaker: string;
  content: string;
}

interface QMSumDocument {
  meeting_transcripts: QMSumTranscriptEntry[];
  [key: string]: unknown;
}

export function parseQMSum(jsonStr: string): {
  segments: TranscriptSegment[];
  speakers: string[];
} {
  const doc: QMSumDocument = JSON.parse(jsonStr);
  const raw = doc.meeting_transcripts.map((entry) => ({
    speaker: entry.speaker,
    text: entry.content,
  }));
  const segments = estimateTimestamps(raw, 'estimated');
  const speakers = getSpeakers(segments);
  return { segments, speakers };
}

export function pickMostActiveSpeaker(segments: TranscriptSegment[]): string {
  const counts = new Map<string, number>();
  for (const seg of segments) {
    counts.set(seg.speaker, (counts.get(seg.speaker) ?? 0) + 1);
  }
  let best = '';
  let max = 0;
  for (const [speaker, count] of counts) {
    if (count > max) {
      best = speaker;
      max = count;
    }
  }
  return best;
}
