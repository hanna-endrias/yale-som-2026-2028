import { createOpenAI } from '@ai-sdk/openai';
import { getPortkeyKey } from './env';

// The one model every agent uses: gpt-6-luna through the Portkey gateway (Responses API).
export const MODEL_NAME = 'gpt-6-luna';
const PORTKEY_BASE_URL = 'https://api.portkey.ai/v1';

// Built per call so a missing key surfaces as a request error, not a crash at import/build time.
export function getModel() {
  const provider = createOpenAI({
    baseURL: PORTKEY_BASE_URL,
    apiKey: getPortkeyKey().key,
    headers: { 'x-portkey-provider': 'openai' },
  });
  return provider.responses(MODEL_NAME);
}
