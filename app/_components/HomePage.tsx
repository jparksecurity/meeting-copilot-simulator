'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { RunSummary } from '../../lib/types';
import { QUALITY_BADGE, STATUS_COLORS } from '../../lib/constants';
import { AppHeader } from './AppHeader';

const RUNS_KEY = 'mcs-runs';

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getRunsSnapshot(): string {
  try { return localStorage.getItem(RUNS_KEY) ?? '[]'; }
  catch { return '[]'; }
}

function getRunsServerSnapshot(): string {
  return '[]';
}

interface HomePageProps {
  onNewRun: () => void;
  onOpenRun: (runId: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HomePage({ onNewRun, onOpenRun }: HomePageProps) {
  const runsJson = useSyncExternalStore(subscribeToStorage, getRunsSnapshot, getRunsServerSnapshot);
  const runs: RunSummary[] = JSON.parse(runsJson);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const updateRuns = useCallback((updated: RunSummary[]) => {
    localStorage.setItem(RUNS_KEY, JSON.stringify(updated));
    // Trigger re-render via storage event for same-window
    window.dispatchEvent(new StorageEvent('storage', { key: RUNS_KEY }));
  }, []);

  const handleDelete = (runId: string) => {
    const updated = runs.filter((r) => r.runId !== runId);
    updateRuns(updated);
    try { localStorage.removeItem(`mcs-run-${runId}`); } catch {}
    setDeleteConfirm(null);
  };

  const hasRuns = runs.length > 0;

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      <AppHeader
        right={
          <button
            onClick={onNewRun}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            New Run
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-zinc-800">Your Runs</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Upload a transcript or audio file, replay the meeting, and inspect one-line interventions over time.
            </p>
          </div>

          {!hasRuns ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 bg-white border border-zinc-200 rounded-2xl">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-700 mb-1">No runs yet</h3>
              <p className="text-sm text-zinc-500 mb-6">Start with a transcript or audio file.</p>
              <div className="flex gap-3">
                <button
                  onClick={onNewRun}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Upload File
                </button>
              </div>
            </div>
          ) : (
            /* Runs table */
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Run</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Source</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Target</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Quality</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Updated</th>
                    <th className="text-right text-xs font-medium text-zinc-500 uppercase tracking-wide px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const qBadge = QUALITY_BADGE[run.replayQuality];
                    return (
                      <tr key={run.runId} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-zinc-800">{run.name}</div>
                          <div className="text-xs text-zinc-400 truncate max-w-[200px]">{run.sourceFile}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{run.sourceType}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[run.status] ?? ''}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{run.targetParticipant}</td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${qBadge.className}`}>
                            {qBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{timeAgo(run.lastUpdated)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onOpenRun(run.runId)}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              Open
                            </button>
                            {deleteConfirm === run.runId ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(run.runId)}
                                  className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-600 rounded transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(run.runId)}
                                className="px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
