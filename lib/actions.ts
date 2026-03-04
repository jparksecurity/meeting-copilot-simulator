'use server';

import OpenAI from 'openai';
import type { TranscriptionDiarized } from 'openai/resources/audio/transcriptions';
import type { TranscriptSegment } from './types';

export async function transcribeAudio(
  formData: FormData
): Promise<TranscriptSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const audioFile = formData.get('audio') as File | null;
  if (!audioFile) throw new Error('No audio file provided');

  const client = new OpenAI({ apiKey });
  const data = await client.audio.transcriptions.create({
    file: audioFile,
    model: 'gpt-4o-transcribe-diarize',
    response_format: 'diarized_json',
    chunking_strategy: 'auto',
  }) as TranscriptionDiarized;

  const rawSegments = data.segments ?? [];
  if (rawSegments.length === 0) throw new Error('No speech detected in audio file');

  return rawSegments.map((s) => ({
    start: s.start,
    end: s.end,
    speaker: s.speaker ?? 'Unknown',
    text: s.text.trim(),
    provenance: 'generated' as const,
  }));
}
