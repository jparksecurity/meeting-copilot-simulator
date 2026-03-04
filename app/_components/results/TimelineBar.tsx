'use client';

import { TickLog } from '../../../lib/types';
import { formatTime } from '../../../lib/transcript';

interface TimelineBarProps {
  ticks: TickLog[];
  currentIdx: number;
  totalDuration: number;
  playing: boolean;
  running: boolean;
  playbackSpeed: number;
  onSeek: (idx: number) => void;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [0.5, 1, 2];

export function TimelineBar({
  ticks,
  currentIdx,
  totalDuration,
  playing,
  running,
  playbackSpeed,
  onSeek,
  onPlay,
  onPrev,
  onNext,
  onSpeedChange,
}: TimelineBarProps) {
  const currentTick = ticks[currentIdx] ?? null;

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-white px-6 py-3 z-20 shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)]">
      {/* Timeline Slider */}
      <div
        className="relative h-5 group cursor-pointer flex items-center select-none mb-2"
        onClick={(e) => {
          if (ticks.length === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const time = percent * totalDuration;
          const nearest = ticks.reduce(
            (best, t, i) => (Math.abs(t.tickTime - time) < Math.abs(ticks[best].tickTime - time) ? i : best),
            0
          );
          onSeek(nearest);
        }}
      >
        {/* Track */}
        <div className="absolute inset-x-0 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100 ease-linear"
            style={{ width: `${(currentTick ? currentTick.tickTime / totalDuration : 0) * 100}%` }}
          />
        </div>

        {/* Intervention Markers */}
        {ticks.map((t, i) => {
          if (!t.result.intervene) return null;
          const left = (t.tickTime / totalDuration) * 100;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full hover:scale-[2] transition-transform z-10"
              style={{ left: `${left}%` }}
              title={`Intervention at ${formatTime(t.tickTime)}`}
            />
          );
        })}

        {/* Thumb */}
        {ticks.length > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-md transition-all duration-100 ease-linear group-hover:scale-125 z-20"
            style={{
              left: `${(currentTick ? currentTick.tickTime / totalDuration : 0) * 100}%`,
              marginLeft: '-6px',
            }}
          />
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: Time */}
        <div className="text-xs font-mono text-zinc-500 w-16">
          {currentTick ? formatTime(currentTick.tickTime) : '0:00'}
        </div>

        {/* Center: Transport controls */}
        <div className="flex items-center gap-4">
          {/* Speed selector */}
          <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${
                  playbackSpeed === speed
                    ? 'bg-white text-zinc-800 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Prev */}
          <button
            onClick={onPrev}
            disabled={currentIdx === 0}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlay}
            disabled={running || currentIdx >= ticks.length - 1}
            className="p-2.5 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            {playing ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
              </svg>
            ) : (
              <svg className="w-5 h-5 pl-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            disabled={currentIdx >= ticks.length - 1}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Right: Duration */}
        <div className="text-xs font-mono text-zinc-400 w-16 text-right">
          {formatTime(Math.ceil(totalDuration))}
        </div>
      </div>
    </div>
  );
}
