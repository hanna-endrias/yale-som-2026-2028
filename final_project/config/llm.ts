// Single source for LLM selection (ARCHITECTURE §1b). Adding a provider = a new entry here
// plus a `case` in lib/ai.ts. No other file names a provider, key variable, or model.
export const llmConfig = {
  provider: 'portkey', // the active provider
  providers: {
    portkey: {
      envVar: 'PORTKEY_API_KEY', // read from final_project/.env
      baseURL: 'https://api.portkey.ai/v1',
      headers: { 'x-portkey-provider': 'openai' },
      model: 'gpt-6-luna',
    },
  },
  // USD per 1M tokens, used by lib/cost.ts for tokenomics. gpt-6-luna prices were fitted from the
  // Portkey logs of 8 fetch requests on 2026-10-25 (all within 0.02 cents of Portkey's cost).
  pricing: {
    'gpt-6-luna': { input: 0.1, output: 0.5, cached: 0.01 },
  },
} as const;
