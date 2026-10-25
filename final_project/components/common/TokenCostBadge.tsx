const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

// Estimated cost first (config/llm.ts pricing), then a compact token count; the exact count is in the tooltip.
// A cost of 0 means none was recorded, so it shows "—".
export default function TokenCostBadge({ tokens, costUsd }: { tokens: number; costUsd: number }) {
  const cost = costUsd <= 0 ? '—' : costUsd >= 0.01 ? `~$${costUsd.toFixed(2)}` : `~$${costUsd.toPrecision(1)}`;
  return (
    <span
      data-testid="token-cost"
      title={`${tokens.toLocaleString('en-US')} tokens (estimated cost)`}
      className="text-xs text-muted-foreground"
    >
      {cost} · {compact.format(tokens)} tokens
    </span>
  );
}
