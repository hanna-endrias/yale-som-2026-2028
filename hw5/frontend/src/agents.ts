import type { Actor, AgentName, ApprovalKind, TicketStatus } from './types'

export interface AgentInfo {
  id: AgentName
  title: string
  role: string
}

// Left-to-right order on the stage: the Boss first, then the specialists.
export const AGENTS: AgentInfo[] = [
  { id: 'boss', title: 'Boss', role: 'Routes tickets, makes the call' },
  { id: 'inventory', title: 'Inventory', role: 'Stock, sizes, restocks' },
  { id: 'accounting', title: 'Accounting', role: 'Cash, invoices, approvals' },
  { id: 'facilities', title: 'Facilities', role: 'Lease and rent' },
  { id: 'customer_service', title: 'Customer Service', role: 'Drafts to customers' },
]

export const ACTOR_TITLE: Record<Actor, string> = {
  boss: 'Boss',
  inventory: 'Inventory',
  accounting: 'Accounting',
  facilities: 'Facilities',
  customer_service: 'Customer Service',
  human: 'You',
  system: 'System',
}

export const isAgent = (actor: string): actor is AgentName => AGENTS.some(a => a.id === actor)

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'Agents working',
  waiting_on_approval: 'Waiting on you',
  needs_human: 'Needs you',
  resolved: 'Resolved',
}

export const TICKET_TYPE_LABEL: Record<string, string> = {
  customer_order: 'Customer order',
  rent_notice: 'Rent notice',
  price_override: 'Discount request',
}

export const KIND_LABEL: Record<ApprovalKind, string> = {
  invoice: 'Vendor invoice',
  rent: 'Rent',
  purchase_order: 'Purchase order',
}

export const money = (n: number, cents = false) =>
  n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
  })

export const shopDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
