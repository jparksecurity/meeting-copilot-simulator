'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_PROMPT } from '../../../lib/prompt';
import { CONTEXT_PRESETS } from '../../../lib/constants';
import { BenchmarkConfig } from '../../../lib/benchmark/types';

interface Props {
  onRun: (config: BenchmarkConfig) => void;
}

interface MeetingEntry {
  id: string;
  name: string;
}

export function BenchmarkConfigPanel({ onRun }: Props) {
  const [meetings, setMeetings] = useState<MeetingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [selectedContexts, setSelectedContexts] = useState<Set<number>>(new Set([60]));
  const [promptLabel, setPromptLabel] = useState('default_v1');
  const [promptText, setPromptText] = useState(DEFAULT_PROMPT);
  const [targetStrategy, setTargetStrategy] = useState<'most-active' | 'manual'>('most-active');
  const [manualTarget, setManualTarget] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    fetch('/api/benchmark/meetings')
      .then((r) => r.json())
      .then((data) => {
        setMeetings(data.meetings);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  function toggleMeeting(id: string) {
    setSelectedMeetings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleContext(val: number) {
    setSelectedContexts((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  }

  function selectAll() {
    setSelectedMeetings(new Set(meetings.map((m) => m.id)));
  }

  function selectNone() {
    setSelectedMeetings(new Set());
  }

  const canRun = selectedMeetings.size > 0 && selectedContexts.size > 0 && promptLabel.trim();

  function handleRun() {
    onRun({
      meetingIds: Array.from(selectedMeetings),
      contextWindows: Array.from(selectedContexts).sort((a, b) => a - b),
      promptLabel,
      promptText,
      targetStrategy,
      manualTarget: targetStrategy === 'manual' ? manualTarget : undefined,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading meetings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Meetings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-zinc-800">Meetings</h3>
          <div className="flex gap-2 text-xs">
            <button onClick={selectAll} className="text-blue-600 hover:underline">
              Select all
            </button>
            <button onClick={selectNone} className="text-zinc-500 hover:underline">
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-2">
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleMeeting(m.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
                selectedMeetings.has(m.id)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {selectedMeetings.size} meeting{selectedMeetings.size !== 1 ? 's' : ''} selected
        </p>
      </section>

      {/* Context windows */}
      <section>
        <h3 className="font-semibold text-zinc-800 mb-3">Context Windows</h3>
        <div className="flex gap-3">
          {CONTEXT_PRESETS.map((val) => (
            <button
              key={val}
              onClick={() => toggleContext(val)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                selectedContexts.has(val)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
            >
              {val}s
            </button>
          ))}
        </div>
      </section>

      {/* Prompt */}
      <section>
        <h3 className="font-semibold text-zinc-800 mb-3">Prompt</h3>
        <div className="flex gap-3 items-center mb-2">
          <label className="text-sm text-zinc-600">Label:</label>
          <input
            type="text"
            value={promptLabel}
            onChange={(e) => setPromptLabel(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm flex-1 max-w-xs"
            placeholder="e.g., default_v1"
          />
        </div>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="text-sm text-blue-600 hover:underline mb-2"
        >
          {showPrompt ? 'Hide prompt' : 'Edit prompt'}
        </button>
        {showPrompt && (
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="w-full h-64 border border-zinc-200 rounded-lg p-3 text-xs font-mono resize-y"
          />
        )}
      </section>

      {/* Target participant */}
      <section>
        <h3 className="font-semibold text-zinc-800 mb-3">Target Participant</h3>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={targetStrategy === 'most-active'}
              onChange={() => setTargetStrategy('most-active')}
            />
            Most active speaker (auto)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={targetStrategy === 'manual'}
              onChange={() => setTargetStrategy('manual')}
            />
            Manual
          </label>
          {targetStrategy === 'manual' && (
            <input
              type="text"
              value={manualTarget}
              onChange={(e) => setManualTarget(e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm"
              placeholder="Speaker name"
            />
          )}
        </div>
      </section>

      {/* Summary & Run */}
      <section className="pt-4 border-t border-zinc-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {selectedMeetings.size} meeting{selectedMeetings.size !== 1 ? 's' : ''}{' '}
            x {selectedContexts.size} context window{selectedContexts.size !== 1 ? 's' : ''}{' '}
            = {selectedMeetings.size * selectedContexts.size} run{selectedMeetings.size * selectedContexts.size !== 1 ? 's' : ''}
          </p>
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Run Benchmark
          </button>
        </div>
      </section>
    </div>
  );
}
