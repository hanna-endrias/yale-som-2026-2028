import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE, ApiError, api } from './api'
import { money } from './agents'
import { useInterval, useStoredString, useTheme } from './hooks'
import { agentReports, bossDecision, stageState, ticketRuns, tokensUsed } from './runView'
import type { ApprovalRequest, AuditEvent, Cash, RunRecord, Ticket } from './types'
import { AgentStage } from './components/AgentStage'
import { ApprovalsPanel } from './components/ApprovalsPanel'
import { CashPanel } from './components/CashPanel'
import { Feed } from './components/Feed'
import { Header } from './components/Header'
import { Receipt } from './components/Receipt'
import { TicketList } from './components/TicketList'

interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'error' }

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [approver, setApprover] = useStoredString('desk-approver')
  const [approverError, setApproverError] = useState(false)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [today, setToday] = useState<string | null>(null)
  const [cash, setCash] = useState<Cash | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [lastId, setLastId] = useState(-1)
  // The selected ticket lives in the URL (#ticket=101) so a ticket can be linked to directly.
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const id = Number(new URLSearchParams(location.hash.slice(1)).get('ticket'))
    return Number.isInteger(id) && id > 0 ? id : null
  })
  useEffect(() => {
    if (selectedId !== null) history.replaceState(null, '', `#ticket=${selectedId}`)
  }, [selectedId])
  const [viewRunId, setViewRunId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [offline, setOffline] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, text, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
  }, [])

  const fail = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 0) setOffline(true)
    toast(err instanceof Error ? err.message : String(err), 'error')
  }, [toast])

  const refreshBoard = useCallback(async () => {
    try {
      const [t, c, a, r] = await Promise.all([api.tickets(), api.cash(), api.approvals(), api.runs()])
      setTickets(t.tickets)
      setToday(t.today)
      setCash(c)
      setApprovals(a.requests)
      setRuns(r)
      setOffline(false)
      setSelectedId(id => id ?? t.tickets[0]?.id ?? null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) setOffline(true)
    }
  }, [])

  const pollEvents = useCallback(async () => {
    try {
      const res = await api.events(lastId)
      if (res.events.length > 0) {
        // Polls can overlap (timer + after an action), so merge by event id.
        setEvents(prev => {
          const seen = new Set(prev.map(e => e.id))
          return [...prev, ...res.events.filter(e => !seen.has(e.id))]
        })
        setLastId(id => Math.max(id, res.events.at(-1)!.id))
        refreshBoard()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) setOffline(true)
    }
  }, [lastId, refreshBoard])

  // First load only; after that the interval below keeps the board fresh.
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (loaded) return
    setLoaded(true)
    refreshBoard()
    pollEvents()
  }, [loaded, refreshBoard, pollEvents])

  const activeRun = runs.find(r => r.status === 'running') ?? null
  // Poll fast while agents are working, slowly otherwise (another tab may be approving).
  useInterval(pollEvents, activeRun ? 900 : 3000)
  useInterval(async () => {
    if (!activeRun) return
    try {
      const r = await api.runStatus(activeRun.run_id)
      if (r.status !== 'running') {
        await refreshBoard()
        await pollEvents()
        if (r.status === 'error') toast(`Run on ticket #${r.ticket_id} stopped: ${r.error}`, 'error')
        else toast(`Agents finished ticket #${r.ticket_id}`)
      }
    } catch { /* the events poll reports connection problems */ }
  }, activeRun ? 1500 : null)

  // --- The selected ticket's runs, stage, and receipt -----------------------
  const selected = tickets.find(t => t.id === selectedId) ?? null
  const runsForTicket = useMemo(() => (selectedId === null ? [] : ticketRuns(events, selectedId)), [events, selectedId])
  const viewRun = runsForTicket.find(r => r.runId === viewRunId) ?? runsForTicket.at(-1) ?? null
  const isLive = !!activeRun && viewRun?.runId === activeRun.run_id
  const waitingForFirstEvent = !!activeRun && activeRun.ticket_id === selectedId && !isLive
  const stage = useMemo(() => stageState(viewRun?.events ?? [], isLive), [viewRun, isLive])
  const decision = viewRun ? bossDecision(viewRun.events) : null
  const finished = !!viewRun && !isLive && viewRun.events.some(e => e.agent === 'boss' && e.depth === 0 && (e.event === 'run_end' || e.event === 'error'))

  useEffect(() => { setViewRunId(null) }, [selectedId])
  useEffect(() => { if (activeRun?.ticket_id === selectedId) setViewRunId(null) }, [activeRun, selectedId])

  // --- Actions ---------------------------------------------------------------
  const needApprover = () => {
    if (approver.trim()) return false
    setApproverError(true)
    toast('Add your name next to "Approving as" first. It is recorded on the payment.', 'warn')
    return true
  }

  const runTicket = async (id: number) => {
    try {
      const run = await api.run(id)
      setRuns(r => [run, ...r])
      setSelectedId(id)
      setViewRunId(null)
      toast(`Agents started on ticket #${id}`)
    } catch (err) { fail(err) }
  }

  const decide = async (req: ApprovalRequest, approve: boolean) => {
    if (needApprover()) return
    setBusyId(req.id)
    try {
      const res = approve ? await api.approve(req.id, approver.trim()) : await api.reject(req.id, approver.trim())
      toast(approve ? `Paid ${money(req.amount)}. Checking is now ${money(res.balance)}.` : `Rejected request #${req.id}. No money moved.`)
      if (res.ticket_resolved) toast(`Ticket #${res.ticket_id} resolved`)
      await refreshBoard()
      await pollEvents()
    } catch (err) { fail(err) } finally { setBusyId(null) }
  }

  const resolve = async (id: number) => {
    if (needApprover()) return
    try {
      await api.resolve(id, approver.trim())
      toast(`Ticket #${id} resolved`)
      await refreshBoard()
      await pollEvents()
    } catch (err) { fail(err) }
  }

  const reset = async () => {
    if (!window.confirm('Reset the shop to the original database? Approvals, drafts, and payments are cleared. The audit trail is kept.')) return
    try {
      const res = await api.reset()
      toast(`Shop reset. Checking is back to ${money(res.balance)}.`)
      await refreshBoard()
      await pollEvents()
    } catch (err) { fail(err) }
  }

  const ticketApprovals = approvals.filter(a => a.ticket_id === selectedId)

  return (
    <div className="app">
      <Header today={today} approver={approver}
              onApprover={v => { setApprover(v); if (v.trim()) setApproverError(false) }}
              approverError={approverError} theme={theme} onToggleTheme={toggleTheme}
              onReset={reset} resetDisabled={!!activeRun} />

      {offline && (
        <div className="banner">
          Can't reach the backend at {API_BASE}. Start it from <code>backend/</code> with
          <code>uvicorn main:app --reload --port 8000</code>.
        </div>
      )}

      <main className="desk">
        <TicketList tickets={tickets} selectedId={selectedId} activeRun={activeRun}
                    onSelect={setSelectedId} onRun={runTicket} onResolve={resolve} />

        <div className="center">
          <AgentStage state={stage} running={isLive} />
          <section className="panel conversation" aria-label="Agent conversation">
            <div className="conversation-head">
              <h2 className="panel-title">
                {selected ? <>Ticket #{selected.id} · {selected.subject}</> : 'Pick a ticket'}
                {isLive && <span className="live-pill"><span className="pulse-dot" /> Live</span>}
                {viewRun?.beforeReset && <span className="old-pill" title="This run happened before the shop was last reset">Before reset</span>}
              </h2>
              {runsForTicket.length > 1 && (
                <select value={viewRun?.runId ?? ''} onChange={e => setViewRunId(e.target.value)} aria-label="Run">
                  {runsForTicket.map((r, i) => (
                    <option key={r.runId} value={r.runId}>
                      Run {i + 1}{r.beforeReset ? ' (before reset)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Feed events={viewRun?.events ?? []} running={isLive} active={stage.active}
                  empty={waitingForFirstEvent ? 'Starting the agents…'
                    : selected ? 'No runs on this ticket yet. Press "Run agents" to start the team.' : ''} />
          </section>
          {finished && selected && (
            <Receipt ticket={selected} decision={decision} reports={agentReports(viewRun!.events)}
                     approvals={ticketApprovals} tokens={tokensUsed(viewRun!.events)} />
          )}
        </div>

        <aside className="side">
          <CashPanel cash={cash} />
          <ApprovalsPanel approvals={approvals} cash={cash} busyId={busyId}
                          onApprove={r => decide(r, true)} onReject={r => decide(r, false)}
                          onShowTicket={setSelectedId} />
        </aside>
      </main>

      <div className="toasts" role="status">
        {toasts.map(t => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
      </div>
    </div>
  )
}
