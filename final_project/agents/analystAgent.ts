import { stepCountIs, streamText, type LanguageModelUsage, type ModelMessage, type StreamTextOnEndCallback } from 'ai';
import { getModel } from '@/lib/ai';
import { MAX_AGENT_STEPS } from '@/lib/safety';
import { analystSystemPrompt } from './prompts/analyst';
import { createVisualizationTool, VISUALIZATION_TOOL } from './tools/createVisualization';
import { getMentionsTool } from './tools/getMentions';
import { getSentimentSummaryTool } from './tools/getSentimentSummary';
import { getThemesTool } from './tools/getThemes';
import { getTopSourcesTool } from './tools/getTopSources';
import { listFetchRunsTool } from './tools/listFetchRuns';
import { DELETE_PROMPT_TOOL, managePromptTools, UPDATE_PROMPT_TOOL } from './tools/managePrompts';
import { PLAN_FETCH_TOOL, planFetchRunTool } from './tools/planFetchRun';

// Tools whose output is saved as chat_messages.payload and rendered as a card in the chat.
export const CARD_TOOLS = new Set<string>([VISUALIZATION_TOOL, PLAN_FETCH_TOOL, UPDATE_PROMPT_TOOL, DELETE_PROMPT_TOOL]);

type Args = {
  ownerId: number;
  subject: { id: number; name: string };
  messages: ModelMessage[];
  onEnd: StreamTextOnEndCallback;
  onToolUsage: (usage: LanguageModelUsage) => void; // tokens spent by LLM calls inside tools
};

// One chat turn. Tools are built per request with the owner and subject ids fixed server-side.
export function streamAnalyst({ ownerId, subject, messages, onEnd, onToolUsage }: Args) {
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
      listFetchRuns: listFetchRunsTool(ownerId, subject.id),
      [PLAN_FETCH_TOOL]: planFetchRunTool(ownerId, subject),
      ...managePromptTools(ownerId, subject),
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    onEnd,
  });
}
