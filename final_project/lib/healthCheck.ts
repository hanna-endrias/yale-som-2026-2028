import { generateText } from 'ai';
import { getModel, MODEL_NAME } from './ai';
import { getPortkeyKey } from './env';

export type HealthResult =
  | { ok: true; model: string; keySource: string; text: string; inputTokens?: number; outputTokens?: number; latencyMs: number }
  | { ok: false; model: string; error: string };

// Smallest possible round trip through Portkey; shared by the API route and scripts/check-env.ts.
export async function pingModel(): Promise<HealthResult> {
  const started = Date.now();
  try {
    const keySource = getPortkeyKey().source;
    const { text, usage } = await generateText({ model: getModel(), prompt: 'Reply with exactly: pong' });
    return {
      ok: true,
      model: MODEL_NAME,
      keySource,
      text,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return { ok: false, model: MODEL_NAME, error: err instanceof Error ? err.message : String(err) };
  }
}
