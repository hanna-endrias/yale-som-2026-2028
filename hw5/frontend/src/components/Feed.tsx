import { useEffect, useRef } from 'react'
import { ACTOR_TITLE, clock, isAgent } from '../agents'
import type { AgentName, AuditEvent } from '../types'
import { ActorIcon, Alert, Arrow, Check, Shield, Wrench } from './Icons'

const HIDDEN_ARGS = new Set(['requested_by', 'drafted_by', 'updated_by'])

function argText(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([k, v]) => !HIDDEN_ARGS.has(k) && v !== null && v !== undefined && v !== '')
    .map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
    .join(', ')
}

function pretty(result?: string): string {
  if (!result) return ''
  try { return JSON.stringify(JSON.parse(result), null, 2) } catch { return result }
}

function Who({ agent }: { agent: AuditEvent['agent'] }) {
  return (
    <span className={`who agent-${agent}`}>
      <span className="who-icon"><ActorIcon actor={agent} size={14} /></span>
      {ACTOR_TITLE[agent]}
    </span>
  )
}

function Item({ e, results }: { e: AuditEvent; results: Map<string, AuditEvent> }) {
  const indent = { marginLeft: `${Math.min(e.depth, 3) * 22}px` }
  const agentClass = `agent-${e.agent}`
  switch (e.event) {
    case 'run_start':
      return e.depth === 0
        ? <div className="feed-line system" style={indent}><Who agent={e.agent} /> picked up the ticket</div>
        : <div className="feed-line muted" style={indent}><Who agent={e.agent} /> is on it</div>
    case 'model_response': {
      const calls = (e.tool_calls ?? []).filter(c => c.tool !== 'final_result' && c.tool !== 'ask_teammate')
      if (!e.text && calls.length === 0) return null
      return (
        <div className={`msg ${agentClass}`} style={indent}>
          <div className="msg-head"><Who agent={e.agent} /><time>{clock(e.timestamp)}</time></div>
          {e.text && <p className="msg-text">{e.text}</p>}
          {calls.map((c, i) => {
            const res = results.get(`${e.id}:${i}`)
            return (
              <details key={i} className="tool">
                <summary>
                  <Wrench size={13} /><code>{c.tool}</code>
                  <span className="tool-args">{argText(c.args)}</span>
                </summary>
                {res ? <pre>{pretty(res.result)}</pre> : <pre className="pending">waiting for the tool…</pre>}
              </details>
            )
          })}
        </div>
      )
    }
    case 'delegation': {
      const to = String(e.args?.teammate ?? '') as AgentName
      const refused = e.result !== 'accepted'
      return (
        <div className={`handoff ${refused ? 'refused' : ''}`} style={indent}>
          <div className="handoff-route">
            <Who agent={e.agent} /><Arrow size={14} />{isAgent(to) ? <Who agent={to} /> : to}
          </div>
          <p>{String(e.args?.request ?? '')}</p>
          {refused && <p className="refusal"><Alert size={13} /> {e.result}</p>}
        </div>
      )
    }
    case 'run_end': {
      const out = (e.output ?? {}) as { summary?: string; decision?: string; actions_taken?: string[] }
      return (
        <div className={`report ${agentClass}`} style={indent}>
          <div className="msg-head">
            <Who agent={e.agent} />
            <span className="report-tag"><Check size={12} />{e.depth === 0 ? 'Made the call' : 'Reported back'}</span>
          </div>
          <p className="msg-text">{out.decision ?? out.summary}</p>
          {(out.actions_taken ?? []).length > 0 && (
            <ul className="actions">{out.actions_taken!.map((a, i) => <li key={i}>{a}</li>)}</ul>
          )}
        </div>
      )
    }
    case 'guardrail':
      return (
        <div className="feed-line guard" style={indent}>
          <Shield size={14} /> Guardrail on <code>{e.tool}</code>: {e.result}
          {e.args && <span className="muted"> ({argText(e.args)})</span>}
        </div>
      )
    case 'tool_retry':
      return <div className="feed-line warn" style={indent}><Alert size={14} /> Retry {e.tool && <code>{e.tool}</code>}: {e.result}</div>
    case 'error':
      return <div className="feed-line danger" style={indent}><Alert size={14} /> {ACTOR_TITLE[e.agent]} stopped: {e.error}</div>
    case 'human_decision': {
      const a = e.args ?? {}
      const text = a.status === 'resolved'
        ? `marked the ticket resolved`
        : `${a.decision === 'approve' ? 'approved' : 'rejected'} request #${a.request_id}`
      return <div className="feed-line human"><Who agent="human" /> {String(a.decided_by ?? a.updated_by ?? '')} {text}</div>
    }
    default:
      return null
  }
}

interface Props {
  events: AuditEvent[]
  running: boolean
  active: AgentName | null
  empty: string
}

export function Feed({ events, running, active, empty }: Props) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (running) end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [events.length, running])

  // Pair each tool call with its result: results arrive in order, one per call, per agent.
  const results = new Map<string, AuditEvent>()
  const queue = new Map<string, string[]>()
  for (const e of events) {
    const key = `${e.agent}|${e.chain.join('>')}`
    if (e.event === 'model_response') {
      const slots = (e.tool_calls ?? []).map((_, i) => `${e.id}:${i}`)
      queue.set(key, [...(queue.get(key) ?? []), ...slots])
    } else if (e.event === 'tool_result' || e.event === 'tool_retry') {
      const slot = queue.get(key)?.shift() // a retried call answers its slot with the retry message
      if (slot) results.set(slot, e)
    }
  }

  if (events.length === 0) return <div className="feed empty"><p>{empty}</p></div>
  return (
    <div className="feed" aria-live="polite">
      {events.map(e => <Item key={e.id} e={e} results={results} />)}
      {running && active && (
        <div className={`feed-line thinking agent-${active}`}>
          <Who agent={active} /> is thinking <span className="typing"><i /><i /><i /></span>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}
