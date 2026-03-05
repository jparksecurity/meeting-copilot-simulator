import Groq from 'groq-sdk';
import { TranscriptSegment } from '../../../lib/types';
import { estimateTimestamps } from '../../../lib/transcript';
import {
  TransformRecipe,
  buildSample,
  applyRecipe,
  validateRecipe,
} from '../../../lib/recipe';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
export const maxDuration = 120;

// ── Phase 1: Recipe Prompt ─────────────────────────────────────────────────

const RECIPE_SYSTEM_PROMPT = `You are a transcript format analyzer. Given a JSON sample from a speech-to-text output file, return a TransformRecipe JSON object that describes how to extract transcript segments.

The recipe schema:
{
  "arrayPath": string,        // dot-separated path to the array of items, e.g. "segments", "utterances", "results.channels[0].alternatives[0].words"
  "speaker": {
    "field": string | null,   // path within each item to the speaker, e.g. "speaker", "speakerId", null if absent
    "type": "integer" | "string" | "speaker_label" | "absent"
      // integer: numeric speaker ID (will become "Speaker 0", "Speaker 1", etc.)
      // string: speaker name as a string
      // speaker_label: prefixed label like "SPEAKER_00"
      // absent: no speaker field exists
  },
  "text": {
    "field": string            // path within each item to the text, e.g. "text", "nbest[0].text", "content"
  },
  "timestamps": {
    "startField": string | null,   // path to start time, e.g. "offset", "start", "start_time"
    "endField": string | null,     // path to end time, e.g. "end", "end_time", null if not present
    "durationField": string | null, // path to duration, e.g. "duration" (used with startField to compute end)
    "unit": "seconds" | "seconds_string" | "milliseconds" | "ticks_100ns" | "iso_duration" | "none"
      // seconds: numeric seconds (e.g. 10.5)
      // seconds_string: string like "10.5"
      // milliseconds: numeric ms (e.g. 10500)
      // ticks_100ns: 100-nanosecond ticks (e.g. 10500000 = 1.05s), common in Azure STT
      // iso_duration: ISO 8601 like "PT1M30S"
      // none: no timestamps available
  },
  "grouping": "none" | "consecutive_speaker"
    // none: each array item is one segment (default for utterance-level)
    // consecutive_speaker: merge consecutive items with same speaker (use for word-level formats)
}

Rules:
- Analyze the sample carefully to identify the correct paths
- For Azure Speech-to-Text: arrayPath is "segments", speaker.field is "speaker", text.field is "nbest[0].text", timestamps use "offset" and "duration" in ticks_100ns
- Look at actual numeric values to determine the unit (values in millions → ticks_100ns, thousands → milliseconds, small decimals → seconds)
- If end time is not directly available but duration is, set endField to null and durationField to the duration path
- Return ONLY the JSON recipe object, no other text`;

async function askForRecipe(
  sample: string,
  priorError?: string
): Promise<TransformRecipe> {
  const userMessage = priorError
    ? `The previous recipe was invalid: ${priorError}\n\nPlease fix the recipe for this sample:\n${sample}`
    : `Analyze this transcript sample and return a TransformRecipe:\n${sample}`;

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    temperature: 0,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: RECIPE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content ?? '';
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned) as TransformRecipe;
}

// ── Fallback: Chunked LLM Normalization (text files) ──────────────────────

const CHUNK_LIMIT = 30_000;
const CHUNK_TARGET = 25_000;

const FALLBACK_SYSTEM_PROMPT = `You are a transcript normalizer. Given any transcript format (JSON, speaker-labeled text, plain text, or any other format), extract an array of segments.

Reply with ONLY a JSON object in this exact format:
{"segments": [{"speaker": "Name", "text": "What they said", "start": null, "end": null}]}

Rules for each segment:
- "speaker": the speaker's name/label as a string (use "Unknown" if not identifiable)
- "text": what the speaker said as a string
- "start": start time in seconds as a number, or null if no timestamps in source
- "end": end time in seconds as a number, or null if no timestamps in source
- Preserve the original speaker labels exactly as they appear
- If timestamps exist in ANY format (seconds, milliseconds, HH:MM:SS, ticks), convert to seconds
- If no timestamps exist, set start and end to null
- Do not merge or split utterances — keep the original segmentation
- Return ALL segments, do not skip any content
- Reply with ONLY the JSON object, no other text`;

function chunkContent(content: string): string[] {
  if (content.length <= CHUNK_LIMIT) return [content];

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_TARGET) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf('\n', CHUNK_TARGET);
    if (splitAt < CHUNK_TARGET * 0.5) {
      splitAt = CHUNK_TARGET;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

type LLMSegment = { speaker: string; text: string; start: number | null; end: number | null };

async function normalizeChunk(content: string): Promise<LLMSegment[]> {
  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    temperature: 0,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: FALLBACK_SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0]?.message?.content ?? '';
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  const segments: LLMSegment[] = Array.isArray(parsed) ? parsed : parsed.segments;
  if (!Array.isArray(segments)) {
    throw new Error('LLM did not return a segments array');
  }
  return segments;
}

function fallbackToTranscriptSegments(raw: LLMSegment[]): TranscriptSegment[] {
  const hasTimestamps = raw.some((s) => s.start !== null && s.end !== null);

  if (hasTimestamps) {
    return raw.map((s) => ({
      speaker: s.speaker || 'Unknown',
      text: s.text,
      start: s.start ?? 0,
      end: s.end ?? (s.start ?? 0),
      provenance: 'estimated' as const,
    }));
  }

  return estimateTimestamps(
    raw.map((s) => ({ speaker: s.speaker || 'Unknown', text: s.text })),
    'estimated'
  );
}

async function fallbackChunkedNormalize(content: string): Promise<TranscriptSegment[]> {
  const chunks = chunkContent(content);
  const allRaw: LLMSegment[] = [];

  for (const chunk of chunks) {
    const segments = await normalizeChunk(chunk);
    allRaw.push(...segments);
  }

  if (allRaw.length === 0) {
    throw new Error('No segments extracted');
  }

  return fallbackToTranscriptSegments(allRaw);
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    const { content }: { content: string } = await req.json();

    if (!content || typeof content !== 'string') {
      return Response.json({ error: 'Missing content' }, { status: 400 });
    }

    // Phase 1: Try to build a JSON sample
    const sampleResult = buildSample(content);

    if (sampleResult) {
      // JSON path — two-phase recipe
      const { sample, parsed } = sampleResult;

      // Ask LLM for a recipe
      let recipe = await askForRecipe(sample);

      // Validate
      let validationError = validateRecipe(parsed, recipe);

      // Retry once with error feedback
      if (validationError) {
        recipe = await askForRecipe(sample, validationError);
        validationError = validateRecipe(parsed, recipe);
      }

      if (!validationError) {
        // Apply recipe programmatically — no LLM, no size limits
        const segments = applyRecipe(parsed, recipe);
        if (segments.length === 0) {
          return Response.json({ error: 'Recipe produced no segments' }, { status: 422 });
        }
        return Response.json(segments);
      }

      // Last resort: fall back to chunked LLM
      console.warn('Recipe validation failed after retry, falling back to chunked LLM:', validationError);
      const segments = await fallbackChunkedNormalize(content);
      return Response.json(segments);
    }

    // Text path — direct chunked LLM normalization
    const segments = await fallbackChunkedNormalize(content);
    return Response.json(segments);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
