'use client';

import { useState, useMemo } from 'react';
import { TranscriptSegment, RunConfig } from '../../lib/types';
import { getReplayQuality, getMaxEnd, getSpeakers, formatTime } from '../../lib/transcript';
import { DEFAULT_PROMPT } from '../../lib/prompt';
import { CONTEXT_PRESETS, QUALITY_BADGE } from '../../lib/constants';
import { AppHeader } from './AppHeader';
import { Stepper } from './Stepper';

interface ConfigureStageProps {
  segments: TranscriptSegment[];
  filename: string;
  onRun: (config: RunConfig) => void;
  onBack: () => void;
}

export function ConfigureStage({ segments, filename, onRun, onBack }: ConfigureStageProps) {
  const speakers = getSpeakers(segments);
  const singleSpeaker = speakers.length === 1;
  const hasUnknown = speakers.includes('Unknown');

  const [target, setTarget] = useState(speakers[0] ?? '');
  const [contextPreset, setContextPreset] = useState<number | 'custom'>(60);
  const [customContext, setCustomContext] = useState('90');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const quality = getReplayQuality(segments);
  const qBadge = QUALITY_BADGE[quality];
  const durationSec = Math.ceil(getMaxEnd(segments));
  const contextWindowSeconds =
    contextPreset === 'custom' ? Math.max(10, parseInt(customContext, 10) || 60) : contextPreset;

  const speakerStats = useMemo(() =>
    speakers.map((s) => {
      const speakerSegs = segments.filter((seg) => seg.speaker === s);
      const totalTime = speakerSegs.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      return {
        name: s,
        turns: speakerSegs.length,
        pct: durationSec > 0 ? Math.round((totalTime / durationSec) * 100) : 0,
      };
    }).sort((a, b) => b.pct - a.pct),
  [segments, speakers, durationSec]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      <AppHeader breadcrumb={['New Run', 'Configure']} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-8">
            <Stepper current="configure" />
          </div>

          {/* Warnings */}
          {qBadge.warn && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
              {qBadge.warn}
            </div>
          )}
          {hasUnknown && !qBadge.warn && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
              Speaker labels not detected. Suggestions may be less personalized.
            </div>
          )}
          {singleSpeaker && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
              Only one speaker was detected. Personalized intervention may be less meaningful.
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex gap-6">
            {/* Left column (~40%) */}
            <div className="flex-[4] min-w-0 space-y-4">
              {/* Meeting summary card */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">Meeting Summary</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">File</span>
                    <span className="text-zinc-700 font-medium truncate max-w-[200px]">{filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Duration</span>
                    <span className="text-zinc-700 font-medium">{formatTime(durationSec)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Segments</span>
                    <span className="text-zinc-700 font-medium">{segments.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Speakers</span>
                    <span className="text-zinc-700 font-medium">{speakers.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Replay quality</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${qBadge.className}`}>
                      {qBadge.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Speaker selection */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                  Choose the target participant
                  {singleSpeaker && <span className="ml-2 text-xs text-zinc-400 font-normal">(auto-selected)</span>}
                </h3>
                <div className="space-y-2">
                  {speakerStats.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setTarget(s.name)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        target === s.name
                          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          target === s.name ? 'bg-blue-500' : 'bg-zinc-300'
                        }`} />
                        <span className={`text-sm font-medium ${
                          target === s.name ? 'text-blue-700' : 'text-zinc-700'
                        }`}>
                          {s.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{s.pct}% speaking</span>
                        <span>{s.turns} turns</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transcript preview */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">Transcript Preview</h3>
                <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
                  {segments.slice(0, 20).map((seg, i) => (
                    <div key={i} className="flex gap-2 text-zinc-600">
                      <span className="text-zinc-400 shrink-0">[{formatTime(seg.start)}]</span>
                      <span className="font-semibold text-zinc-700 shrink-0">{seg.speaker}:</span>
                      <span className="truncate">{seg.text}</span>
                    </div>
                  ))}
                  {segments.length > 20 && (
                    <p className="text-zinc-400 pt-1">... and {segments.length - 20} more segments</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column (~60%) */}
            <div className="flex-[6] min-w-0 space-y-4">
              {/* Context window */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">Context Window</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  How much transcript the model sees at each checkpoint.
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONTEXT_PRESETS.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setContextPreset(sec)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        contextPreset === sec
                          ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                    </button>
                  ))}
                  <button
                    onClick={() => setContextPreset('custom')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      contextPreset === 'custom'
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {contextPreset === 'custom' && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      value={customContext}
                      onChange={(e) => setCustomContext(e.target.value)}
                      min={10}
                      max={600}
                      className="w-24 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                    />
                    <span className="text-sm text-zinc-500">seconds</span>
                  </div>
                )}
              </div>

              {/* Prompt editor */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-700">Prompt Template</h3>
                  <div className="flex gap-2">
                    {prompt !== DEFAULT_PROMPT && (
                      <span className="text-xs text-amber-600 self-center mr-2">Modified</span>
                    )}
                    <button
                      onClick={() => setPrompt(DEFAULT_PROMPT)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mb-3">
                  This prompt controls when the model holds, how it writes cards, and how it handles tact.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={12}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-xs font-mono bg-zinc-50 resize-y focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                />
                <p className="text-xs text-zinc-400 mt-2">
                  Variables: {'{{target_participant}}'} {'{{tick_time}}'} {'{{context_window}}'} {'{{recent_cards}}'}{' '}
                  {'{{transcript_window}}'}
                </p>
              </div>

              {/* Advanced settings */}
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <span>Advanced Settings</span>
                  <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAdvanced && (
                  <div className="px-5 pb-5 space-y-3 text-sm border-t border-zinc-100 pt-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Cadence</span>
                      <span className="text-zinc-700">30s (fixed)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Card limit</span>
                      <span className="text-zinc-700">3 per checkpoint</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Replay mode</span>
                      <span className="text-zinc-700 capitalize">{quality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Model</span>
                      <span className="text-zinc-700 font-mono text-xs">gpt-oss-120b</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-200">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => onRun({ targetParticipant: target, contextWindowSeconds, prompt })}
              disabled={!target}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Start Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
