import { STATUS_LABEL, TICKET_TYPE_LABEL } from '../agents'
import type { RunRecord, Ticket } from '../types'
import { Check, Play } from './Icons'

interface Props {
  tickets: Ticket[]
  selectedId: number | null
  activeRun: RunRecord | null
  onSelect: (id: number) => void
  onRun: (id: number) => void
  onResolve: (id: number) => void
}

export function TicketList({ tickets, selectedId, activeRun, onSelect, onRun, onResolve }: Props) {
  return (
    <section className="panel tickets" aria-label="Tickets">
      <h2 className="panel-title">Tickets</h2>
      <ul className="ticket-list">
        {tickets.map(t => {
          const running = activeRun?.ticket_id === t.id
          const status = running ? 'in_progress' : t.status
          const selected = t.id === selectedId
          const canResolve = !running && t.status !== 'resolved' && t.status !== 'open' && t.pending_approvals === 0
          return (
            <li key={t.id}>
              <div className={`ticket-card ${selected ? 'selected' : ''} ${t.status === 'resolved' ? 'is-resolved' : ''}`}
                   role="button" tabIndex={0} aria-pressed={selected}
                   onClick={() => onSelect(t.id)}
                   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id) } }}>
                <div className="ticket-top">
                  <span className="ticket-id">#{t.id}</span>
                  <span className="ticket-type">{TICKET_TYPE_LABEL[t.type] ?? t.type}</span>
                </div>
                <div className="ticket-subject">{t.subject}</div>
                <div className="ticket-requester">{t.requester}</div>
                <div className="ticket-meta">
                  <span className={`status status-${status}`}>
                    {running && <span className="pulse-dot" aria-hidden="true" />}
                    {status === 'resolved' && <Check size={13} />}
                    {STATUS_LABEL[status]}
                  </span>
                  {t.pending_approvals > 0 && (
                    <span className="count-chip warn">{t.pending_approvals} awaiting you</span>
                  )}
                  {t.drafts > 0 && <span className="count-chip">{t.drafts} draft{t.drafts > 1 ? 's' : ''}</span>}
                </div>
                {selected && (
                  <div className="ticket-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn primary" disabled={!!activeRun}
                            title={activeRun && !running ? `Ticket ${activeRun.ticket_id} is running` : undefined}
                            onClick={() => onRun(t.id)}>
                      <Play size={14} />
                      {running ? 'Agents working…' : t.status === 'open' ? 'Run agents' : 'Run again'}
                    </button>
                    {canResolve && (
                      <button className="btn" onClick={() => onResolve(t.id)}>
                        <Check size={14} /> Mark resolved
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {activeRun && activeRun.ticket_id !== selectedId && (
        <p className="hint">Ticket #{activeRun.ticket_id} is running. One run at a time keeps cash safe.</p>
      )}
    </section>
  )
}
