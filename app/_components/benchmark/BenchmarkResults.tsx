'use client';

import { useMemo, useState } from 'react';
import { JudgedRun, TickJudgeResult } from '../../../lib/benchmark/types';
import { aggregateSummaries } from '../../../lib/benchmark/scorer';
import { downloadFile } from '../../../lib/constants';
import { formatTime } from '../../../lib/transcript';

interface Props {
  runs: JudgedRun[];
  onReset: () => void;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtScore(v: number): string {
  return v.toFixed(1);
}

function scoreColor(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.75) return 'bg-green-50 text-green-800';
  if (ratio >= 0.5) return 'bg-yellow-50 text-yellow-800';
  return 'bg-red-50 text-red-800';
}

function rateColor(rate: number, inverted = false): string {
  const v = inverted ? rate : 1 - rate;
  if (v >= 0.75) return 'bg-green-50 text-green-800';
  if (v >= 0.5) return 'bg-yellow-50 text-yellow-800';
  return 'bg-red-50 text-red-800';
}

function buildCSV(runs: JudgedRun[]): string {
  const header = 'meeting,context_window,prompt_label,mean_score,median_score,intervention_rate,critical_fail_rate,mean_card_quality,mean_set_quality,judge_low_confidence_rate';
  const rows = runs.map((r) => {
    const s = r.summary;
    const g = r.generatorRun;
    return [
      g.meetingId, g.contextWindowSeconds, g.promptLabel,
      fmtScore(s.meanScore), fmtScore(s.medianScore),
      fmtPct(s.interventionRate), fmtPct(s.criticalFailRate),
      s.meanCardQuality.toFixed(3), s.meanSetQuality.toFixed(3),
      fmtPct(s.judgeLowConfidenceRate),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

export function BenchmarkResults({ runs, onReset }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const byContext = useMemo(() => {
    const map = new Map<number, JudgedRun[]>();
    for (const run of runs) {
      const cw = run.generatorRun.contextWindowSeconds;
      if (!map.has(cw)) map.set(cw, []);
      map.get(cw)!.push(run);
    }
    return map;
  }, [runs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-800">
          Results ({runs.length} run{runs.length !== 1 ? 's' : ''})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => downloadFile(
              JSON.stringify(runs, null, 2),
              `benchmark_${new Date().toISOString().slice(0, 19)}.json`,
              'application/json'
            )}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Export JSON
          </button>
          <button
            onClick={() => downloadFile(
              buildCSV(runs),
              `benchmark_${new Date().toISOString().slice(0, 19)}.csv`,
              'text/csv'
            )}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Export CSV
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            New Benchmark
          </button>
        </div>
      </div>

      {/* Main table */}
      <div className="overflow-x-auto border border-zinc-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-4 py-2.5 font-medium text-zinc-600">Meeting</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-600">Context</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Mean Score</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Interv. Rate</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Crit. Fail</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Card Quality</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Set Quality</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Low Conf.</th>
            </tr>
          </thead>
          {runs.map((run) => {
            const g = run.generatorRun;
            const s = run.summary;
            const key = g.runId;
            const isExpanded = expandedRow === key;

            return (
              <tbody key={key}>
                <tr
                  onClick={() => setExpandedRow(isExpanded ? null : key)}
                  className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-mono">{g.meetingId}</td>
                  <td className="px-4 py-2.5">{g.contextWindowSeconds}s</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(s.meanScore, 100)}`}>
                    {fmtScore(s.meanScore)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtPct(s.interventionRate)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${rateColor(s.criticalFailRate)}`}>
                    {fmtPct(s.criticalFailRate)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(s.meanCardQuality, 1)}`}>
                    {s.meanCardQuality.toFixed(3)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${scoreColor(s.meanSetQuality, 1)}`}>
                    {s.meanSetQuality.toFixed(3)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${rateColor(s.judgeLowConfidenceRate)}`}>
                    {fmtPct(s.judgeLowConfidenceRate)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 bg-zinc-50">
                      <TickDetails ticks={run.judgedTicks} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}

          {/* Aggregate rows per context window */}
          {Array.from(byContext.entries()).map(([cw, group]) => {
            const agg = aggregateSummaries(group.map((r) => r.summary));
            return (
              <tbody key={`agg-${cw}`}>
                <tr className="bg-blue-50 border-t-2 border-blue-200 font-medium">
                  <td className="px-4 py-2.5 text-blue-800">Avg ({group.length} meetings)</td>
                  <td className="px-4 py-2.5 text-blue-800">{cw}s</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-800">{fmtScore(agg.meanScore)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-800">{fmtPct(agg.interventionRate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-800">{fmtPct(agg.criticalFailRate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-800">{agg.meanCardQuality.toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-800">{agg.meanSetQuality.toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-blue-800">{fmtPct(agg.judgeLowConfidenceRate)}</td>
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}

function TickDetails({ ticks }: { ticks: TickJudgeResult[] }) {
  if (ticks.length === 0) {
    return <p className="text-xs text-zinc-500">No ticks</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500">
            <th className="text-left px-2 py-1">Tick</th>
            <th className="text-left px-2 py-1">Decision</th>
            <th className="text-right px-2 py-1">Score</th>
            <th className="text-right px-2 py-1">Trigger Correct</th>
            <th className="text-right px-2 py-1">Cards</th>
            <th className="text-left px-2 py-1">Flags</th>
            <th className="text-right px-2 py-1">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((t) => {
            const allFlags = t.cards.flatMap((c) => c.hard_fail_flags);
            return (
              <tr key={t.tickTime} className="border-t border-zinc-100">
                <td className="px-2 py-1 font-mono">{formatTime(t.tickTime)}</td>
                <td className="px-2 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    t.trigger.candidate_decision === 'intervene'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {t.trigger.candidate_decision}
                  </span>
                </td>
                <td className={`px-2 py-1 text-right font-mono ${scoreColor(t.compositeScore, 100)}`}>
                  {t.compositeScore.toFixed(1)}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {t.trigger.decision_correct ? 'Y' : 'N'}
                </td>
                <td className="px-2 py-1 text-right font-mono">{t.cards.length}</td>
                <td className="px-2 py-1">
                  {allFlags.length > 0 ? (
                    <span className="text-red-600">{allFlags.join(', ')}</span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  {t.trigger.confidence.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
