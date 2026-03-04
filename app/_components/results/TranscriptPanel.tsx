'use client';

import { RefObject, useState } from 'react';
import { TranscriptSegment, TickLog } from '../../../lib/types';
import { formatTime } from '../../../lib/transcript';

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  currentTick: TickLog | null;
  targetParticipant: string;
  transcriptRef: RefObject<HTMLDivElement | null>;
}

export function TranscriptPanel({ segments, currentTick, targetParticipant, transcriptRef }: TranscriptPanelProps) {
  const [search, setSearch] = useState('');
  const windowStart = currentTick ? Math.max(0, currentTick.tickTime - currentTick.contextWindowSeconds) : 0;
  const windowEnd = currentTick ? currentTick.tickTime : 0;

  const filtered = search.trim()
    ? segments.filter((s) => s.text.toLowerCase().includes(search.toLowerCase()) || s.speaker.toLowerCase().includes(search.toLowerCase()))
    : segments;

  // Find the single current segment: last segment whose start <= tickTime
  const currentSegIndex = currentTick
    ? filtered.reduce((best, seg, i) => (seg.start <= currentTick.tickTime ? i : best), -1)
    : -1;

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      {/* Search */}
      <div className="px-4 py-2.5 border-b border-zinc-200 bg-white shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search transcript..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-300 outline-none bg-zinc-50"
          />
        </div>
      </div>

      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.map((seg, i) => {
          const isTarget = seg.speaker === targetParticipant;
          const inWindow = currentTick && seg.start < windowEnd && seg.end > windowStart;
          const isCurrent = i === currentSegIndex;

          return (
            <div
              key={i}
              data-highlighted={isCurrent ? 'true' : 'false'}
              className={`flex flex-col ${isTarget ? 'items-end' : 'items-start'} transition-opacity duration-200 ${
                inWindow ? 'opacity-100' : 'opacity-40 hover:opacity-80'
              }`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm relative transition-all ${
                  isCurrent ? 'ring-2 ring-blue-400 ring-offset-2 shadow-sm' : ''
                } ${
                  isTarget
                    ? 'bg-blue-100 text-blue-900 rounded-br-sm'
                    : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm'
                }`}
              >
                <div className={`text-[10px] mb-1 font-semibold flex items-center gap-1.5 ${
                  isTarget ? 'text-blue-600 flex-row-reverse' : 'text-zinc-500'
                }`}>
                  {/* Speaker pill */}
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                    isTarget ? 'bg-blue-200/60 text-blue-700' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {seg.speaker}
                  </span>
                  <span className="font-normal opacity-60 text-[10px]">{formatTime(seg.start)}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{seg.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
