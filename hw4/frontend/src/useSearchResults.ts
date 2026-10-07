import { createContext, useContext } from 'react'
import type { ProductSummary } from './api'

// Product matches from the latest chat search, shown on the page (not just in the chat).
// Lives above both the chat and the pages, so reloading chat history or logging in/out
// never clears it.
export interface SearchResultsValue {
  results: ProductSummary[]
  query: string
  // Goes up by one for every new search, so the page can animate new results in.
  searchId: number
  // Cards shown (true) or collapsed to a thumbnail strip (false). Every new search
  // starts expanded.
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  showResults: (products: ProductSummary[], query: string) => void
  clearResults: () => void
}

export const SearchResultsContext = createContext<SearchResultsValue | null>(null)

export function useSearchResults(): SearchResultsValue {
  const ctx = useContext(SearchResultsContext)
  if (!ctx) throw new Error('useSearchResults must be used inside SearchResultsProvider')
  return ctx
}
