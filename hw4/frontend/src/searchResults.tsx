import { useState, type ReactNode } from 'react'
import type { ProductSummary } from './api'
import { useAuth } from './useAuth'
import { SearchResultsContext } from './useSearchResults'

export function SearchResultsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [results, setResults] = useState<ProductSummary[]>([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [searchId, setSearchId] = useState(0)

  // Logging out (in this tab or another) clears the page results, so the next person
  // on this computer doesn't see the previous shopper's search. Logging in keeps them,
  // so a guest's fresh search survives signing in. (Adjusting state during render when
  // the user changes is React's recommended alternative to an effect here.)
  const [prevUserId, setPrevUserId] = useState(user?.id)
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id)
    if (prevUserId !== undefined && !user) {
      setResults([])
      setQuery('')
    }
  }

  function showResults(products: ProductSummary[], newQuery: string) {
    setResults(products)
    setQuery(newQuery)
    setExpanded(true) // new results always arrive expanded
    setSearchId((n) => n + 1)
  }

  function clearResults() {
    setResults([])
    setQuery('')
  }

  return (
    <SearchResultsContext.Provider value={{ results, query, searchId, expanded, setExpanded, showResults, clearResults }}>
      {children}
    </SearchResultsContext.Provider>
  )
}
