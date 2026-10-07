import { useEffect, useRef, useState, type FormEvent } from 'react'
import { matchPath, useLocation } from 'react-router'
import { fetchChatHistory, sendChatMessage, type ProductSummary } from '../api'
import { useAuth } from '../useAuth'
import { useSearchResults } from '../useSearchResults'
import Bulldog, { type BulldogMood } from './Bulldog'
import ProductCard from './ProductCard'

interface Message {
  role: 'user' | 'assistant' | 'error'
  text: string
  // Product matches from a catalogue search, shown as cards under the reply.
  products?: ProductSummary[]
}

function greeting(firstName?: string): Message {
  return { role: 'assistant', text: `Hi${firstName ? ` ${firstName}` : ''}! Ask me about Campus Customs merch.` }
}

// The agent marks key details like **$32** in bold. Render just that one piece of
// Markdown, as React elements (no raw HTML), and leave everything else as plain text.
function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

// App.tsx gives this component a new key when the user logs in or out, so each
// user starts with their own messages.
export default function ChatPanel() {
  const { user } = useAuth()
  const { showResults } = useSearchResults()
  // The product page the shopper is on, sent with each message so "this" works.
  const productId = matchPath('/products/:productId', useLocation().pathname)?.params.productId
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([greeting(user?.first_name)])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mood, setMood] = useState<BulldogMood>('idle')
  const moodTimer = useRef<number | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(moodTimer.current)
    }
  }, [])

  // Logged-in shoppers: reload their saved conversation (guests have none).
  useEffect(() => {
    if (!user) return
    // Ignore a response that arrives after this effect was cleaned up (React runs effects
    // twice in development), so history is only added once.
    let cancelled = false
    fetchChatHistory(user.id)
      .then(({ messages: saved }) => {
        if (cancelled) return
        const restored: Message[] = saved.map((m) => ({ role: m.role, text: m.content, products: m.products }))
        // Keep the greeting first and anything typed while history was loading last.
        // Only the chat messages change here; the page's search results are left alone.
        setMessages((prev) => [prev[0], ...restored, ...prev.slice(1)])
      })
      .catch(() => {
        // Not fatal: the chat still works, just without the earlier messages.
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, sending, open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setSending(true)
    window.clearTimeout(moodTimer.current)
    setMood('thinking')
    let nextMood: BulldogMood = 'idle'
    try {
      const { reply, products, found_nothing } = await sendChatMessage(text, user?.id, productId)
      // Logged out (or switched user) while waiting: this reply belongs to the old session.
      if (!mounted.current) return
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, products }])
      // Search matches also go to the page. Replies without cards (e.g. a price
      // follow-up) leave the current page results in place.
      if (products.length > 0) showResults(products, text)
      nextMood = products.length > 0 ? 'happy' : found_nothing ? 'sad' : 'idle'
    } catch (err) {
      if (!mounted.current) return
      setMessages((prev) => [...prev, { role: 'error', text: (err as Error).message }])
      nextMood = 'sad'
    } finally {
      if (mounted.current) {
        setSending(false)
        setMood(nextMood)
      // Happy/sad faces last a few seconds, then the bulldog relaxes.
        if (nextMood !== 'idle') moodTimer.current = window.setTimeout(() => setMood('idle'), 4000)
      }
    }
  }

  if (!open) {
    return (
      <button className="chat-toggle" onClick={() => setOpen(true)}>
        <Bulldog mood={mood} size={30} />
        Chat with us
      </button>
    )
  }

  return (
    <aside className="chat-panel" aria-label="Chat">
      <div className="chat-header">
        <span className="chat-title">
          <Bulldog mood={mood} size={38} />
          Campus Customs Assistant
        </span>
        <button onClick={() => setOpen(false)} aria-label="Close chat">
          ×
        </button>
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`chat-message ${m.role}`}>
              {m.role === 'assistant' ? renderBold(m.text) : m.text}
            </div>
            {m.products && m.products.length > 0 && (
              <div className="chat-products">
                {m.products.map((p) => (
                  <ProductCard key={p.product_id} product={p} />
                ))}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="chat-message assistant typing" aria-label="The assistant is typing">
            <span className="typing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="typing-hint">Sniffing through the catalogue…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          autoFocus
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </aside>
  )
}
