'use client';

import { useState, useRef, useEffect } from 'react';
import { TranscriptSegment, TickLog, RunLog, RunConfig } from '../../lib/types';
import { getReplayQuality, getMaxEnd } from '../../lib/transcript';
import { CONTEXT_PRESETS, PLAY_SPEED_MS, ticksToCSV, downloadFile } from '../../lib/constants';
import { ResultsHeader } from './results/ResultsHeader';
import { SettingsDrawer } from './results/SettingsDrawer';
import { TranscriptPanel } from './results/TranscriptPanel';
import { TickPanel } from './results/TickPanel';
import { TimelineBar } from './results/TimelineBar';

interface ResultsStageProps {
  segments: TranscriptSegment[];
  ticks: TickLog[];
  totalTicks: number;
  running: boolean;
  runLog: RunLog | null;
  config: RunConfig;
  onReset: () => void;
  onRerun: (config: RunConfig) => void;
}

export function ResultsStage({
  segments,
  ticks,
  totalTicks,
  running,
  runLog,
  config,
  onReset,
  onRerun,
}: ResultsStageProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsContext, setSettingsContext] = useState<number | 'custom'>(
    (CONTEXT_PRESETS as number[]).includes(config.contextWindowSeconds)
      ? config.contextWindowSeconds
      : 'custom'
  );
  const [settingsCustomContext, setSettingsCustomContext] = useState(String(config.contextWindowSeconds));
  const [settingsPrompt, setSettingsPrompt] = useState(config.prompt);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const settingsWindowSeconds =
    settingsContext === 'custom'
      ? Math.max(10, parseInt(settingsCustomContext, 10) || config.contextWindowSeconds)
      : settingsContext;

  const currentTick = ticks[currentIdx] ?? null;
  const totalDuration = getMaxEnd(segments);
  const quality = getReplayQuality(segments);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentIdx((i) => {
        if (i >= ticks.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAY_SPEED_MS / playbackSpeed);
    return () => clearInterval(interval);
  }, [playing, ticks.length, playbackSpeed]);

  useEffect(() => {
    if (!transcriptRef.current || !currentTick) return;
    const highlighted = transcriptRef.current.querySelector('[data-highlighted="true"]');
    highlighted?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIdx, currentTick]);

  const handleExportJSON = () => {
    if (!runLog) return;
    downloadFile(JSON.stringify({ ...runLog, ticks }, null, 2), `run-${runLog.runId}.json`, 'application/json');
  };

  const handleExportCSV = () => {
    if (!runLog) return;
    downloadFile(ticksToCSV(ticks), `run-${runLog.runId}.csv`, 'text/csv');
  };

  const handleCancelSettings = () => {
    setShowSettings(false);
    const isPreset = (CONTEXT_PRESETS as number[]).includes(config.contextWindowSeconds);
    setSettingsContext(isPreset ? config.contextWindowSeconds : 'custom');
    setSettingsCustomContext(String(config.contextWindowSeconds));
    setSettingsPrompt(config.prompt);
  };

  const handleRerun = (newConfig: RunConfig) => {
    setShowSettings(false);
    setCurrentIdx(0);
    setPlaying(false);
    onRerun(newConfig);
  };

  const handleSeek = (idx: number) => {
    setCurrentIdx(idx);
    setPlaying(false);
  };

  // Summary stats for end of replay
  const isComplete = !running && ticks.length > 0 && currentIdx >= ticks.length - 1;
  const holdCount = ticks.filter((t) => !t.result.intervene).length;
  const interventionCount = ticks.filter((t) => t.result.intervene).length;

  return (
    <div className="flex flex-col h-screen bg-zinc-50 overflow-hidden">
      <ResultsHeader
        config={config}
        ticks={ticks}
        totalTicks={totalTicks}
        running={running}
        runLog={runLog}
        showSettings={showSettings}
        quality={quality}
        onToggleSettings={() => setShowSettings((v) => !v)}
        onReset={onReset}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
      />

      {/* Progress bar (during generation) */}
      {running && (
        <div className="h-0.5 bg-zinc-100 shrink-0">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${totalTicks > 0 ? (ticks.length / totalTicks) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Main layout - 2 columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Transcript pane (58-62%) */}
        <div className="w-[60%] border-r border-zinc-200 overflow-hidden">
          <TranscriptPanel
            segments={segments}
            currentTick={currentTick}
            targetParticipant={config.targetParticipant}
            transcriptRef={transcriptRef}
          />
        </div>

        {/* Right: Simulated surface + checkpoint timeline + inspector (38-42%) */}
        <div className="w-[40%] overflow-hidden">
          <TickPanel
            ticks={ticks}
            currentIdx={currentIdx}
            running={running}
            config={config}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* End of replay summary overlay */}
      {isComplete && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white border border-zinc-200 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-6 z-10">
          <div className="text-xs text-zinc-500 space-y-1">
            <p><span className="font-semibold text-zinc-700">{ticks.length}</span> checkpoints</p>
            <p><span className="font-semibold text-zinc-700">{holdCount}</span> holds</p>
            <p><span className="font-semibold text-zinc-700">{interventionCount}</span> interventions</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setCurrentIdx(0); setPlaying(false); }}
              className="px-3 py-1.5 text-xs border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600"
            >
              Replay Again
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 text-xs border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600"
            >
              Export
            </button>
          </div>
        </div>
      )}

      <TimelineBar
        ticks={ticks}
        currentIdx={currentIdx}
        totalDuration={totalDuration}
        playing={playing}
        running={running}
        playbackSpeed={playbackSpeed}
        onSeek={handleSeek}
        onPlay={() => setPlaying((p) => !p)}
        onPrev={() => { setCurrentIdx((i) => Math.max(0, i - 1)); setPlaying(false); }}
        onNext={() => { setCurrentIdx((i) => Math.min(ticks.length - 1, i + 1)); setPlaying(false); }}
        onSpeedChange={setPlaybackSpeed}
      />

      {/* Settings Drawer */}
      {showSettings && (
        <SettingsDrawer
          config={config}
          running={running}
          settingsContext={settingsContext}
          settingsCustomContext={settingsCustomContext}
          settingsPrompt={settingsPrompt}
          settingsWindowSeconds={settingsWindowSeconds}
          onContextChange={setSettingsContext}
          onCustomContextChange={setSettingsCustomContext}
          onPromptChange={setSettingsPrompt}
          onRerun={handleRerun}
          onCancel={handleCancelSettings}
        />
      )}
    </div>
  );
}
