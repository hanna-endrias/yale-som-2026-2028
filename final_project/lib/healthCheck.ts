import { generateText } from 'ai';
import { llmConfig } from '../config/llm';
import { getActiveLlm, getModel } from './ai';
import { getApiKey } from './env';

export type HealthResult =
  | {
      ok: true;
      provider: string;
      model: string;
      keySource: string;
      text: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
    }
  | { ok: false; provider: string; model: string; error: string };

// Smallest possible round trip to the active LLM provider; shared by the API route and scripts/check-env.ts.
export async function pingModel(): Promise<HealthResult> {
  const { provider, model } = getActiveLlm();
  const started = Date.now();
  try {
    const keySource = getApiKey(llmConfig.providers[provider].envVar).source;
    const { text, usage } = await generateText({ model: getModel(), prompt: 'Reply with exactly: pong' });
    return {
      ok: true,
      provider,
      model,
      keySource,
      text,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return { ok: false, provider, model, error: err instanceof Error ? err.message : String(err) };
  }
}
