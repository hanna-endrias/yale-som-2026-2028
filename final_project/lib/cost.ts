import type { LanguageModelUsage } from 'ai';
import { llmConfig } from '@/config/llm';

type Usage = { inputTokens: number; outputTokens: number; cachedTokens: number };

// Estimated USD cost from config/llm.ts pricing (per 1M tokens). Input tokens include cached ones,
// which are billed at the cached rate instead.
export function estimateCost({ inputTokens, outputTokens, cachedTokens }: Usage): number {
  const price = llmConfig.pricing[llmConfig.providers[llmConfig.provider].model];
  return ((inputTokens - cachedTokens) * price.input + cachedTokens * price.cached + outputTokens * price.output) / 1_000_000;
}

// An AI SDK usage object as a token_usage row (minus scope/ref_id), cost included.
export function usageRow(usage: LanguageModelUsage) {
  const row = {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cachedTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
  };
  return { ...row, estimatedCostUsd: estimateCost(row) };
}
