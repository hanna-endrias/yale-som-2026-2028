import { useLayoutEffect, useRef } from 'react'
import { imageUrl } from '../api'
import { useSearchResults } from '../useSearchResults'
import ProductCard from './ProductCard'

// The latest chat search, shown at the top of whatever page the shopper is on.
// Expanded: full cards (the same ProductCard as the Products page, so clicking opens the
// detail page). Collapsed: a one-line strip of thumbnails with a count.
export default function ChatResults() {
  const { results, query, searchId, expanded, setExpanded, clearResults } = useSearchResults()
  const rowRef = useRef<HTMLDivElement>(null)

  // When a new search arrives, fly its cards from the chat panel into this strip.
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row || searchId === 0) return
    const section = row.closest('.chat-results')
    // Bring the strip into view first so the cards land somewhere visible.
    if (section && section.getBoundingClientRect().top < 0) section.scrollIntoView({ block: 'start' })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const panel = document.querySelector('.chat-panel, .chat-toggle')?.getBoundingClientRect()
    if (!panel) return
    const fromX = panel.left + panel.width / 2
    const fromY = panel.top + panel.height / 2
    Array.from(row.children).forEach((card, i) => {
      const box = card.getBoundingClientRect()
      const dx = fromX - (box.left + box.width / 2)
      const dy = fromY - (box.top + box.height / 2)
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(-12deg)`, opacity: 0 },
          { opacity: 1, offset: 0.3 },
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        ],
        { duration: 650, delay: i * 70, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1.1)', fill: 'backwards' },
      )
    })
  }, [searchId])

  if (results.length === 0) return null

  const count = `${results.length} ${results.length === 1 ? 'item' : 'items'}`

  return (
    <section className="chat-results" aria-label="Products from the chat">
      <div className="chat-results-header">
        {expanded ? (
          <h2>
            From the chat: <span className="chat-results-query">"{query}"</span>
          </h2>
        ) : (
          <div className="chat-results-collapsed">
            <span className="chat-results-thumbs" aria-hidden="true">
              {results.map((p) => (
                <img key={p.product_id} src={imageUrl(p.image_file_path)} alt="" />
              ))}
            </span>
            <span>
              {count} from the chat: <span className="chat-results-query">"{query}"</span>
            </span>
          </div>
        )}
        <div className="chat-results-actions">
          <button className="link-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
            {expanded ? 'Hide cards' : 'Show cards'}
          </button>
          <button className="link-button" onClick={clearResults}>
            Clear
          </button>
        </div>
      </div>
      {expanded && (
        <div className="chat-results-row" ref={rowRef}>
          {results.map((product) => (
            <ProductCard key={product.product_id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
