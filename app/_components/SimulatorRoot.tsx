'use client';

import { useState } from 'react';
import { TranscriptSegment, TickLog, RunLog, RunConfig, RunSummary } from '../../lib/types';
import { getReplayQuality, getMaxEnd } from '../../lib/transcript';
import { DEFAULT_PROMPT } from '../../lib/prompt';
import { runAllTicks } from '../../lib/simulation';
import { TICK_INTERVAL, MODEL_ID, detectSourceType, hashPrompt } from '../../lib/constants';
import { HomePage } from './HomePage';
import { UploadStage } from './UploadStage';
import { ProcessingStage } from './ProcessingStage';
import { ConfigureStage } from './ConfigureStage';
import { ResultsStage } from './ResultsStage';

type Stage = 'home' | 'upload' | 'processing' | 'configure' | 'replay';

export function SimulatorRoot() {
  const [stage, setStage] = useState<Stage>('home');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [filename, setFilename] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [ticks, setTicks] = useState<TickLog[]>([]);
  const [totalTicks, setTotalTicks] = useState(0);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<RunLog | null>(null);
  const [runConfig, setRunConfig] = useState<RunConfig>({
    targetParticipant: '',
    contextWindowSeconds: 60,
    prompt: DEFAULT_PROMPT,
  });

  const resetState = (target: Stage) => {
    setStage(target);
    setSegments([]);
    setFilename('');
    setFile(null);
    setTicks([]);
    setTotalTicks(0);
    setRunLog(null);
    setRunning(false);
  };

  const handleNewRun = () => resetState('upload');

  const handleUploadParsed = (segs: TranscriptSegment[], name: string, uploadedFile: File) => {
    setFilename(name);
    setFile(uploadedFile);
    if (segs.length > 0) {
      // Transcript already parsed, skip processing
      setSegments(segs);
      setStage('processing');
    } else {
      // Audio file, needs processing
      setSegments([]);
      setStage('processing');
    }
  };

  const handleProcessingComplete = (segs: TranscriptSegment[]) => {
    setSegments(segs);
    setStage('configure');
  };

  const handleRun = async (config: RunConfig) => {
    setRunConfig(config);
    const lastEnd = getMaxEnd(segments);
    const total = Math.floor(Math.ceil(lastEnd) / TICK_INTERVAL);
    setTotalTicks(total);
    setTicks([]);
    setRunLog(null);
    setRunning(true);
    setStage('replay');

    const runId = Date.now().toString(36);
    const startTime = new Date().toISOString();
    const collectedTicks: TickLog[] = [];

    const generator = runAllTicks(segments, {
      targetParticipant: config.targetParticipant,
      contextWindowSeconds: config.contextWindowSeconds,
      promptTemplate: config.prompt,
      tickIntervalSeconds: TICK_INTERVAL,
    });

    try {
      for await (const tick of generator) {
        collectedTicks.push(tick);
        setTicks([...collectedTicks]);
      }
    } finally {
      const log: RunLog = {
        runId,
        startTime,
        sourceFile: filename,
        sourceType: detectSourceType(filename),
        replayQuality: getReplayQuality(segments),
        promptHash: hashPrompt(config.prompt),
        targetParticipant: config.targetParticipant,
        prompt: config.prompt,
        contextWindowSeconds: config.contextWindowSeconds,
        stepInterval: TICK_INTERVAL,
        modelId: MODEL_ID,
        ticks: collectedTicks,
      };
      setRunLog(log);
      setRunning(false);

      // Save to localStorage for Runs page
      saveRunSummary(log, collectedTicks);
    }
  };

  const handleReset = () => resetState('home');

  const handleOpenRun = (runId: string) => {
    try {
      const stored = localStorage.getItem(`mcs-run-${runId}`);
      if (!stored) return;
      const log: RunLog = JSON.parse(stored);
      setRunLog(log);
      setTicks(log.ticks);
      setTotalTicks(log.ticks.length);
      setFilename(log.sourceFile);
      setRunConfig({
        targetParticipant: log.targetParticipant,
        contextWindowSeconds: log.contextWindowSeconds,
        prompt: log.prompt,
      });
      // Reconstruct minimal segments from ticks
      const allSegs = log.ticks.flatMap((t) => t.transcriptSlice);
      const seen = new Map<string, TranscriptSegment>();
      for (const seg of allSegs) {
        const key = `${seg.start}|${seg.text}`;
        if (!seen.has(key)) seen.set(key, seg);
      }
      setSegments([...seen.values()].sort((a, b) => a.start - b.start));
      setRunning(false);
      setStage('replay');
    } catch {}
  };

  if (stage === 'home') {
    return (
      <HomePage
        onNewRun={handleNewRun}
        onOpenRun={handleOpenRun}
      />
    );
  }

  if (stage === 'upload') {
    return (
      <UploadStage
        onParsed={handleUploadParsed}
        onBack={() => setStage('home')}
      />
    );
  }

  if (stage === 'processing') {
    return (
      <ProcessingStage
        file={file!}
        filename={filename}
        preloadedSegments={segments.length > 0 ? segments : null}
        onComplete={handleProcessingComplete}
        onBack={() => setStage('upload')}
      />
    );
  }

  if (stage === 'configure') {
    return (
      <ConfigureStage
        segments={segments}
        filename={filename}
        onRun={handleRun}
        onBack={() => setStage('processing')}
      />
    );
  }

  return (
    <ResultsStage
      segments={segments}
      ticks={ticks}
      totalTicks={totalTicks}
      running={running}
      runLog={runLog}
      config={runConfig}
      onReset={handleReset}
      onRerun={handleRun}
    />
  );
}

function saveRunSummary(log: RunLog, ticks: TickLog[]) {
  try {
    const summary: RunSummary = {
      runId: log.runId,
      name: `${log.targetParticipant} - ${log.sourceFile.replace(/\.[^.]+$/, '')}`,
      sourceFile: log.sourceFile,
      sourceType: log.sourceType,
      status: 'ready',
      targetParticipant: log.targetParticipant,
      contextWindowSeconds: log.contextWindowSeconds,
      replayQuality: log.replayQuality,
      lastUpdated: new Date().toISOString(),
      tickCount: ticks.length,
      interventionCount: ticks.filter((t) => t.result.intervene).length,
    };

    // Update runs list
    const existingRuns: RunSummary[] = JSON.parse(localStorage.getItem('mcs-runs') || '[]');
    const updatedRuns = [summary, ...existingRuns.filter((r) => r.runId !== log.runId)];
    localStorage.setItem('mcs-runs', JSON.stringify(updatedRuns));

    // Save full run
    localStorage.setItem(`mcs-run-${log.runId}`, JSON.stringify(log));
  } catch {}
}
