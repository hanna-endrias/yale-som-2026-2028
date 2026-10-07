import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { fetchProduct, formatPrice, imageUrl, type ProductDetail } from '../api'
import { addRecentlyViewed } from '../recentlyViewed'
import { useAuth } from '../useAuth'

export default function ProductPage() {
  const { productId } = useParams()
  const userId = useAuth().user?.id
  // Results are tagged with the id they belong to, so navigating to another
  // product shows "Loading" instead of the previous product's data.
  const [result, setResult] = useState<{ id: string; product?: ProductDetail; error?: string } | null>(null)

  useEffect(() => {
    if (!productId) return
    fetchProduct(productId)
      .then((product) => {
        setResult({ id: productId, product })
        if (userId !== undefined) addRecentlyViewed(product.product_id, userId) // for Home's "Still thinking about…?"
      })
      .catch((err: Error) =>
        setResult({
          id: productId,
          error: err.message === 'Not found' ? 'Product not found.' : 'Could not load this product. Is the backend running?',
        }),
      )
  }, [productId, userId])

  const current = result?.id === productId ? result : null
  const product = current?.product
  const error = current?.error

  if (error) {
    return (
      <section>
        <p className="error">{error}</p>
        <Link to="/products">Back to products</Link>
      </section>
    )
  }
  if (!product) return <p>Loading product...</p>

  return (
    <section>
      <Link to="/products">&larr; Back to products</Link>
      <div className="product-detail">
        <img src={imageUrl(product.image_file_path)} alt={product.name} />
        <div>
          <h1>{product.name}</h1>
          <p className="price">{formatPrice(product.price)}</p>
          <p className="garment-type">{product.garment_type}</p>
          <p>{product.description}</p>

          {/* A few catalogue rows have no colors listed; show the line only when there are some. */}
          {product.colors.length > 0 && (
            <p>
              <strong>Colors:</strong> {product.colors.join(', ')}
            </p>
          )}

          <h2>Sizes &amp; stock</h2>
          {product.sizes.length === 0 ? (
            <p>No size information available.</p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>In stock</th>
                </tr>
              </thead>
              <tbody>
                {product.sizes.map((s) => (
                  <tr key={s.size} className={s.quantity === 0 ? 'sold-out' : undefined}>
                    <td>{s.size}</td>
                    <td>{s.quantity === 0 ? 'Sold out' : s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
