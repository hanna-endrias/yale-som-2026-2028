import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchChatHistory, fetchProduct, type ProductSummary } from '../api'
import ProductCard from '../components/ProductCard'
import { getRecentlyViewed } from '../recentlyViewed'
import { useAuth } from '../useAuth'

// A product the shopper seemed interested in: the last product page they opened, or,
// failing that, the first card from the latest chat reply that had cards.
async function findInterest(userId: number): Promise<ProductSummary | null> {
  const recent = getRecentlyViewed(userId)[0]
  if (recent) {
    try {
      return await fetchProduct(recent)
    } catch {
      // Product gone or backend down: fall back to chat history.
    }
  }
  const { messages } = await fetchChatHistory(userId)
  const lastWithCards = [...messages].reverse().find((m) => m.role === 'assistant' && m.products.length > 0)
  return lastWithCards?.products[0] ?? null
}

function WelcomeBack() {
  const { user } = useAuth()
  // Tagged with the user it was found for, so a different user who logs in on this
  // computer never sees the previous shopper's product, even for a moment.
  const [found, setFound] = useState<{ userId: number; product: ProductSummary | null } | null>(null)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    findInterest(userId)
      .then((product) => {
        if (!cancelled) setFound({ userId, product })
      })
      .catch(() => {
        // Not fatal: Home just shows without the welcome-back card.
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Logged-in shoppers only: guests (and anyone who just logged out) see no greeting
  // and nothing about earlier browsing.
  if (!user) return null
  const interest = found?.userId === user.id ? found.product : null

  return (
    <section className="welcome-back island">
      <div>
        <h2>
          Welcome back, <span className="sticker">{user.first_name || user.name}!</span>
        </h2>
        <p>{interest ? 'Still thinking about this one?' : 'Ask the bulldog in the corner for help finding something.'}</p>
      </div>
      {interest && (
        <div className="welcome-back-card">
          <ProductCard product={interest} />
        </div>
      )}
    </section>
  )
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>
          Don't be blue, <span className="sticker">just buy blue!</span>
        </h1>
        <p>Your one-stop shop for all things Yale, from hoodies to game-day gear to the perfect gift for Mom.</p>
        <Link to="/products" className="button">
          Shop now
        </Link>
      </section>
      <WelcomeBack />
    </>
  )
}
