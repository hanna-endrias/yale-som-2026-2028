import { useEffect, useRef, useState } from 'react'
import { AGENTS } from '../agents'
import type { StageState } from '../runView'
import { ActorIcon, Check } from './Icons'

const ARC_SPACE = 58 // px above the avatars where delegation arcs are drawn

/** The five agents in a row. Whoever is working glows; arcs show who asked whom. */
export function AgentStage({ state, running }: { state: StageState; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const centerX = (i: number) => ((i + 0.5) * width) / AGENTS.length
  const indexOf = (id: string) => AGENTS.findIndex(a => a.id === id)
  const seen = new Set<string>()
  const edges = state.edges.filter(e => {
    const key = `${e.from}>${e.to}`
    if (seen.has(key) || e.refused) return false
    seen.add(key)
    return true
  })

  return (
    <section className="panel stage" aria-label="Agent team">
      <div className="stage-inner" ref={ref}>
        <svg className="arcs" width={width} height={ARC_SPACE} aria-hidden="true">
          <defs>
            <marker id="arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M1 1 L8 5 L1 9" fill="none" stroke="context-stroke" strokeWidth="1.6" />
            </marker>
          </defs>
          {width > 0 && edges.map(e => {
            const x1 = centerX(indexOf(e.from))
            const x2 = centerX(indexOf(e.to))
            const lift = Math.min(ARC_SPACE - 6, 16 + Math.abs(x2 - x1) * 0.12)
            const live = running && (state.active === e.to || state.active === e.from)
            return (
              <path key={`${e.from}-${e.to}`} className={`arc agent-${e.from} ${live ? 'live' : ''}`}
                    d={`M ${x1} ${ARC_SPACE} Q ${(x1 + x2) / 2} ${ARC_SPACE - lift * 2} ${x2} ${ARC_SPACE}`}
                    markerEnd="url(#arrowhead)" />
            )
          })}
        </svg>
        <ol className="agents">
          {AGENTS.map(a => {
            const active = state.active === a.id
            const done = state.done.has(a.id)
            const involved = state.started.has(a.id)
            const mode = active ? 'active' : done ? 'done' : involved ? 'waiting' : 'idle'
            return (
              <li key={a.id} className={`agent agent-${a.id} ${mode}`}>
                <div className="avatar">
                  <ActorIcon actor={a.id} size={22} />
                  {done && !active && <span className="badge-done"><Check size={11} /></span>}
                </div>
                <div className="agent-name">{a.title}</div>
                <div className="agent-role">
                  {active ? <span className="typing" aria-label="working"><i /><i /><i /></span>
                    : mode === 'waiting' ? 'Waiting on a teammate'
                    : done ? 'Reported back' : a.role}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
