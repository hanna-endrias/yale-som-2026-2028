// Turns the flat audit trail into what the desk shows: runs per ticket, who is active,
// who delegated to whom, and the Boss's final decision.
import { isAgent } from './agents'
import type { AgentName, AuditEvent, TicketDecision } from './types'

export interface TicketRun {
  runId: string
  startedAt: string
  firstId: number
  beforeReset: boolean
  events: AuditEvent[] // the agents' events plus the human decisions that followed this run
}

/** Every agent run on a ticket, oldest first. */
export function ticketRuns(all: AuditEvent[], ticketId: number): TicketRun[] {
  const lastReset = all.reduce((acc, e) => (e.event === 'db_reset' ? e.id : acc), -1)
  const mine = all.filter(e => e.ticket_id === ticketId)
  const runs: TicketRun[] = []
  for (const e of mine) {
    if (!isAgent(e.agent)) continue
    let run = runs.find(r => r.runId === e.run_id)
    if (!run) {
      run = { runId: e.run_id, startedAt: e.timestamp, firstId: e.id, beforeReset: e.id < lastReset, events: [] }
      runs.push(run)
    }
    run.events.push(e)
  }
  runs.forEach((run, i) => {
    const until = runs[i + 1]?.firstId ?? Infinity
    const human = mine.filter(e => e.agent === 'human' && e.id > run.firstId && e.id < until)
    run.events = [...run.events, ...human].sort((a, b) => a.id - b.id)
  })
  return runs
}

export interface Edge {
  from: AgentName
  to: AgentName
  request: string
  refused: boolean
}

export interface StageState {
  active: AgentName | null
  started: Set<AgentName>
  done: Set<AgentName>
  edges: Edge[]
  lastWords: Partial<Record<AgentName, string>>
}

/** Who has worked, who is working right now, and the delegation lines between them. */
export function stageState(events: AuditEvent[], running: boolean): StageState {
  const started = new Set<AgentName>()
  const done = new Set<AgentName>()
  const stack: AgentName[] = []
  const edges: Edge[] = []
  const lastWords: Partial<Record<AgentName, string>> = {}
  for (const e of events) {
    if (!isAgent(e.agent)) continue
    if (e.event === 'run_start') {
      started.add(e.agent)
      stack.push(e.agent)
    } else if (e.event === 'run_end' || e.event === 'error') {
      done.add(e.agent)
      const at = stack.lastIndexOf(e.agent)
      if (at >= 0) stack.splice(at, 1)
    } else if (e.event === 'delegation') {
      const to = e.args?.teammate
      if (typeof to === 'string' && isAgent(to)) {
        edges.push({ from: e.agent, to, request: String(e.args?.request ?? ''), refused: e.result !== 'accepted' })
      }
    } else if (e.event === 'model_response' && e.text) {
      lastWords[e.agent] = e.text
    }
  }
  return { active: running ? stack.at(-1) ?? null : null, started, done, edges, lastWords }
}

/** The Boss's TicketDecision from a finished run, if there is one. */
export function bossDecision(events: AuditEvent[]): TicketDecision | null {
  const end = events.find(e => e.agent === 'boss' && e.event === 'run_end' && e.depth === 0)
  return (end?.output as TicketDecision | undefined) ?? null
}

export interface AgentReport {
  agent: AgentName
  summary: string
  actions: string[]
  tools: string[]
}

/** One line per specialist: their own summary plus the tools they actually called. */
export function agentReports(events: AuditEvent[]): AgentReport[] {
  const byAgent = new Map<AgentName, AgentReport>()
  for (const e of events) {
    if (!isAgent(e.agent)) continue
    const report = byAgent.get(e.agent) ?? { agent: e.agent, summary: '', actions: [], tools: [] }
    for (const call of e.tool_calls ?? []) {
      if (call.tool !== 'final_result' && !report.tools.includes(call.tool)) report.tools.push(call.tool)
    }
    if (e.event === 'run_end' && e.output) {
      const out = e.output as { summary?: string; decision?: string; actions_taken?: string[] }
      report.summary = out.summary ?? out.decision ?? report.summary
      report.actions = out.actions_taken ?? report.actions
    }
    byAgent.set(e.agent, report)
  }
  return [...byAgent.values()]
}

/** Total tokens the run used, from the per-response usage the audit trail records. */
export function tokensUsed(events: AuditEvent[]): number {
  return events
    .filter(e => e.event === 'model_response' && e.usage)
    .reduce((sum, e) => sum + (e.usage!.input_tokens ?? 0) + (e.usage!.output_tokens ?? 0), 0)
}
