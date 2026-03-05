import { QMSUM_MEETINGS } from '../../../../lib/benchmark/constants';

export async function GET() {
  const meetings = QMSUM_MEETINGS.map((id) => ({ id, name: id }));
  return Response.json({ meetings });
}
