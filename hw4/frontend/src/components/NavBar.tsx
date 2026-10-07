import { Link, NavLink } from 'react-router'
import { useAuth } from '../useAuth'

const links = [
  { to: '/', label: 'Home' },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About Us' },
]

const loggedOutLinks = [
  { to: '/login', label: 'Log in' },
  { to: '/create-account', label: 'Create Account' },
]

export default function NavBar() {
  const { user, logout } = useAuth()

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Campus Customs
      </Link>
      <nav>
        {links.map((link) => (
          // `end` keeps Home from being highlighted on every page.
          <NavLink key={link.to} to={link.to} end={link.to === '/'}>
            {link.label}
          </NavLink>
        ))}
        {user ? (
          <>
            <span>Hi, {user.first_name || user.name}</span>
            <button className="link-button" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          loggedOutLinks.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))
        )}
      </nav>
    </header>
  )
}
