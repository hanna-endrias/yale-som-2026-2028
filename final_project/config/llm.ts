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
  // USD per 1M tokens, used by lib/cost.ts for tokenomics.
  // PLACEHOLDER VALUES: must be confirmed against the provider's price list before reporting costs.
  pricing: {
    'gpt-6-luna': { input: 1.25, output: 10, cached: 0.125 },
  },
} as const;
