import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { TranscriptionDiarized } from 'openai/resources/audio/transcriptions';
import type { TranscriptSegment } from '../../../lib/types';

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const formData = await request.formData();
  const audioFile = formData.get('audio') as File | null;
  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey });
    const data = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-transcribe-diarize',
      response_format: 'diarized_json',
      chunking_strategy: 'auto',
    }) as TranscriptionDiarized;

    const rawSegments = data.segments ?? [];
    if (rawSegments.length === 0) {
      return NextResponse.json({ error: 'No speech detected in audio file' }, { status: 422 });
    }

    const segments: TranscriptSegment[] = rawSegments.map((s) => ({
      start: s.start,
      end: s.end,
      speaker: s.speaker ?? 'Unknown',
      text: s.text.trim(),
      provenance: 'generated' as const,
    }));

    return NextResponse.json(segments);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
