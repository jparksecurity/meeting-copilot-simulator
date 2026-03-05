'use client';

import { useState, useCallback } from 'react';
import { AppHeader } from '../_components/AppHeader';
import { BenchmarkConfigPanel } from '../_components/benchmark/BenchmarkConfig';
import { BenchmarkProgress } from '../_components/benchmark/BenchmarkProgress';
import { BenchmarkResults } from '../_components/benchmark/BenchmarkResults';
import {
  BenchmarkStage,
  BenchmarkConfig,
  BenchmarkProgress as ProgressType,
  JudgedRun,
  GeneratorRun,
} from '../../lib/benchmark/types';
import { TranscriptSegment } from '../../lib/types';
import { pickMostActiveSpeaker } from '../../lib/benchmark/loaders';

export default function BenchmarkPage() {
  const [stage, setStage] = useState<BenchmarkStage>('configure');
  const [progress, setProgress] = useState<ProgressType>({
    phase: 'load',
    current: 0,
    total: 0,
    currentLabel: '',
  });
  const [totalRuns, setTotalRuns] = useState(0);
  const [results, setResults] = useState<JudgedRun[]>([]);
  const [error, setError] = useState('');

  const runBenchmark = useCallback(async (config: BenchmarkConfig) => {
    setStage('running');
    setError('');
    setResults([]);

    const combos: { meetingId: string; contextWindow: number }[] = [];
    for (const meetingId of config.meetingIds) {
      for (const cw of config.contextWindows) {
        combos.push({ meetingId, contextWindow: cw });
      }
    }

    setTotalRuns(combos.length);

    // Cache loaded meetings to avoid re-fetching
    const meetingCache = new Map<string, { segments: TranscriptSegment[]; speakers: string[] }>();

    for (let i = 0; i < combos.length; i++) {
      const { meetingId, contextWindow } = combos[i];

      try {
        // Load meeting (use cache if available)
        let meetingData = meetingCache.get(meetingId);
        if (!meetingData) {
          setProgress({
            phase: 'load',
            current: i + 1,
            total: combos.length,
            currentLabel: `Loading ${meetingId}...`,
          });

          const loadRes = await fetch('/api/benchmark/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meetingId }),
          });
          if (!loadRes.ok) {
            const err = await loadRes.json();
            throw new Error(err.error || `Load failed: ${loadRes.status}`);
          }
          meetingData = await loadRes.json();
          meetingCache.set(meetingId, meetingData!);
        }

        const { segments } = meetingData!;

        const targetParticipant =
          config.targetStrategy === 'manual' && config.manualTarget
            ? config.manualTarget
            : pickMostActiveSpeaker(segments);

        // Generate
        setProgress({
          phase: 'generate',
          current: i + 1,
          total: combos.length,
          currentLabel: `${meetingId} @ ${contextWindow}s — generating ticks`,
        });

        const genRes = await fetch('/api/benchmark/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segments,
            targetParticipant,
            contextWindowSeconds: contextWindow,
            promptText: config.promptText,
            promptLabel: config.promptLabel,
            meetingId,
          }),
        });
        if (!genRes.ok) {
          const err = await genRes.json();
          throw new Error(err.error || `Generate failed: ${genRes.status}`);
        }
        const { run: generatorRun }: { run: GeneratorRun } = await genRes.json();

        // Judge
        setProgress({
          phase: 'judge',
          current: i + 1,
          total: combos.length,
          currentLabel: `${meetingId} @ ${contextWindow}s — judging ${generatorRun.ticks.length} ticks`,
        });

        const judgeRes = await fetch('/api/benchmark/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generatorRun }),
        });
        if (!judgeRes.ok) {
          const err = await judgeRes.json();
          throw new Error(err.error || `Judge failed: ${judgeRes.status}`);
        }
        const { judgedRun }: { judgedRun: JudgedRun } = await judgeRes.json();

        setResults((prev) => [...prev, judgedRun]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Error on ${meetingId} @ ${contextWindow}s: ${msg}`);
      }
    }

    setStage('results');
  }, []);

  const completedRuns = results.length;

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      <AppHeader
        breadcrumb={['Benchmark']}
        right={
          stage !== 'configure' && (
            <a
              href="/benchmark"
              className="text-sm text-blue-600 hover:underline"
            >
              Reset
            </a>
          )
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Stage indicator */}
          <div className="flex items-center gap-3 mb-8">
            {(['configure', 'running', 'results'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-zinc-300" />}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    s === stage
                      ? 'bg-blue-100 text-blue-700'
                      : stage === 'results' || (stage === 'running' && s === 'configure')
                        ? 'bg-green-100 text-green-700'
                        : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {stage === 'configure' && (
            <BenchmarkConfigPanel onRun={runBenchmark} />
          )}

          {stage === 'running' && (
            <BenchmarkProgress
              progress={progress}
              completedRuns={completedRuns}
              totalRuns={totalRuns}
            />
          )}

          {stage === 'results' && (
            <BenchmarkResults
              runs={results}
              onReset={() => {
                setStage('configure');
                setResults([]);
                setError('');
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
