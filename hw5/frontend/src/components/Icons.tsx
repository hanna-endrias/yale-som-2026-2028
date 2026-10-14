// Small outline icons (24x24, stroke = currentColor) so the desk needs no icon library.
import type { ReactNode } from 'react'
import type { Actor } from '../types'

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

type P = { size?: number }
export const Briefcase = (p: P) => <Svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></Svg>
export const Box = (p: P) => <Svg {...p}><path d="M12 3 3 7.5v9L12 21l9-4.5v-9z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></Svg>
export const Ledger = (p: P) => <Svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Svg>
export const Building = (p: P) => <Svg {...p}><path d="M4 21V5l8-2v18M12 21h8V9l-8-2" /><path d="M8 8v.01M8 12v.01M8 16v.01M16 12v.01M16 16v.01" /></Svg>
export const Chat = (p: P) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></Svg>
export const Person = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
export const Gear = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>
export const Wrench = (p: P) => <Svg {...p}><path d="M14.5 5.5a4 4 0 0 0 5 5L12 18l-3 3-3-3 3-3 7.5-7.5a4 4 0 0 1-2-2z" /></Svg>
export const Sun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
export const Moon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>
export const Play = (p: P) => <Svg {...p}><path d="M7 4v16l13-8z" /></Svg>
export const Reset = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" /></Svg>
export const Check = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
export const Alert = (p: P) => <Svg {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.01" /></Svg>
export const Arrow = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const Shield = (p: P) => <Svg {...p}><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /></Svg>

export function ActorIcon({ actor, size }: { actor: Actor; size?: number }) {
  switch (actor) {
    case 'boss': return <Briefcase size={size} />
    case 'inventory': return <Box size={size} />
    case 'accounting': return <Ledger size={size} />
    case 'facilities': return <Building size={size} />
    case 'customer_service': return <Chat size={size} />
    case 'human': return <Person size={size} />
    default: return <Gear size={size} />
  }
}
