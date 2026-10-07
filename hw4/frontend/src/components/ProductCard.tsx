import { Link } from 'react-router'
import { formatPrice, imageUrl, type ProductSummary } from '../api'

// Used by the Products page and by chat replies; clicking opens /products/:productId.
export default function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link to={`/products/${product.product_id}`} className="product-card">
      <img src={imageUrl(product.image_file_path)} alt={product.name} loading="lazy" />
      <div className="product-card-body">
        <h3>{product.name}</h3>
        <p className="price">{formatPrice(product.price)}</p>
        {/* Full description, visually clamped by CSS (the text itself is not cut). */}
        <p className="clamp">{product.description}</p>
      </div>
    </Link>
  )
}
