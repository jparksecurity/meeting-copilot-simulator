import Groq from 'groq-sdk';
import { MODEL_ID } from '../../../lib/constants';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { filledPrompt }: { filledPrompt: string } = await req.json();
    const completion = await groq.chat.completions.create({
      model: MODEL_ID,
      messages: [{ role: 'user', content: filledPrompt }],
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    try {
      const result = JSON.parse(cleaned);
      return Response.json({ result, raw: text });
    } catch {
      return Response.json({ result: { intervene: false, confidence: 0, reason: 'parse error', cards: [] }, raw: cleaned });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
