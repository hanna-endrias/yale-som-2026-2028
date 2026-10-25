import { createOpenAI, openai } from '@ai-sdk/openai';
import { llmConfig } from '../config/llm';
import { getApiKey } from './env';

export function getActiveLlm() {
  return { provider: llmConfig.provider, model: llmConfig.providers[llmConfig.provider].model };
}

// Built per call so a missing key surfaces as a request error, not a crash at import/build time.
export function getModel() {
  switch (llmConfig.provider) {
    case 'portkey': {
      const cfg = llmConfig.providers.portkey;
      const provider = createOpenAI({ baseURL: cfg.baseURL, apiKey: getApiKey(cfg.envVar).key, headers: cfg.headers });
      return provider.responses(cfg.model);
    }
  }
}

// The provider's hosted web search tool (OpenAI `web_search_preview` behind Portkey).
export function getWebSearchTool() {
  switch (llmConfig.provider) {
    case 'portkey':
      return openai.tools.webSearchPreview({});
  }
}
