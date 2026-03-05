'use client';

import { BenchmarkProgress as ProgressType } from '../../../lib/benchmark/types';

interface Props {
  progress: ProgressType;
  completedRuns: number;
  totalRuns: number;
}

export function BenchmarkProgress({ progress, completedRuns, totalRuns }: Props) {
  const overallPct = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const phasePct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const phaseLabels = {
    load: 'Loading',
    generate: 'Generating',
    judge: 'Judging',
  };

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-700">
            Overall: {completedRuns} / {totalRuns} runs
          </span>
          <span className="text-sm text-zinc-500">{overallPct}%</span>
        </div>
        <div className="w-full bg-zinc-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Current phase */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs uppercase tracking-wide text-zinc-400 font-medium">
              {phaseLabels[progress.phase]}
            </span>
            <p className="text-sm font-medium text-zinc-800 mt-1">
              {progress.currentLabel}
            </p>
          </div>
          <span className="text-sm font-mono text-zinc-500">
            {progress.current}/{progress.total}
          </span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-2">
          <div
            className="bg-blue-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${phasePct}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-400 text-center">
        This may take several minutes depending on the number of meetings and ticks.
      </p>
    </div>
  );
}
