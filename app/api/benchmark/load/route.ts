import { QMSUM_BASE_URL } from '../../../../lib/benchmark/constants';
import { parseQMSum } from '../../../../lib/benchmark/loaders';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { meetingId }: { meetingId: string } = await req.json();

    if (!/^[A-Z]{2}\d{4}[a-z]$/.test(meetingId)) {
      return Response.json({ error: 'Invalid meeting ID format' }, { status: 400 });
    }

    const url = `${QMSUM_BASE_URL}/${meetingId}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      return Response.json(
        { error: `Failed to fetch ${meetingId}: ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    const { segments, speakers } = parseQMSum(text);

    return Response.json({ segments, speakers, meetingId });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
