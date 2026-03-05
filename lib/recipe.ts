import { TranscriptSegment, ReplayQuality } from './types';
import { estimateTimestamps } from './transcript';

// ── Types ──────────────────────────────────────────────────────────────────

export type TimestampUnit =
  | 'seconds'
  | 'seconds_string'
  | 'milliseconds'
  | 'ticks_100ns'
  | 'iso_duration'
  | 'none';

export type SpeakerType = 'integer' | 'string' | 'speaker_label' | 'absent';

export type GroupingStrategy = 'none' | 'consecutive_speaker';

export interface TransformRecipe {
  arrayPath: string;
  speaker: { field: string | null; type: SpeakerType };
  text: { field: string };
  timestamps: {
    startField: string | null;
    endField: string | null;
    durationField: string | null;
    unit: TimestampUnit;
  };
  grouping: GroupingStrategy;
}

// ── Path Navigation ────────────────────────────────────────────────────────

/**
 * Traverse a dot/bracket path like "results.channels[0].alternatives[0].words"
 * into an object. Returns undefined if the path doesn't resolve.
 */
export function navigatePath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current: unknown = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

// ── Timestamp Conversion ───────────────────────────────────────────────────

/** Parse ISO 8601 duration like PT1H2M3.4S → seconds */
function parseIsoDuration(s: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(s);
  if (!match) return 0;
  const h = parseFloat(match[1] || '0');
  const m = parseFloat(match[2] || '0');
  const sec = parseFloat(match[3] || '0');
  return h * 3600 + m * 60 + sec;
}

/** Convert a raw timestamp value to seconds based on its unit. */
export function toSeconds(value: unknown, unit: TimestampUnit): number {
  if (value == null) return 0;

  switch (unit) {
    case 'seconds':
      return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    case 'seconds_string':
      return parseFloat(String(value)) || 0;
    case 'milliseconds':
      return (typeof value === 'number' ? value : parseFloat(String(value)) || 0) / 1000;
    case 'ticks_100ns':
      return (typeof value === 'number' ? value : parseFloat(String(value)) || 0) / 10_000_000;
    case 'iso_duration':
      return parseIsoDuration(String(value));
    case 'none':
      return 0;
  }
}

// ── Speaker Extraction ─────────────────────────────────────────────────────

export function extractSpeaker(item: Record<string, unknown>, config: TransformRecipe['speaker']): string {
  if (!config.field) return 'Unknown';

  const raw = navigatePath(item, config.field);
  if (raw == null) return 'Unknown';

  switch (config.type) {
    case 'integer':
      return `Speaker ${raw}`;
    case 'string':
      return String(raw);
    case 'speaker_label':
      return String(raw);
    case 'absent':
      return 'Unknown';
    default:
      return String(raw);
  }
}

// ── Text Extraction ────────────────────────────────────────────────────────

function extractText(item: Record<string, unknown>, field: string): string {
  const val = navigatePath(item, field);
  return val != null ? String(val) : '';
}

// ── Grouping ───────────────────────────────────────────────────────────────

interface IntermediateSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Merge consecutive items with the same speaker into single utterances.
 * Used for word-level formats (like Azure STT word arrays).
 */
export function groupBySpeakerTurns(items: IntermediateSegment[]): IntermediateSegment[] {
  if (items.length === 0) return [];

  const result: IntermediateSegment[] = [];
  let current = { ...items[0] };

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    if (item.speaker === current.speaker) {
      current.text += ' ' + item.text;
      current.end = item.end;
    } else {
      result.push(current);
      current = { ...item };
    }
  }
  result.push(current);
  return result;
}

// ── Build Sample ───────────────────────────────────────────────────────────

/**
 * Parse JSON content and build a compact skeleton with the first 3 items
 * of each array. Returns null for non-JSON content.
 */
export function buildSample(content: string): { sample: string; parsed: unknown } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  // Build a skeleton: for arrays, keep only first 3 items
  function skeleton(val: unknown, depth: number): unknown {
    if (depth > 8) return '[...]';
    if (Array.isArray(val)) {
      const sliced = val.slice(0, 3).map((v) => skeleton(v, depth + 1));
      if (val.length > 3) sliced.push(`... (${val.length} total items)`);
      return sliced;
    }
    if (val && typeof val === 'object') {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        obj[k] = skeleton(v, depth + 1);
      }
      return obj;
    }
    return val;
  }

  const sample = JSON.stringify(skeleton(parsed, 0), null, 2);

  // Cap at ~4000 chars
  if (sample.length > 4000) {
    return { sample: sample.slice(0, 4000) + '\n... (truncated)', parsed };
  }
  return { sample, parsed };
}

// ── Apply Recipe ───────────────────────────────────────────────────────────

export function applyRecipe(parsed: unknown, recipe: TransformRecipe): TranscriptSegment[] {
  const arr = navigatePath(parsed, recipe.arrayPath);
  if (!Array.isArray(arr)) {
    throw new Error(`arrayPath "${recipe.arrayPath}" did not resolve to an array`);
  }

  const { timestamps, speaker, text, grouping } = recipe;
  const hasTimestamps = timestamps.unit !== 'none' && (timestamps.startField || timestamps.endField);

  const intermediates: IntermediateSegment[] = arr.map((item) => {
    const spk = extractSpeaker(item as Record<string, unknown>, speaker);
    const txt = extractText(item as Record<string, unknown>, text.field);

    let start = 0;
    let end = 0;

    if (hasTimestamps) {
      if (timestamps.startField) {
        start = toSeconds(navigatePath(item, timestamps.startField), timestamps.unit);
      }
      if (timestamps.endField) {
        end = toSeconds(navigatePath(item, timestamps.endField), timestamps.unit);
      } else if (timestamps.durationField) {
        const dur = toSeconds(navigatePath(item, timestamps.durationField), timestamps.unit);
        end = start + dur;
      }
    }

    return { speaker: spk, text: txt, start, end };
  });

  // Filter out empty text segments
  const filtered = intermediates.filter((s) => s.text.trim().length > 0);

  // Apply grouping
  const grouped = grouping === 'consecutive_speaker'
    ? groupBySpeakerTurns(filtered)
    : filtered;

  // Provenance: exact if source had real timestamps, estimated if we estimated
  if (hasTimestamps) {
    return grouped.map((s) => ({
      ...s,
      provenance: 'exact' as ReplayQuality,
    }));
  }

  // No timestamps — estimate from word count
  return estimateTimestamps(
    grouped.map((s) => ({ speaker: s.speaker, text: s.text })),
    'estimated'
  );
}

// ── Validate Recipe ────────────────────────────────────────────────────────

/**
 * Validate a recipe against the parsed data. Returns null if valid,
 * or an error string describing the problem.
 */
export function validateRecipe(parsed: unknown, recipe: TransformRecipe): string | null {
  // Check arrayPath resolves
  const arr = navigatePath(parsed, recipe.arrayPath);
  if (!Array.isArray(arr)) {
    return `arrayPath "${recipe.arrayPath}" did not resolve to an array (got ${typeof arr})`;
  }
  if (arr.length === 0) {
    return `arrayPath "${recipe.arrayPath}" resolved to an empty array`;
  }

  // Check text field works on first 3 items
  const testItems = arr.slice(0, 3);
  for (let i = 0; i < testItems.length; i++) {
    const txt = navigatePath(testItems[i], recipe.text.field);
    if (txt == null || String(txt).trim() === '') {
      return `text.field "${recipe.text.field}" returned empty for item[${i}]`;
    }
  }

  // Check timestamps convert correctly if present
  if (recipe.timestamps.unit !== 'none' && recipe.timestamps.startField) {
    for (let i = 0; i < testItems.length; i++) {
      const raw = navigatePath(testItems[i], recipe.timestamps.startField);
      if (raw == null) {
        return `timestamps.startField "${recipe.timestamps.startField}" is null for item[${i}]`;
      }
      const val = toSeconds(raw, recipe.timestamps.unit);
      if (!isFinite(val) || val < 0) {
        return `timestamps.startField "${recipe.timestamps.startField}" converted to invalid value ${val} for item[${i}]`;
      }
    }
  }

  return null;
}
