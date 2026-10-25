import { stepCountIs, streamText, type LanguageModelUsage, type ModelMessage, type StreamTextOnEndCallback } from 'ai';
import { getModel } from '@/lib/ai';
import { MAX_AGENT_STEPS } from '@/lib/safety';
import { analystSystemPrompt } from './prompts/analyst';
import { createVisualizationTool, VISUALIZATION_TOOL } from './tools/createVisualization';
import { getMentionsTool } from './tools/getMentions';
import { getSentimentSummaryTool } from './tools/getSentimentSummary';
import { getThemesTool } from './tools/getThemes';
import { getTopSourcesTool } from './tools/getTopSources';

type Args = {
  subject: { id: number; name: string };
  messages: ModelMessage[];
  onEnd: StreamTextOnEndCallback;
  onToolUsage: (usage: LanguageModelUsage) => void; // tokens spent by LLM calls inside tools
};

// One chat turn. Tools are built per request with the subject id fixed server-side.
export function streamAnalyst({ subject, messages, onEnd, onToolUsage }: Args) {
  return streamText({
    model: getModel(),
    instructions: analystSystemPrompt(subject.name, new Date().toISOString().slice(0, 10)),
    messages,
    tools: {
      getMentions: getMentionsTool(subject.id),
      getSentimentSummary: getSentimentSummaryTool(subject.id),
      getTopSources: getTopSourcesTool(subject.id),
      getThemes: getThemesTool(subject.id),
      [VISUALIZATION_TOOL]: createVisualizationTool(subject, onToolUsage),
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    onEnd,
  });
}
