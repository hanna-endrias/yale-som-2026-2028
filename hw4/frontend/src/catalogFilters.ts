import type { Product } from './api'

// Shop categories, derived from each product's garment_type. Checked in order, so
// "crewneck sweatshirt" is a crewneck (not a shirt) and "hooded sweatshirt" is a hoodie.
export const CATEGORIES = [
  { id: 'hoodies', label: 'Hoodies', test: (g: string) => g.includes('hood') },
  { id: 'quarter-zips', label: 'Quarter zips', test: (g: string) => g.includes('quarter-zip') },
  { id: 'crewnecks', label: 'Crewnecks', test: (g: string) => g.includes('crewneck') || g.includes('mockneck') },
  { id: 'tees', label: 'Tees and long sleeves', test: (g: string) => g.includes('shirt') },
  { id: 'jackets', label: 'Jackets and fleece', test: (g: string) => g.includes('jacket') },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export function categoryOf(product: Product): CategoryId | null {
  const garment = product.garment_type.toLowerCase()
  return CATEGORIES.find((c) => c.test(garment))?.id ?? null
}

export const SORTS = [
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
] as const

export type SortId = (typeof SORTS)[number]['id']

// Every typed word must appear somewhere in the product's name, type, colors, or description.
export function matchesSearch(product: Product, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = [product.name, product.garment_type, product.colors.join(' '), product.description]
    .join(' ')
    .toLowerCase()
  return words.every((w) => text.includes(w))
}

export function sortProducts(products: Product[], sort: SortId): Product[] {
  const sorted = [...products]
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
  else sorted.sort((a, b) => a.name.localeCompare(b.name))
  return sorted
}
