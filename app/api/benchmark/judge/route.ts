import { GeneratorRun, JudgedRun } from '../../../../lib/benchmark/types';
import { judgeAllTicks } from '../../../../lib/benchmark/judge';
import { computeSummary } from '../../../../lib/benchmark/scorer';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { generatorRun }: { generatorRun: GeneratorRun } = await req.json();

    const judgedTicks = await judgeAllTicks(
      generatorRun.ticks,
      generatorRun.targetParticipant
    );

    const summary = computeSummary(judgedTicks);

    const judgedRun: JudgedRun = { generatorRun, judgedTicks, summary };

    return Response.json({ judgedRun });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
