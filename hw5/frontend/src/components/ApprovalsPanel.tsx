import { ACTOR_TITLE, KIND_LABEL, isAgent, money } from '../agents'
import type { ApprovalRequest, Cash } from '../types'
import { ActorIcon, Alert, Check } from './Icons'

interface Props {
  approvals: ApprovalRequest[]
  cash: Cash | null
  busyId: number | null
  onApprove: (req: ApprovalRequest) => void
  onReject: (req: ApprovalRequest) => void
  onShowTicket: (ticketId: number) => void
}

/** Requests the agents prepared. Approving one is the only way money leaves the shop. */
export function ApprovalsPanel({ approvals, cash, busyId, onApprove, onReject, onShowTicket }: Props) {
  const pending = approvals.filter(a => a.status === 'pending').sort((a, b) => a.id - b.id)
  const decided = approvals.filter(a => a.status !== 'pending').slice(0, 5)
  const balance = cash?.balance ?? 0

  return (
    <section className="panel approvals" aria-label="Approvals">
      <h2 className="panel-title">
        Needs your approval {pending.length > 0 && <span className="count-chip warn">{pending.length}</span>}
      </h2>
      {pending.length === 0 && (
        <p className="empty-note">Nothing waiting on you. When an agent prepares a payment or a purchase order, it lands here.</p>
      )}
      {pending.map(req => {
        const leaves = balance - req.amount
        const blocker = req.kind === 'purchase_order'
          ? cash?.open_invoices.find(i => i.vendor_id === req.ref_id)
          : undefined
        return (
          <div key={req.id} className="check">
            <div className="check-top">
              <span className="check-kind">{KIND_LABEL[req.kind]} <span className="muted">#{req.id}</span></span>
              <span className="check-amount">{money(req.amount)}</span>
            </div>
            {req.kind === 'purchase_order' && (
              <div className="check-detail">{req.qty} × {req.sku} size {req.size}</div>
            )}
            {req.reason && <p className="check-reason">“{req.reason}”</p>}
            <div className="check-meta">
              {isAgent(req.requested_by) && (
                <span className={`who agent-${req.requested_by}`}>
                  <span className="who-icon"><ActorIcon actor={req.requested_by} size={13} /></span>
                  {ACTOR_TITLE[req.requested_by]}
                </span>
              )}
              {req.ticket_id !== null && (
                <button className="link" onClick={() => onShowTicket(req.ticket_id!)}>ticket #{req.ticket_id}</button>
              )}
            </div>
            <div className={`leaves ${leaves < 0 ? 'neg' : ''}`}>
              Leaves {money(leaves)} in checking
            </div>
            {blocker && (
              <p className="blocked"><Alert size={13} /> {blocker.vendor_name} won't ship until invoice #{blocker.id} is paid. Approve that first.</p>
            )}
            <div className="check-actions">
              <button className="btn primary" disabled={busyId === req.id} onClick={() => onApprove(req)}>
                <Check size={14} /> {busyId === req.id ? 'Approving…' : 'Approve'}
              </button>
              <button className="btn" disabled={busyId === req.id} onClick={() => onReject(req)}>Reject</button>
            </div>
          </div>
        )
      })}

      {decided.length > 0 && (
        <>
          <h3 className="sub-title">Decided</h3>
          <ul className="decided">
            {decided.map(d => (
              <li key={d.id} className={d.status}>
                <span>#{d.id} {KIND_LABEL[d.kind]}</span>
                <span>{money(d.amount)} · {d.status} by {d.decided_by}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
