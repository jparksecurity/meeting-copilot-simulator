'use client';

import { useState } from 'react';
import { TickLog, RunConfig } from '../../../lib/types';
import { formatTime } from '../../../lib/transcript';
import { CardItem } from './CardItem';
import { CARD_COLORS } from '../../../lib/constants';

type InspectorTab = 'overview' | 'input' | 'output' | 'logs';

interface TickPanelProps {
  ticks: TickLog[];
  currentIdx: number;
  running: boolean;
  config: RunConfig;
  onSeek: (idx: number) => void;
}

export function TickPanel({
  ticks,
  currentIdx,
  running,
  config,
  onSeek,
}: TickPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');
  const currentTick = ticks[currentIdx] ?? null;
  const visibleCards = currentTick?.result.cards.filter((c) => c.type !== 'hold').slice(0, 3) ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {ticks.length === 0 && running && (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p>Generating checkpoint suggestions...</p>
          </div>
        </div>
      )}
      {ticks.length === 0 && !running && (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
          <div className="text-center">
            <p className="font-medium text-zinc-500 mb-1">Replay is ready</p>
            <p className="text-xs">Press play to start generating checkpoint suggestions.</p>
          </div>
        </div>
      )}

      {currentTick && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Section 1: Simulated Participant Surface */}
          <div className="px-5 py-4 border-b border-zinc-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                What the participant would see now
              </h3>
              </div>

            {currentTick.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-3">
                <p className="font-medium text-xs mb-0.5">Error at this checkpoint</p>
                <p className="text-xs">{currentTick.error}</p>
              </div>
            )}

            {currentTick.result.intervene && visibleCards.length > 0 ? (
              <div className="space-y-2.5">
                {visibleCards.map((card, ci) => (
                  <CardItem key={ci} card={card} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-zinc-400">No intervention at this moment.</p>
              </div>
            )}
          </div>

          {/* Section 2: Checkpoint Timeline */}
          <div className="px-5 py-3 border-b border-zinc-100 shrink-0 max-h-36 overflow-y-auto">
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Checkpoints</h3>
            <div className="space-y-0.5">
              {ticks.map((t, i) => {
                const cardCount = t.result.cards.filter((c) => c.type !== 'hold').length;
                const isHold = !t.result.intervene;
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={i}
                    onClick={() => onSeek(i)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-all ${
                      isCurrent
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="font-mono w-10 text-right shrink-0">{formatTime(t.tickTime)}</span>
                    <span className="text-zinc-300">-</span>
                    {isHold ? (
                      <span className="text-zinc-400">Hold</span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span>{cardCount} card{cardCount !== 1 ? 's' : ''}</span>
                        {t.result.cards.filter((c) => c.type !== 'hold').slice(0, 3).map((c, ci) => (
                          <span
                            key={ci}
                            className={`inline-block px-1 py-0 rounded text-[9px] font-bold uppercase ${
                              CARD_COLORS[c.type] ?? 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {c.type}
                          </span>
                        ))}
                      </span>
                    )}
                    {t.error && <span className="text-red-400 text-[10px]">!</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Inspector Tabs */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex border-b border-zinc-100 shrink-0">
              {(['overview', 'input', 'output', 'logs'] as InspectorTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/30'
                      : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      currentTick.result.intervene ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {currentTick.result.intervene ? 'Intervene' : 'Hold'}
                    </span>
                    {currentTick.result.intervene && (
                      <span className="text-xs text-zinc-400">
                        {visibleCards.length} card{visibleCards.length !== 1 ? 's' : ''} ·{' '}
                        {visibleCards.map((c) => c.type).join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Reasoning</p>
                    <p className="text-sm text-zinc-700 leading-relaxed">
                      {currentTick.result.why || 'No reasoning provided.'}
                    </p>
                  </div>

                  {currentTick.transcriptSlice.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Evidence</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Last utterance: &ldquo;{currentTick.transcriptSlice[currentTick.transcriptSlice.length - 1]?.text.slice(0, 120)}...&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'input' && (
                <div className="space-y-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Target participant</span>
                      <span className="text-zinc-700 font-medium">{config.targetParticipant}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Timestamp</span>
                      <span className="text-zinc-700 font-medium">{formatTime(currentTick.tickTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Context window</span>
                      <span className="text-zinc-700 font-medium">{currentTick.contextWindowSeconds}s</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Transcript slice sent</p>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[10px] font-mono text-zinc-600 space-y-1 max-h-40 overflow-y-auto">
                      {currentTick.transcriptSlice.map((seg, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-zinc-400 shrink-0">[{formatTime(seg.start)}]</span>
                          <span className="font-semibold text-zinc-700 shrink-0">{seg.speaker}:</span>
                          <span>{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Filled prompt</p>
                    <pre className="bg-zinc-900 text-blue-300 p-3 rounded-xl text-[10px] overflow-x-auto whitespace-pre-wrap max-h-48 font-mono leading-relaxed">
                      {currentTick.filledPrompt}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'output' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Parsed JSON</p>
                    <pre className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl text-[10px] font-mono text-zinc-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {JSON.stringify(currentTick.result, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Raw model response</p>
                    <pre className="bg-zinc-900 text-green-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                      {currentTick.rawResponse || '(none)'}
                    </pre>
                  </div>

                  {currentTick.recentCards.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Recent cards fed to prompt</p>
                      <div className="space-y-1 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        {currentTick.recentCards.map((c, i) => (
                          <div key={i} className="text-[10px] text-zinc-600 font-mono flex gap-2">
                            <span className="font-bold text-zinc-400">[{c.type}]</span>
                            <span>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Checkpoint time</span>
                    <span className="text-zinc-700 font-mono">{formatTime(currentTick.tickTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Context window</span>
                    <span className="text-zinc-700 font-mono">{currentTick.contextWindowSeconds}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Transcript segments in slice</span>
                    <span className="text-zinc-700 font-mono">{currentTick.transcriptSlice.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Recent cards context</span>
                    <span className="text-zinc-700 font-mono">{currentTick.recentCards.length}</span>
                  </div>
                  {currentTick.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                      <p className="font-medium text-xs mb-0.5">Error</p>
                      <p className="text-xs">{currentTick.error}</p>
                    </div>
                  )}
                  {currentTick.uiEvents.length > 0 && (
                    <div>
                      <p className="text-zinc-500 mb-1">UI events</p>
                      <div className="space-y-0.5">
                        {currentTick.uiEvents.map((ev, i) => (
                          <p key={i} className="text-zinc-600 font-mono text-[10px]">{ev}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
