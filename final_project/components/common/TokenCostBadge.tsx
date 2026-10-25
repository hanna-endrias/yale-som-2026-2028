// Token count and estimated cost (config/llm.ts pricing). A cost of 0 means none was recorded, so it shows "—".
export default function TokenCostBadge({ tokens, costUsd }: { tokens: number; costUsd: number }) {
  return (
    <span data-testid="token-cost" className="text-xs text-muted-foreground">
      {tokens.toLocaleString('en-US')} tok · {costUsd > 0 ? `~$${costUsd.toPrecision(2)}` : '—'}
    </span>
  );
}
