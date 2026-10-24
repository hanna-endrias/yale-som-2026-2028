'use client';

import { useState } from 'react';
import type { HealthResult } from '@/lib/healthCheck';

// Manual button (not on page load) so hot reloads during UI work don't spend tokens.
export default function PortkeyCheck() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);

  async function runCheck() {
    setLoading(true);
    try {
      const res = await fetch('/api/health/ai');
      setResult(await res.json());
    } catch (err) {
      setResult({ ok: false, model: 'unknown', error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-md rounded-lg border border-border bg-panel p-lg">
      <div className="flex items-center justify-between gap-md">
        <h2 className="font-heading text-lg font-semibold">LLM connection</h2>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          data-testid="portkey-check"
          className="rounded-md bg-button px-md py-sm text-sm font-medium text-on-button hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Test Portkey connection'}
        </button>
      </div>
      {result && (
        <div data-testid="portkey-result" className="text-sm">
          {result.ok ? (
            <p>
              <span className="font-semibold text-accent-text">✓ Connected</span> — {result.model} replied
              “{result.text}” · {result.inputTokens ?? '?'} in / {result.outputTokens ?? '?'} out tokens ·{' '}
              {result.latencyMs} ms
              <br />
              <span className="text-muted">Key loaded from: {result.keySource}</span>
            </p>
          ) : (
            <p>
              <span className="font-semibold">✗ Failed</span> — {result.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
