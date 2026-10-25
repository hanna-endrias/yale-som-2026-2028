// Next.js startup hook: flag a missing LLM key or SESSION_SECRET at boot instead of on the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { llmConfig } = await import('./config/llm');
  const { getEnvVar } = await import('./lib/env');
  const { envVar } = llmConfig.providers[llmConfig.provider];
  const { value, source } = getEnvVar(envVar);
  if (!value) console.error(`✗ ${envVar} is missing (LLM provider: ${llmConfig.provider}). Add it to ${source}`);
  const secret = getEnvVar('SESSION_SECRET');
  if (!secret.value) console.warn(`⚠ SESSION_SECRET is missing. Add it to ${secret.source} (dev falls back to an insecure secret).`);
}
