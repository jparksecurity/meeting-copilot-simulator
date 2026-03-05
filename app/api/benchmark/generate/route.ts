import { TranscriptSegment } from '../../../../lib/types';
import { runBenchmarkTicks } from '../../../../lib/benchmark/generator';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body: {
      segments: TranscriptSegment[];
      targetParticipant: string;
      contextWindowSeconds: number;
      promptText: string;
      promptLabel: string;
      meetingId: string;
    } = await req.json();

    const run = await runBenchmarkTicks(body.segments, {
      targetParticipant: body.targetParticipant,
      contextWindowSeconds: body.contextWindowSeconds,
      promptText: body.promptText,
      promptLabel: body.promptLabel,
      meetingId: body.meetingId,
    });

    return Response.json({ run });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
