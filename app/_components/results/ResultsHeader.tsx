'use client';

import { TickLog, RunLog, RunConfig, ReplayQuality } from '../../../lib/types';
import { QUALITY_BADGE } from '../../../lib/constants';

interface ResultsHeaderProps {
  config: RunConfig;
  ticks: TickLog[];
  totalTicks: number;
  running: boolean;
  runLog: RunLog | null;
  showSettings: boolean;
  quality: ReplayQuality;
  onToggleSettings: () => void;
  onReset: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export function ResultsHeader({
  config,
  ticks,
  totalTicks,
  running,
  runLog,
  showSettings,
  quality,
  onToggleSettings,
  onReset,
  onExportCSV,
  onExportJSON,
}: ResultsHeaderProps) {
  const qBadge = QUALITY_BADGE[quality];

  return (
    <div className="flex items-center justify-between px-6 py-2.5 border-b border-zinc-200 bg-white shrink-0 z-20">
      {/* Left: Breadcrumb + run info */}
      <div className="flex items-center gap-3">
        <h1 className="font-bold text-zinc-800 text-sm">Meeting Copilot Simulator</h1>
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <span>/</span>
          <span className="text-zinc-600 font-medium">{config.targetParticipant}</span>
          <span>/</span>
          <span className="text-zinc-500">Replay</span>
        </div>
        <span className={`${qBadge.className} px-1.5 py-0.5 rounded text-[10px] font-medium`}>
          {qBadge.label}
        </span>
        {running && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-zinc-400">
              {ticks.length}/{totalTicks} ticks
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex gap-1.5 items-center">
        <button
          onClick={onToggleSettings}
          className={`text-xs px-3 py-1.5 border rounded-lg transition-colors ${
            showSettings
              ? 'bg-zinc-800 text-white border-zinc-800'
              : 'border-zinc-200 hover:bg-zinc-50 text-zinc-500'
          }`}
        >
          Settings
        </button>
        {!running && runLog && (
          <>
            <button
              onClick={onExportCSV}
              className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-500"
            >
              Export CSV
            </button>
            <button
              onClick={onExportJSON}
              className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-500"
            >
              Export JSON
            </button>
          </>
        )}
        <button
          onClick={onReset}
          className="text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-zinc-500"
        >
          New Run
        </button>
      </div>
    </div>
  );
}
