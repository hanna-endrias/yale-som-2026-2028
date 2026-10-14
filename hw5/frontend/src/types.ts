// Shapes returned by the FastAPI backend (backend/main.py).

export type AgentName = 'boss' | 'inventory' | 'accounting' | 'facilities' | 'customer_service'
export type Actor = AgentName | 'human' | 'system'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_approval' | 'needs_human' | 'resolved'

export interface Ticket {
  id: number
  type: string
  requester: string
  subject: string
  sku: string | null
  size: string | null
  qty: number | null
  status: TicketStatus
  created_at: string
  is_open: boolean
  pending_approvals: number
  drafts: number
}

export interface TicketsResponse {
  today: string
  tickets: Ticket[]
}

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
}

export interface AuditEvent {
  id: number
  summary: string
  timestamp: string
  run_id: string
  ticket_id: number | null
  agent: Actor
  chain: AgentName[]
  depth: number
  step: number
  event: string
  model?: string
  tool?: string
  args?: Record<string, unknown>
  result?: string
  text?: string
  tool_calls?: ToolCall[]
  usage?: { input_tokens: number; output_tokens: number }
  output?: Record<string, unknown>
  error?: string
}

export interface EventsResponse {
  latest_id: number
  events: AuditEvent[]
}

export type ApprovalKind = 'invoice' | 'rent' | 'purchase_order'

export interface ApprovalRequest {
  id: number
  kind: ApprovalKind
  ticket_id: number | null
  ref_id: number
  sku: string | null
  size: string | null
  qty: number | null
  amount: number
  account: string
  reason: string | null
  requested_by: string
  shop_date: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  payment_id: number | null
}

export interface OpenInvoice {
  id: number
  vendor_id: number
  vendor_name: string
  amount: number
  due_date: string
  days_overdue: number
  payment_requested: boolean
}

export interface Payment {
  id: number
  kind: string
  ref_id: number
  amount: number
  account: string
  paid_at: string
  approved_by: string
}

export interface Cash {
  account: string
  balance: number
  as_of: string
  today: string
  pending_total: number
  available_for_new_orders: number
  rent_reserve: number
  unpaid_invoices_not_requested: number
  open_invoices: OpenInvoice[]
  payments_made: Payment[]
}

export interface Assignment {
  agent: AgentName
  task: string
  outcome: string
}

export interface TicketDecision {
  ticket_id: number
  ticket_type: string
  final_status: TicketStatus
  decision: string
  rationale: string
  assignments: Assignment[]
  discount?: {
    sku: string
    qty: number
    list_price: number
    discount_pct: number
    unit_price: number
    order_total: number
  } | null
  approval_request_ids: number[]
  draft_ids: number[]
  human_actions_needed: string[]
  inferences: string[]
}

export interface RunRecord {
  run_id: string
  ticket_id: number
  status: 'running' | 'done' | 'error'
  started_at: string
  finished_at: string | null
  decision: TicketDecision | null
  error: string | null
}

export interface DecisionResponse {
  result: { amount?: number; new_balance?: number; status: string }
  balance: number
  ticket_id: number | null
  ticket_resolved: boolean
}
