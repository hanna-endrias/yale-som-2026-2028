import { stepCountIs, streamText, type ModelMessage, type StreamTextOnEndCallback } from 'ai';
import { getModel } from '@/lib/ai';
import { MAX_AGENT_STEPS } from '@/lib/safety';
import { analystSystemPrompt } from './prompts/analyst';
import { getMentionsTool } from './tools/getMentions';
import { getSentimentSummaryTool } from './tools/getSentimentSummary';
import { getTopSourcesTool } from './tools/getTopSources';

type Args = {
  subject: { id: number; name: string };
  messages: ModelMessage[];
  onEnd: StreamTextOnEndCallback;
};

// One chat turn. Tools are built per request with the subject id fixed server-side.
export function streamAnalyst({ subject, messages, onEnd }: Args) {
  return streamText({
    model: getModel(),
    instructions: analystSystemPrompt(subject.name, new Date().toISOString().slice(0, 10)),
    messages,
    tools: {
      getMentions: getMentionsTool(subject.id),
      getSentimentSummary: getSentimentSummaryTool(subject.id),
      getTopSources: getTopSourcesTool(subject.id),
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    onEnd,
  });
}
