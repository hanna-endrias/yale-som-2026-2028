import { Route, Routes } from 'react-router'
import NavBar from './components/NavBar'
import ChatPanel from './components/ChatPanel'
import ChatResults from './components/ChatResults'
import PawTrail from './components/PawTrail'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductPage from './pages/ProductPage'
import About from './pages/About'
import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import NotFound from './pages/NotFound'
import { useAuth } from './useAuth'

export default function App() {
  const { user } = useAuth()

  return (
    <>
      <PawTrail />
      <NavBar />
      <main className="page">
        <ChatResults />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {/* Keyed by user so logging in/out starts a fresh chat (and loads that user's history). */}
      <ChatPanel key={user?.id ?? 'guest'} />
    </>
  )
}
