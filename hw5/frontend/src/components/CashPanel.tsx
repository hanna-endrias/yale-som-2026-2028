import { useEffect, useRef, useState } from 'react'
import { money, shopDate } from '../agents'
import { useAnimatedNumber } from '../hooks'
import type { Cash } from '../types'

const KIND: Record<string, string> = { invoice: 'Vendor invoice', rent: 'Rent', purchase_order: 'Purchase order' }

/** Checking balance as a till display, plus a bar showing what the money is already spoken for. */
export function CashPanel({ cash }: { cash: Cash | null }) {
  const balance = cash?.balance ?? 0
  const shown = useAnimatedNumber(cash ? cash.balance : null)
  const prev = useRef<number | null>(null)
  const [drop, setDrop] = useState<{ amount: number; key: number } | null>(null)

  useEffect(() => {
    if (cash === null) return
    if (prev.current !== null && balance < prev.current) {
      setDrop({ amount: prev.current - balance, key: Date.now() })
    }
    prev.current = balance
  }, [balance, cash])

  if (!cash) return <section className="panel cash"><h2 className="panel-title">Checking</h2><p className="muted">Loading…</p></section>

  const free = Math.max(cash.available_for_new_orders, 0)
  const segments = [
    { key: 'rent', label: 'Set aside for rent', value: cash.rent_reserve },
    { key: 'pending', label: 'Awaiting your approval', value: cash.pending_total },
    { key: 'invoices', label: 'Unpaid invoices', value: cash.unpaid_invoices_not_requested },
    { key: 'free', label: 'Free for new orders', value: free },
  ]
  const total = Math.max(balance, 1)

  return (
    <section className="panel cash" aria-label="Checking balance">
      <h2 className="panel-title">Checking</h2>
      <div className="balance-wrap">
        <div className="balance" aria-live="polite">{money(Math.round(shown))}</div>
        {drop && <span key={drop.key} className="drop">−{money(drop.amount)}</span>}
      </div>
      <div className="as-of">as of {shopDate(cash.as_of)} · cash only goes out</div>

      <div className="budget" role="img" aria-label="How the balance is spoken for">
        {segments.map(s => s.value > 0 && (
          <span key={s.key} className={`seg seg-${s.key}`} style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${money(s.value)}`} />
        ))}
      </div>
      <ul className="legend">
        {segments.map(s => (
          <li key={s.key}><span className={`swatch seg-${s.key}`} />{s.label}<b>{money(s.value)}</b></li>
        ))}
      </ul>

      {cash.payments_made.length > 0 && (
        <>
          <h3 className="sub-title">Paid</h3>
          <ul className="ledger">
            {[...cash.payments_made].reverse().map(p => (
              <li key={p.id}>
                <span>{KIND[p.kind] ?? p.kind}<small> · approved by {p.approved_by}</small></span>
                <b>−{money(p.amount)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
