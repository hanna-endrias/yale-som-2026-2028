// The backend runs as a separate server, so every request goes to its URL.
// Override with VITE_API_URL in frontend/.env.local if the backend moves.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface Product {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  image_file_path: string
  price: number
}

// The fields a product card needs. Products from /api/products and product matches in
// a chat reply both have these, so both render with the same ProductCard.
export type ProductSummary = Pick<Product, 'product_id' | 'name' | 'price' | 'description' | 'image_file_path'>

export interface SizeStock {
  size: string
  quantity: number
}

export interface ProductDetail extends Product {
  sizes: SizeStock[]
}

// image_file_path is relative (e.g. "products/<name>.jpg"); the backend serves it at the same path.
export function imageUrl(imageFilePath: string): string {
  return `${API_URL}/${imageFilePath}`
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Not found' : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export function fetchProducts(): Promise<Product[]> {
  return getJson<Product[]>('/api/products')
}

export function fetchProduct(productId: string): Promise<ProductDetail> {
  return getJson<ProductDetail>(`/api/products/${encodeURIComponent(productId)}`)
}

// ---------- Accounts ----------

export interface User {
  id: number
  first_name: string
  last_name: string
  name: string
  email: string
}

export interface RegisterInput {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password: string
}

// FastAPI errors are either {detail: "message"} or, for validation errors,
// {detail: [{msg: "Value error, message", ...}]}.
function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') {
    return detail[0].msg.replace(/^Value error, /, '')
  }
  return `Request failed (${status})`
}

async function postJson<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new Error(errorMessage(body, res.status))
  return body as T
}

export function registerUser(input: RegisterInput): Promise<User> {
  return postJson<User>('/api/register', input)
}

export function loginUser(email: string, password: string): Promise<User> {
  return postJson<User>('/api/login', { email, password })
}

// ---------- Chat ----------

export interface ChatResponse {
  reply: string
  products: ProductSummary[]
  found_nothing: boolean // a lookup/search came back empty (the mascot looks sad)
}

// userId: the logged-in shopper (omit for guests). productId: the product page they're on.
export function sendChatMessage(message: string, userId?: number, productId?: string): Promise<ChatResponse> {
  return postJson<ChatResponse>('/chat', { message, user_id: userId ?? null, product_id: productId ?? null })
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  products: ProductSummary[]
}

export function fetchChatHistory(userId: number): Promise<{ messages: HistoryMessage[] }> {
  return getJson<{ messages: HistoryMessage[] }>(`/chat/history?user_id=${userId}`)
}
