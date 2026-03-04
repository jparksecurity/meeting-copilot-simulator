'use client';

import { RunConfig } from '../../../lib/types';
import { CONTEXT_PRESETS } from '../../../lib/constants';
import { DEFAULT_PROMPT } from '../../../lib/prompt';

interface SettingsDrawerProps {
  config: RunConfig;
  running: boolean;
  settingsContext: number | 'custom';
  settingsCustomContext: string;
  settingsPrompt: string;
  settingsWindowSeconds: number;
  onContextChange: (v: number | 'custom') => void;
  onCustomContextChange: (v: string) => void;
  onPromptChange: (v: string) => void;
  onRerun: (config: RunConfig) => void;
  onCancel: () => void;
}

export function SettingsDrawer({
  config,
  running,
  settingsContext,
  settingsCustomContext,
  settingsPrompt,
  settingsWindowSeconds,
  onContextChange,
  onCustomContextChange,
  onPromptChange,
  onRerun,
  onCancel,
}: SettingsDrawerProps) {
  const hasChanges = settingsWindowSeconds !== config.contextWindowSeconds || settingsPrompt !== config.prompt;
  const promptModified = settingsPrompt !== DEFAULT_PROMPT;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onCancel} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white border-l border-zinc-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-800 text-sm">Run Settings</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Target participant (read-only) */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">Target Participant</p>
            <p className="text-sm text-zinc-700 font-medium px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200">
              {config.targetParticipant}
            </p>
          </div>

          {/* Context window */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Context Window</p>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_PRESETS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => onContextChange(sec)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                    settingsContext === sec
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                </button>
              ))}
              <button
                onClick={() => onContextChange('custom')}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                  settingsContext === 'custom'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                Custom
              </button>
            </div>
            {settingsContext === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={settingsCustomContext}
                  onChange={(e) => onCustomContextChange(e.target.value)}
                  min={10}
                  max={600}
                  className="w-20 border border-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                  placeholder="sec"
                />
                <span className="text-xs text-zinc-400">seconds</span>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Prompt Template</p>
              <div className="flex items-center gap-2">
                {promptModified && (
                  <span className="text-[10px] text-amber-600">Modified</span>
                )}
                <button
                  onClick={() => onPromptChange(DEFAULT_PROMPT)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  Reset to default
                </button>
              </div>
            </div>
            <textarea
              value={settingsPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={10}
              className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-xs font-mono bg-zinc-50 resize-y focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 bg-zinc-50/50">
          {hasChanges && (
            <p className="text-xs text-amber-600 mb-3">
              Settings changed. Rerun to regenerate suggestions.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              disabled={running || !hasChanges}
              onClick={() =>
                onRerun({
                  targetParticipant: config.targetParticipant,
                  contextWindowSeconds: settingsWindowSeconds,
                  prompt: settingsPrompt,
                })
              }
              className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Rerun
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
