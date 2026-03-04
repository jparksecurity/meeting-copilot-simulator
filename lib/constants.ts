import { ReplayQuality, TickLog } from './types';
import { formatTime } from './transcript';

export const CONTEXT_PRESETS = [30, 60, 120, 300];
export const MODEL_ID = 'openai/gpt-oss-120b';
export const TICK_INTERVAL = 30;
export const PLAY_SPEED_MS = 2000;

export const CARD_COLORS: Record<string, string> = {
  ask: 'bg-blue-100 text-blue-800 border-blue-200',
  frame: 'bg-purple-100 text-purple-800 border-purple-200',
  summarize: 'bg-green-100 text-green-800 border-green-200',
  challenge: 'bg-red-100 text-red-800 border-red-200',
  search: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  decide: 'bg-orange-100 text-orange-800 border-orange-200',
  relate: 'bg-pink-100 text-pink-800 border-pink-200',
  capture: 'bg-teal-100 text-teal-800 border-teal-200',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  processing: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export const QUALITY_BADGE: Record<ReplayQuality, { label: string; className: string; warn?: string }> = {
  exact: { label: 'Exact replay', className: 'bg-green-100 text-green-800' },
  estimated: {
    label: 'Estimated replay',
    className: 'bg-yellow-100 text-yellow-800',
    warn: 'Timestamps estimated from speaking-rate heuristic.',
  },
  approximate: {
    label: 'Highly approximate',
    className: 'bg-orange-100 text-orange-800',
    warn: 'No speaker labels detected. Suggestions will be less personalized.',
  },
  generated: {
    label: 'Generated transcript',
    className: 'bg-blue-100 text-blue-800',
    warn: 'Transcript was generated from audio.',
  },
};

export const AUDIO_EXTENSIONS = ['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg', '.mpeg'];
export const MAX_AUDIO_MB = 25;

export function hashPrompt(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function detectSourceType(filename: string): string {
  if (filename.endsWith('.json')) return 'json-transcript';
  if (filename.endsWith('.txt')) return 'text-transcript';
  if (/\.(mp3|mp4|m4a|wav|ogg|webm|mpeg)$/i.test(filename)) return 'audio';
  return 'unknown';
}

export function isAudioFile(name: string): boolean {
  return AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

export function ticksToCSV(ticks: TickLog[]): string {
  const header = 'tick_time,intervene,confidence,reason,num_cards,card1_type,card1_line,card2_type,card2_line,card3_type,card3_line,error';
  const rows = ticks.map((t) => {
    const c = t.result.cards;
    const cells = [
      formatTime(t.tickTime),
      t.result.intervene,
      t.result.confidence,
      `"${(t.result.reason ?? '').replace(/"/g, '""')}"`,
      c.length,
      c[0]?.type ?? '',
      `"${(c[0]?.line ?? '').replace(/"/g, '""')}"`,
      c[1]?.type ?? '',
      `"${(c[1]?.line ?? '').replace(/"/g, '""')}"`,
      c[2]?.type ?? '',
      `"${(c[2]?.line ?? '').replace(/"/g, '""')}"`,
      `"${(t.error ?? '').replace(/"/g, '""')}"`,
    ];
    return cells.join(',');
  });
  return [header, ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
