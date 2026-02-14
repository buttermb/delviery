import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const config = {
    runtime: 'edge',
};

export default async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const result = await streamText({
            model: anthropic('claude-3-5-sonnet-20240620'),
            messages,
            system: 'You are a helpful assistant for FloraIQ.',
        });

        return result.toDataStreamResponse();
    } catch (error) {
        console.error('AI Chat Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
