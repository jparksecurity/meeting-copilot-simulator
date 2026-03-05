'use client';

import { useState, useEffect, useCallback } from 'react';
import { TranscriptSegment } from '../../lib/types';
import { getReplayQuality, getMaxEnd, getSpeakers, formatTime } from '../../lib/transcript';
import { isAudioFile } from '../../lib/constants';
import { AppHeader } from './AppHeader';
import { Stepper } from './Stepper';

type StepStatus = 'waiting' | 'running' | 'complete' | 'warning' | 'failed';

interface ProcessingStep {
  label: string;
  status: StepStatus;
  detail?: string;
}

interface ProcessingStageProps {
  file: File;
  filename: string;
  /** If segments were already parsed (transcript), pass them here. */
  preloadedSegments: TranscriptSegment[] | null;
  onComplete: (segments: TranscriptSegment[]) => void;
  onBack: () => void;
}

export function ProcessingStage({ file, filename, preloadedSegments, onComplete, onBack }: ProcessingStageProps) {
  const isAudio = isAudioFile(filename);
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(preloadedSegments);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const needsNormalize = !isAudio && (!preloadedSegments || preloadedSegments.length === 0);

  const [steps, setSteps] = useState<ProcessingStep[]>(() => {
    if (isAudio) {
      return [
        { label: 'Upload complete', status: 'complete' },
        { label: 'Transcribing audio', status: 'waiting' },
        { label: 'Speaker labeling', status: 'waiting' },
        { label: 'Normalizing transcript', status: 'waiting' },
        { label: 'Building replay checkpoints', status: 'waiting' },
      ];
    }
    if (needsNormalize) {
      return [
        { label: 'Upload complete', status: 'complete' },
        { label: 'Normalizing transcript', status: 'waiting' },
        { label: 'Detecting speakers', status: 'waiting' },
        { label: 'Building replay checkpoints', status: 'waiting' },
      ];
    }
    return [
      { label: 'Upload complete', status: 'complete' },
      { label: 'Parsing transcript', status: 'waiting' },
      { label: 'Detecting speakers', status: 'waiting' },
      { label: 'Building replay checkpoints', status: 'waiting' },
    ];
  });

  const updateStep = useCallback((idx: number, update: Partial<ProcessingStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...update } : s)));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function process() {
      if (isAudio) {
        // Step 1: Transcribe
        updateStep(1, { status: 'running' });
        try {
          const form = new FormData();
          form.append('audio', file);
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Transcription failed (${res.status})`);
          }
          const result: TranscriptSegment[] = await res.json();
          if (cancelled) return;
          if (result.length === 0) throw new Error('No speech detected.');
          updateStep(1, { status: 'complete', detail: `${formatTime(Math.ceil(getMaxEnd(result)))} duration` });

          // Step 2: Speaker labeling
          updateStep(2, { status: 'running' });
          const audioSpeakers = getSpeakers(result);
          const hasUnknown = audioSpeakers.includes('Unknown') || audioSpeakers.length <= 1;
          if (hasUnknown) {
            updateStep(2, { status: 'warning', detail: `${audioSpeakers.length} speaker${audioSpeakers.length !== 1 ? 's' : ''} found — confidence may be low` });
          } else {
            updateStep(2, { status: 'complete', detail: `${audioSpeakers.length} speakers detected` });
          }

          // Step 3: Normalize
          updateStep(3, { status: 'running' });
          await new Promise((r) => setTimeout(r, 300)); // brief pause for UI
          if (cancelled) return;
          updateStep(3, { status: 'complete', detail: `${result.length} segments` });

          // Step 4: Checkpoints
          updateStep(4, { status: 'running' });
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled) return;
          const lastEnd = getMaxEnd(result);
          const checkpointCount = Math.ceil(lastEnd / 30);
          updateStep(4, { status: 'complete', detail: `${checkpointCount} checkpoints` });

          setSegments(result);
          setDone(true);
        } catch (err) {
          if (cancelled) return;
          updateStep(1, { status: 'failed', detail: err instanceof Error ? err.message : 'Transcription failed' });
          setError(err instanceof Error ? err.message : 'Transcription failed');
        }
      } else if (needsNormalize) {
        // LLM normalization path — transcript format not recognized by fast parser
        updateStep(1, { status: 'running' });
        try {
          const reader = new FileReader();
          const content = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          if (cancelled) return;

          const res = await fetch('/api/normalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Normalization failed (${res.status})`);
          }
          const normalized: TranscriptSegment[] = await res.json();
          if (cancelled) return;
          if (normalized.length === 0) throw new Error('No segments extracted.');
          updateStep(1, { status: 'complete', detail: `${normalized.length} segments extracted` });

          // Step 2: Speakers
          updateStep(2, { status: 'running' });
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled) return;
          const normSpeakers = getSpeakers(normalized);
          const hasUnknown = normSpeakers.includes('Unknown') || normSpeakers.length <= 1;
          if (hasUnknown) {
            updateStep(2, { status: 'warning', detail: `${normSpeakers.length} speaker${normSpeakers.length !== 1 ? 's' : ''} found — confidence may be low` });
          } else {
            updateStep(2, { status: 'complete', detail: `${normSpeakers.length} speakers detected` });
          }

          // Step 3: Checkpoints
          updateStep(3, { status: 'running' });
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled) return;
          const lastEnd = getMaxEnd(normalized);
          const checkpointCount = Math.ceil(lastEnd / 30);
          updateStep(3, { status: 'complete', detail: `${checkpointCount} checkpoints` });

          setSegments(normalized);
          setDone(true);
        } catch (err) {
          if (cancelled) return;
          updateStep(1, { status: 'failed', detail: err instanceof Error ? err.message : 'Normalization failed' });
          setError(err instanceof Error ? err.message : 'Normalization failed');
        }
      } else {
        // Fast-path transcript — segments already parsed
        if (preloadedSegments && preloadedSegments.length > 0) {
          // Step 1: Parse
          updateStep(1, { status: 'running' });
          await new Promise((r) => setTimeout(r, 300));
          if (cancelled) return;
          updateStep(1, { status: 'complete', detail: `${preloadedSegments.length} segments found` });

          // Step 2: Speakers
          updateStep(2, { status: 'running' });
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled) return;
          const preSpeakers = getSpeakers(preloadedSegments);
          updateStep(2, { status: 'complete', detail: `${preSpeakers.length} speaker${preSpeakers.length !== 1 ? 's' : ''} found` });

          // Step 3: Checkpoints
          updateStep(3, { status: 'running' });
          await new Promise((r) => setTimeout(r, 200));
          if (cancelled) return;
          const quality = getReplayQuality(preloadedSegments);
          const qualityLabel = quality === 'exact' ? 'Exact replay ready' : 'Estimated replay ready';
          updateStep(3, { status: 'complete', detail: qualityLabel });

          setDone(true);
        }
      }
    }

    process();
    return () => { cancelled = true; };
  }, [file, isAudio, needsNormalize, preloadedSegments, updateStep]);

  const stats = segments
    ? {
        duration: formatTime(Math.ceil(getMaxEnd(segments))),
        segmentCount: segments.length,
        speakers: getSpeakers(segments),
        quality: getReplayQuality(segments),
      }
    : null;

  const stepIcons: Record<StepStatus, React.ReactNode> = {
    waiting: <div className="w-5 h-5 rounded-full border-2 border-zinc-200" />,
    running: (
      <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
    ),
    complete: (
      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
      </div>
    ),
    failed: (
      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      <AppHeader breadcrumb={['New Run', 'Processing']} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <Stepper current="processing" />
          </div>

          <div className="flex gap-6">
            {/* Left: Progress steps */}
            <div className="flex-[6]">
              <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-zinc-800 mb-6">
                  {error ? 'Processing failed' : done ? 'Processing complete' : 'Processing your file...'}
                </h2>

                <div className="space-y-4">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{stepIcons[step.status]}</div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          step.status === 'failed' ? 'text-red-700' :
                          step.status === 'warning' ? 'text-amber-700' :
                          step.status === 'complete' ? 'text-zinc-800' :
                          step.status === 'running' ? 'text-blue-700' :
                          'text-zinc-400'
                        }`}>
                          {step.label}
                        </p>
                        {step.detail && (
                          <p className={`text-xs mt-0.5 ${
                            step.status === 'failed' ? 'text-red-500' :
                            step.status === 'warning' ? 'text-amber-500' :
                            'text-zinc-400'
                          }`}>
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Summary */}
            <div className="flex-[4]">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">File</span>
                    <span className="text-zinc-700 font-medium truncate max-w-[150px]">{filename}</span>
                  </div>
                  {stats && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Duration</span>
                        <span className="text-zinc-700 font-medium">{stats.duration}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Segments</span>
                        <span className="text-zinc-700 font-medium">{stats.segmentCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Speakers</span>
                        <span className="text-zinc-700 font-medium">{stats.speakers.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Replay mode</span>
                        <span className="text-zinc-700 font-medium capitalize">{stats.quality}</span>
                      </div>
                    </>
                  )}
                  {!stats && !error && (
                    <p className="text-xs text-zinc-400">Processing...</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-200">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
            >
              {error ? 'Back to Upload' : 'Back'}
            </button>
            <div className="flex gap-3">
              {error && (
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Retry
                </button>
              )}
              {done && segments && (
                <button
                  onClick={() => onComplete(segments)}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Continue to Configure
                </button>
              )}
              {steps.some((s) => s.status === 'warning') && done && segments && (
                <span className="text-xs text-amber-600 self-center">Continuing with warnings</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
