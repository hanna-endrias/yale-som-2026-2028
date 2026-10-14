import { shopDate } from '../agents'
import type { Theme } from '../hooks'
import { Moon, Reset, Sun } from './Icons'

interface Props {
  today: string | null
  approver: string
  onApprover: (name: string) => void
  approverError: boolean
  theme: Theme
  onToggleTheme: () => void
  onReset: () => void
  resetDisabled: boolean
}

export function Header({ today, approver, onApprover, approverError, theme, onToggleTheme, onReset, resetDisabled }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">CC</span>
        <div>
          <div className="brand-name">Campus Customs</div>
          <div className="brand-sub">Agent desk{today && <> · shop date {shopDate(today)}</>}</div>
        </div>
      </div>
      <div className="topbar-tools">
        <label className={`approver ${approverError ? 'error' : ''}`}>
          <span>Approving as</span>
          <input value={approver} onChange={e => onApprover(e.target.value)} placeholder="Your name"
                 aria-invalid={approverError} />
        </label>
        <button className="btn ghost" onClick={onReset} disabled={resetDisabled}
                title="Copy the original database over the working copy">
          <Reset size={15} /> Reset shop
        </button>
        <button className="btn icon" onClick={onToggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
    </header>
  )
}
