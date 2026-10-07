import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { fetchProducts, type Product } from '../api'
import { CATEGORIES, SORTS, categoryOf, matchesSearch, sortProducts, type SortId } from '../catalogFilters'
import ProductCard from '../components/ProductCard'

export default function Products() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Filters live in the URL (?category=hoodies&sort=price-asc&q=navy), so the back
  // button and a page refresh keep them.
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const search = params.get('q') ?? ''
  const sort = (SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'name') as SortId

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setError('Could not load products. Is the backend running?'))
  }, [])

  // Update one filter in the URL; empty / default values are removed to keep it clean.
  function setParam(key: string, value: string, defaultValue = '') {
    const next = new URLSearchParams(params)
    if (value && value !== defaultValue) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  if (error) return <p className="error">{error}</p>
  if (!products) return <p>Loading products...</p>

  // Search applies first, so each category chip's count reflects the current search.
  const searched = products.filter((p) => matchesSearch(p, search))
  const counts = new Map<string, number>()
  for (const p of searched) {
    const c = categoryOf(p)
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const shown = sortProducts(
    category ? searched.filter((p) => categoryOf(p) === category) : searched,
    sort,
  )
  const filtered = Boolean(category || search)

  return (
    <section>
      <h1>Products</h1>

      <div className="product-filters">
        <div className="category-chips" role="group" aria-label="Filter by category">
          <button className={`chip${category === '' ? ' active' : ''}`} onClick={() => setParam('category', '')}>
            All <span className="chip-count">{searched.length}</span>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`chip${category === c.id ? ' active' : ''}`}
              aria-pressed={category === c.id}
              onClick={() => setParam('category', c.id)}
            >
              {c.label} <span className="chip-count">{counts.get(c.id) ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="filter-controls">
          <input
            type="search"
            className="product-search"
            placeholder="Search products, e.g. navy, Saybrook, dad"
            aria-label="Search products"
            value={search}
            onChange={(e) => setParam('q', e.target.value)}
          />
          <label className="sort-control">
            Sort
            <select value={sort} onChange={(e) => setParam('sort', e.target.value, 'name')}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="result-count">
        {shown.length} of {products.length} products
        {filtered && (
          <>
            {' · '}
            <button className="link-button" onClick={() => setParams(sort === 'name' ? {} : { sort }, { replace: true })}>
              Clear filters
            </button>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <p>No products match. Try another search or category.</p>
      ) : (
        <div className="product-grid">
          {shown.map((product) => (
            <ProductCard key={product.product_id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
