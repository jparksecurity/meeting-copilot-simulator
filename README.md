# Meeting Copilot Simulator

A web app for testing a private meeting copilot. Upload a transcript or audio file, the system reconstructs the meeting timeline, then replays it in fixed 30-second steps. At each step, a hosted model decides whether the target participant should receive no intervention or up to three one-line suggestions.

## Stack

- Next.js 16 + React 19 + TypeScript
- Groq SDK (`openai/gpt-oss-120b`) — generator model
- OpenAI SDK (`gpt-5.2`) — benchmark judge + audio transcription
- Tailwind CSS v4

## Quick Start

```bash
npm install
npm run dev
```

Set environment variables:

```
GROQ_API_KEY=...
OPENAI_API_KEY=...   # needed for benchmark judge + audio uploads
```

Open [http://localhost:3000](http://localhost:3000).

## Supported Upload Formats

### Transcript Files

| Format | File | Parser Path | Provenance |
|--------|------|-------------|------------|
| Full timestamps + speakers | `.json` — `[{start, end, speaker, text}]` | Exact JSON | `exact` |
| Timestamps, no speakers | `.json` — `[{start, end, text}]` | Exact JSON, speaker = "Unknown" | `exact` |
| Speakers, no timestamps | `.json` — `[{speaker, text}]` | Estimated timing (~0.33s/word) | `estimated` |
| QMSum format | `.json` — `{meeting_transcripts: [{speaker, content}]}` | QMSum parser | `estimated` |
| Azure Speech-to-Text | `.json` — `{segments: [{speaker, offset, duration, nbest: [{text}]}]}` | Azure STT parser (100ns ticks → seconds) | `exact` |
| Speaker-labeled lines | `.txt` — `Speaker Name: text` per line | Speaker-line regex | `estimated` |
| Plain text | `.txt` — sentences only | Sentence split, speaker = "Unknown" | `approximate` |

### Audio Files (max 25 MB)

`.mp3`, `.mp4`, `.m4a`, `.wav`, `.webm`, `.ogg`, `.mpeg`

Transcribed via OpenAI `gpt-4o-transcribe` with diarization → provenance `generated`.

## Test Data

### Quick Start — Two Files

Start with one transcript + one audio file from matching meeting IDs:

1. **QMSum `ES2002a.json`** — transcript-only testing (QMSum format, `estimated` provenance)
2. **AMI `ES2002a.Mix-Headset.wav`** — audio upload + transcription testing (`generated` provenance)

Download links:

- QMSum raw JSON: <https://raw.githubusercontent.com/Yale-LILY/QMSum/main/data/Product/all/ES2002a.json>
- AMI mixed WAV: <https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/ES2002a/audio/ES2002a.Mix-Headset.wav>

### QMSum — Transcript Testing

[QMSum](https://github.com/Yale-LILY/QMSum) is a query-based summarization dataset built on AMI + ICSI meetings. Each meeting is a single JSON file in [`data/Product/all/`](https://github.com/Yale-LILY/QMSum/tree/main/data/Product/all).

The JSON contains three top-level keys: `meeting_transcripts`, `general_query_list`, `specific_query_list`. You only need **`meeting_transcripts`** — each entry has `speaker` + `content` fields that map directly to our QMSum parser.

Ignore the `train/val/test` splits — use `all/` for prototyping since it contains every meeting in one folder.

Useful links:

- [Product folder](https://github.com/Yale-LILY/QMSum/tree/main/data/Product/all) — all Product-domain meetings
- [ES2002a meeting page](https://github.com/Yale-LILY/QMSum/blob/main/data/Product/all/ES2002a.json) — example meeting
- [Raw JSON](https://raw.githubusercontent.com/Yale-LILY/QMSum/main/data/Product/all/ES2002a.json) — direct download

### AMI — Audio + Transcript Testing

The [AMI Corpus](https://groups.inf.ed.ac.uk/ami/corpus/) official site is confusing — many meeting IDs, multiple audio/video streams, and several annotation formats. For prototyping, you only need one audio file.

**Step-by-step to download audio:**

1. Go to the [AMI download page](https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/)
2. Navigate to `ES2002a/` → `audio/`
3. Download **`ES2002a.Mix-Headset.wav`** (the single mixed-down WAV, ~30 MB)
4. Upload it in the app — OpenAI diarization will produce `generated` provenance segments

Or direct link: <https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/ES2002a/audio/ES2002a.Mix-Headset.wav>

**Transcripts:** The official AMI transcript format is NXT XML (hard to parse). Use the [HuggingFace mirror](https://huggingface.co/datasets/edinburghcstr/ami/viewer/ihm) instead, which provides clean fields: `meeting_id`, `text`, `begin_time`, `end_time`, `speaker_id`. Rename to `{start, end, speaker, text}` for `exact` provenance.

Useful links:

- [AMI download page](https://groups.inf.ed.ac.uk/ami/AMICorpusMirror/amicorpus/) — all meeting audio/video
- [AMI transcription page](https://groups.inf.ed.ac.uk/ami/corpus/amimanual.html) — annotation format docs
- [HuggingFace viewer](https://huggingface.co/datasets/edinburghcstr/ami/viewer/ihm) — clean transcript data

### What to Ignore

- **AMI:** videos, non-scenario meetings, automatic (ASR) annotations — only use manual/headset-mix
- **QMSum:** `train/val/test` splits, `general_query_list` / `specific_query_list` fields
- **For prototyping:** one transcript JSON + one audio WAV + speaker/content segments is enough

### Recommended Public Corpora

For systematic testing, use meeting-specific corpora in two lanes: **transcript-first** for fast UI iteration, **audio + transcript** for end-to-end simulation.

| Priority | Corpus | Type | Size | Best For | License |
|----------|--------|------|------|----------|---------|
| 1 | [QMSum](https://github.com/Yale-LILY/QMSum) | Transcript | 232 meetings | Fast prompt iteration — `{speaker, content}` maps directly to QMSum parser | Research |
| 2 | [AMI](https://groups.inf.ed.ac.uk/ami/corpus/) | Audio + Transcript | ~100 hours | End-to-end simulation, multi-speaker design-team meetings | CC BY 4.0 |
| 3 | [MeetingBank](https://meetingbank.github.io/) | Audio + Transcript | 3,579+ hours | Stress-testing long meetings, word-level timing | CC BY-NC-ND 4.0 |
| 4 | [ICSI](https://groups.inf.ed.ac.uk/ami/icsi/) | Audio + Transcript | ~70 hours | Second English audio source | CC BY 4.0 |

### Format Mapping

- **QMSum** → direct match to `{meeting_transcripts: [{speaker, content}]}` parser → `estimated`
- **AMI HuggingFace** → rename `{begin_time, end_time, speaker_id, text}` → `{start, end, speaker, text}` → `exact`
- **AMI community JSON** ([guokan-shang/ami-and-icsi-corpora](https://github.com/guokan-shang/ami-and-icsi-corpora)) → `{start, end, speaker, text}` → `exact`
- **AMI audio** → upload WAV directly → diarization → `generated`
- **MeetingBank** → extract word-level timing → `{start, end, speaker, text}` → `exact`

### Testing Workflow

1. Start with **QMSum Product meetings** — fastest feedback loop, no audio
2. Graduate to **AMI** — real multi-speaker dynamics, test transcript JSON and raw audio
3. Stress-test with **MeetingBank** — long meetings, many checkpoints, context window edge cases

For each corpus, test across context window sizes (30s, 60s, 120s, 300s) and observe hold rate, card type distribution, repetition, and intervention quality near topic transitions.

## Benchmark Mode

Navigate to [/benchmark](http://localhost:3000/benchmark) to evaluate prompt and context window performance across multiple meetings.

### How It Works

1. **Configure** — select QMSum meetings, context windows (30s/60s/120s/300s), edit the system prompt, and choose a target participant strategy
2. **Generate** — for each (meeting, context window) combo, runs all 30s ticks through GPT-OSS-120B via Groq (same model as the simulator)
3. **Judge** — each tick is evaluated by GPT-5.2 using three judge stages:
   - **Trigger Judge** — was the intervene/hold decision correct?
   - **Card Judge** (per card) — scores 8 dimensions: type fit, timing, goal fit, grounding, actionability, social tact, specificity, brevity/clarity
   - **Set Judge** — evaluates the card set as a whole: coverage, diversity, ranking, restraint, consistency
4. **Results** — comparison table with drill-down per tick, plus JSON/CSV export

### Scoring

Each tick gets a composite score (0-100) computed from weighted formulas:

- **Intervene ticks**: 25% trigger + 35% first card quality + 20% best card quality + 20% set quality
- **Hold ticks**: 70% decision correct + 30% hold quality

Summary stats: mean/median score, intervention rate, critical fail rate, card quality, set quality, judge low-confidence rate.

### Environment Variables

```
GROQ_API_KEY=...     # required — generator model
OPENAI_API_KEY=...   # required — GPT-5.2 judge
```

### Cost and Performance

The judge sends the transcript window to GPT-5.2 for each evaluation. Larger context windows = more tokens per call:

| Context Window | ~Input tokens per meeting (37 ticks) |
|---|---|
| 30s | 90K-185K |
| 60s | 185K-460K |
| 120s | 370K-925K |
| 300s | 925K-2.2M |

GPT-5.2 pricing: $1.75/1M input, $14/1M output (reasoning tokens billed as output). A single meeting at 60s costs roughly $2-4.

### Key Benchmark Files

| File | Purpose |
|------|---------|
| `lib/benchmark/types.ts` | GeneratorRun, JudgedRun, TickJudgeResult, RunSummaryStats |
| `lib/benchmark/generator.ts` | Headless tick runner (Groq SDK direct) |
| `lib/benchmark/judge.ts` | GPT-5.2 judge caller (10 ticks concurrent) |
| `lib/benchmark/judge-prompts.ts` | Trigger, Card, Set judge prompt templates |
| `lib/benchmark/scorer.ts` | Composite score math + summary aggregation |
| `lib/benchmark/deterministic.ts` | Hard validation (word count, char count, bullets, semicolons) |
| `lib/benchmark/loaders.ts` | QMSum JSON parser + most-active-speaker picker |
| `lib/benchmark/constants.ts` | QMSum URLs, judge model config |

## Architecture

5-stage wizard: **Home → Upload → Processing → Configure → Results**

### Key Files

| File | Purpose |
|------|---------|
| `lib/types.ts` | TranscriptSegment, CardResult, TickResult, TickLog, RunLog, RunConfig |
| `lib/transcript.ts` | `parseTranscript()` — JSON/speaker-line/plain-text detection and normalization |
| `lib/prompt.ts` | DEFAULT_PROMPT, `fillPrompt()`, `formatTranscriptWindow()` |
| `lib/simulation.ts` | `runTick()` (fetch → /api/simulate), `runAllTicks()` (AsyncGenerator, 30s ticks) |
| `lib/actions.ts` | Server Action: `transcribeAudio()` (OpenAI diarization) |
| `lib/constants.ts` | MODEL_ID, TICK_INTERVAL, CONTEXT_PRESETS, CARD_COLORS |
| `app/api/simulate/route.ts` | POST `{filledPrompt}` → Groq SDK → TickResult JSON |
| `app/api/benchmark/*/route.ts` | Benchmark API: meetings list, load, generate, judge |
| `app/benchmark/page.tsx` | Benchmark UI: configure → run → results |

### Prompt Template Variables

| Variable | Source |
|----------|--------|
| `{{target_participant}}` | User selection in Configure step |
| `{{tick_time}}` | Current tick formatted as MM:SS |
| `{{context_window}}` | Selected context window in seconds |
| `{{recent_cards}}` | Last 5 shown cards, or "(none)" |
| `{{transcript_window}}` | `[MM:SS] Speaker: text` per line |

