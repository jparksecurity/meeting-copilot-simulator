'use client';

import { useState, useRef, useCallback } from 'react';
import { TranscriptSegment } from '../../lib/types';
import { tryFastParse, getSpeakers } from '../../lib/transcript';
import { isAudioFile, MAX_AUDIO_MB } from '../../lib/constants';
import { AppHeader } from './AppHeader';
import { Stepper } from './Stepper';

interface UploadStageProps {
  onParsed: (segments: TranscriptSegment[], filename: string, file: File) => void;
  onBack: () => void;
}

export function UploadStage({ onParsed, onBack }: UploadStageProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: string;
    type: 'transcript' | 'audio';
    detected: string;
    warnings: string[];
  } | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setSelectedFile(null);
    setFileInfo(null);
    setSegments(null);

    const audio = isAudioFile(file.name);
    if (!audio && !file.name.endsWith('.txt') && !file.name.endsWith('.json')) {
      setError('This file type is not supported. Please upload a .txt, .json, or audio file.');
      return;
    }

    if (audio && file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setError(`Audio file must be under ${MAX_AUDIO_MB}MB.`);
      return;
    }

    const sizeStr = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    if (audio) {
      const warnings: string[] = [];
      if (file.size > 10 * 1024 * 1024) {
        warnings.push('This audio may take longer to process.');
      }
      setSelectedFile(file);
      setFileInfo({
        name: file.name,
        size: sizeStr,
        type: 'audio',
        detected: 'Audio detected',
        warnings,
      });
      return;
    }

    // Try fast-path parse (exact JSON format only)
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = tryFastParse(content);

      if (parsed) {
        // Fast path: exact format
        const speakers = getSpeakers(parsed);
        const detected = file.name.endsWith('.json') ? 'JSON transcript detected' : 'Text transcript detected';
        const details = ['Timestamps detected', `${speakers.length} speaker${speakers.length !== 1 ? 's' : ''} detected`];

        setSelectedFile(file);
        setSegments(parsed);
        setFileInfo({
          name: file.name,
          size: sizeStr,
          type: 'transcript',
          detected: `${detected} — ${details.join(', ')}`,
          warnings: [],
        });
      } else {
        // Needs LLM normalization
        const detected = file.name.endsWith('.json') ? 'JSON transcript detected' : 'Text transcript detected';
        setSelectedFile(file);
        setSegments(null);
        setFileInfo({
          name: file.name,
          size: sizeStr,
          type: 'transcript',
          detected: `${detected} — AI normalization needed`,
          warnings: ['This format will be normalized by AI. Replay timing will be estimated.'],
        });
      }
    };
    reader.readAsText(file);
  }, []);

  const handleContinue = () => {
    if (!selectedFile) return;
    if (fileInfo?.type === 'audio') {
      // Pass file through, processing stage will handle transcription
      onParsed([], selectedFile.name, selectedFile);
    } else if (segments) {
      // Fast-path: already parsed
      onParsed(segments, selectedFile.name, selectedFile);
    } else {
      // Needs LLM normalization — pass empty segments, processing stage will call /api/normalize
      onParsed([], selectedFile.name, selectedFile);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      <AppHeader
        breadcrumb={['New Run', 'Upload']}
        right={
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Back to Runs
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Stepper */}
          <div className="mb-8">
            <Stepper current="upload" />
          </div>

          {/* Two-column layout */}
          <div className="flex gap-6">
            {/* Left column (70%) - Upload zone */}
            <div className="flex-[7]">
              {!fileInfo ? (
                <div
                  className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
                    dragging
                      ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                      : error
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-zinc-300 hover:border-zinc-400 bg-white'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-zinc-600 font-medium text-base mb-1">
                    Drag and drop transcript or audio
                  </p>
                  <p className="text-zinc-400 text-sm mb-4">or</p>
                  <span className="inline-block px-5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium rounded-lg transition-colors">
                    Choose File
                  </span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".txt,.json,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.mpeg"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                  />
                  <div className="mt-6 text-xs text-zinc-400 space-y-0.5">
                    <p>Transcript: .json, .txt</p>
                    <p>Audio: .mp3 .wav .m4a .mp4 .webm (max {MAX_AUDIO_MB}MB)</p>
                  </div>
                </div>
              ) : (
                /* File summary card */
                <div className="bg-white border border-zinc-200 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        fileInfo.type === 'audio' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        {fileInfo.type === 'audio' ? (
                          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-800 text-sm">{fileInfo.name}</p>
                        <p className="text-xs text-zinc-400">{fileInfo.size}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFileInfo(null);
                        setSegments(null);
                        setError(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      Change file
                    </button>
                  </div>

                  <div className="bg-zinc-50 rounded-xl p-4 text-sm text-zinc-600">
                    <p className="font-medium text-zinc-700">{fileInfo.detected}</p>
                    {fileInfo.type === 'audio' && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Will transcribe and attempt speaker labeling.
                      </p>
                    )}
                  </div>

                  {fileInfo.warnings.map((warn, i) => (
                    <div key={i} className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                      {warn}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="font-medium mb-0.5">Error</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right column (30%) - Helper sidebar */}
            <div className="flex-[3]">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-2">What happens next</h3>
                  <ol className="text-xs text-zinc-500 space-y-1.5 list-decimal list-inside">
                    <li>We parse or transcribe your file</li>
                    <li>You choose a participant and prompt</li>
                    <li>Replay the meeting with AI suggestions</li>
                  </ol>
                </div>

                <div className="border-t border-zinc-100 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-2">Tips</h3>
                  <ul className="text-xs text-zinc-500 space-y-1.5">
                    <li>Best results come from transcripts with timestamps and speaker labels.</li>
                    <li>Audio files will be transcribed first.</li>
                    <li>Files are not stored on any server.</li>
                  </ul>
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
              Back to Runs
            </button>
            <button
              onClick={handleContinue}
              disabled={!selectedFile}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
