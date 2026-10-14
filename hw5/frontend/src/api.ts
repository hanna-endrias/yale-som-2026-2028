import type {
  ApprovalRequest, Cash, DecisionResponse, EventsResponse, RunRecord, TicketsResponse,
} from './types'

export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${API_BASE}.`)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : `Request failed (${res.status}).`
    throw new ApiError(res.status, detail)
  }
  return body as T
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) })

export const api = {
  tickets: () => request<TicketsResponse>('/tickets'),
  events: (after: number) => request<EventsResponse>(`/events?after=${after}&limit=1000`),
  approvals: () => request<{ requests: ApprovalRequest[] }>('/approvals'),
  cash: () => request<Cash>('/cash'),
  runs: () => request<RunRecord[]>('/runs'),
  run: (ticketId: number) => post<RunRecord>(`/tickets/${ticketId}/run`),
  runStatus: (runId: string) => request<RunRecord>(`/runs/${runId}`),
  approve: (id: number, by: string) => post<DecisionResponse>(`/approvals/${id}/approve`, { decided_by: by }),
  reject: (id: number, by: string) => post<DecisionResponse>(`/approvals/${id}/reject`, { decided_by: by }),
  resolve: (ticketId: number, by: string) => post<unknown>(`/tickets/${ticketId}/resolve`, { decided_by: by }),
  reset: () => post<{ balance: number }>('/reset'),
}
