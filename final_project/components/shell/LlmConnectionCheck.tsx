'use client';

import { useState } from 'react';
import type { HealthResult } from '@/lib/healthCheck';

// Manual button (not on page load) so hot reloads during UI work don't spend tokens.
export default function LlmConnectionCheck({ provider, model }: { provider: string; model: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);

  async function runCheck() {
    setLoading(true);
    try {
      const res = await fetch('/api/health/ai');
      setResult(await res.json());
    } catch (err) {
      setResult({ ok: false, provider, model, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-sm text-sm">
      <p className="text-muted-foreground" data-testid="llm-line">
        LLM: {provider} · {model}
      </p>
      <button
        type="button"
        onClick={runCheck}
        disabled={loading}
        data-testid="llm-check"
        className="self-start rounded-md bg-button px-md py-sm font-medium text-on-button hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
      >
        {loading ? 'Testing…' : 'Test connection'}
      </button>
      {result && (
        <p data-testid="llm-result" className="break-words">
          {result.ok ? (
            <span className="font-semibold text-accent-text">✓ Connected · {result.latencyMs} ms</span>
          ) : (
            <span className="font-semibold">✗ {result.error}</span>
          )}
        </p>
      )}
    </div>
  );
}
