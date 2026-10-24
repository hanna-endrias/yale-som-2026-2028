// npm run check:env — confirms PORTKEY_API_KEY resolves and gpt-6-luna answers through Portkey.
import { pingModel } from '../lib/healthCheck';

async function main() {
  const result = await pingModel();
  if (!result.ok) {
    console.error(`✗ ${result.model} call failed: ${result.error}`);
    process.exit(1);
  }
  console.log(`PORTKEY_API_KEY loaded from: ${result.keySource}`);
  console.log(
    `✓ ${result.model} replied "${result.text}" (${result.inputTokens} in / ${result.outputTokens} out tokens, ${result.latencyMs} ms)`,
  );
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
