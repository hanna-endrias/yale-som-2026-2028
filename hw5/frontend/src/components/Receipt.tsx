import { ACTOR_TITLE, KIND_LABEL, STATUS_LABEL, TICKET_TYPE_LABEL, money } from '../agents'
import type { AgentReport } from '../runView'
import type { ApprovalRequest, Ticket, TicketDecision } from '../types'
import { ActorIcon } from './Icons'

interface Props {
  ticket: Ticket
  decision: TicketDecision | null
  reports: AgentReport[]
  approvals: ApprovalRequest[]
  tokens: number
}

/** The Boss's decision printed like a shop receipt, stamped once the ticket is resolved. */
export function Receipt({ ticket, decision, reports, approvals, tokens }: Props) {
  const pending = approvals.filter(a => a.status === 'pending')
  const resolved = ticket.status === 'resolved'
  return (
    <article className={`receipt ${resolved ? 'resolved' : ''}`} aria-label={`Summary for ticket ${ticket.id}`}>
      <header className="receipt-head">
        <div className="receipt-shop">Campus Customs</div>
        <div className="receipt-sub">Ticket #{ticket.id} · {TICKET_TYPE_LABEL[ticket.type] ?? ticket.type} · {ticket.requester}</div>
      </header>

      {decision ? (
        <>
          <p className="receipt-decision">{decision.decision}</p>
          {decision.rationale && <p className="receipt-why">{decision.rationale}</p>}
        </>
      ) : (
        <p className="receipt-why">The run ended without a decision from the Boss. Check the feed for what stopped it.</p>
      )}

      <div className="receipt-rule" />
      <h3 className="receipt-label">Who did what</h3>
      <ul className="receipt-lines">
        {reports.map(r => (
          <li key={r.agent} className={`agent-${r.agent}`}>
            <span className="who-icon"><ActorIcon actor={r.agent} size={14} /></span>
            <div>
              <strong>{ACTOR_TITLE[r.agent]}</strong> {r.summary}
              {r.tools.length > 0 && <div className="receipt-tools">{r.tools.map(t => <code key={t}>{t}</code>)}</div>}
            </div>
          </li>
        ))}
      </ul>

      {decision?.discount && (
        <>
          <div className="receipt-rule" />
          <div className="receipt-row">
            <span>{decision.discount.qty} × {decision.discount.sku} at {decision.discount.discount_pct}% off</span>
            <span>{money(decision.discount.unit_price, true)} ea · {money(decision.discount.order_total, true)}</span>
          </div>
        </>
      )}

      {approvals.length > 0 && (
        <>
          <div className="receipt-rule" />
          <h3 className="receipt-label">Money</h3>
          {approvals.map(a => (
            <div key={a.id} className="receipt-row">
              <span>#{a.id} {KIND_LABEL[a.kind]}{a.qty ? ` · ${a.qty} × ${a.sku} ${a.size}` : ''}</span>
              <span className={`money-state ${a.status}`}>{money(a.amount)} · {a.status === 'pending' ? 'awaiting you' : a.status}</span>
            </div>
          ))}
        </>
      )}

      {decision && decision.human_actions_needed.length > 0 && !resolved && (
        <>
          <div className="receipt-rule" />
          <h3 className="receipt-label">Your next steps</h3>
          <ul className="receipt-todo">{decision.human_actions_needed.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </>
      )}

      <footer className="receipt-foot">
        <span>{tokens > 0 ? `${tokens.toLocaleString()} tokens` : ''}</span>
        {!resolved && (
          <span className={`ribbon ${pending.length ? 'warn' : ''}`}>
            Agents done · {pending.length ? `${pending.length} awaiting you` : STATUS_LABEL[ticket.status]}
          </span>
        )}
      </footer>
      {resolved && <div className="stamp" aria-label="Resolved">Resolved</div>}
    </article>
  )
}
