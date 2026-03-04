import { groq } from '@ai-sdk/groq';
import { streamText, convertToModelMessages, UIMessage } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: groq('openai/gpt-oss-120b'),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
