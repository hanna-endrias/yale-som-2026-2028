// npm run check:env — confirms the active provider's key resolves from .env and the model answers.
import { llmConfig } from '../config/llm';
import { pingModel } from '../lib/healthCheck';

async function main() {
  const { envVar } = llmConfig.providers[llmConfig.provider];
  console.log(`Provider: ${llmConfig.provider} · model: ${llmConfig.providers[llmConfig.provider].model} · key: ${envVar}`);
  const result = await pingModel();
  if (!result.ok) {
    console.error(`✗ ${result.provider}/${result.model} call failed: ${result.error}`);
    process.exit(1);
  }
  console.log(`${envVar} loaded from: ${result.keySource}`);
  console.log(
    `✓ ${result.model} replied "${result.text}" (${result.inputTokens} in / ${result.outputTokens} out tokens, ${result.latencyMs} ms)`,
  );
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
