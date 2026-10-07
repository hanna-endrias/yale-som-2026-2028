import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { registerUser, type RegisterInput } from '../api'

// Must match PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH in backend/main.py.
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

const emptyForm: RegisterInput = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirm_password: '',
}

export default function CreateAccount() {
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterInput>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof RegisterInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    // Checked here for instant feedback; the backend checks again.
    if (form.password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      return
    }
    if (form.password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
      return
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const user = await registerUser(form)
      navigate('/login', { state: { email: user.email, message: 'Account created! Please log in.' } })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="form-page">
      <h1>Create Account</h1>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          First name
          <input
            type="text"
            name="first_name"
            autoComplete="given-name"
            required
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            name="last_name"
            autoComplete="family-name"
            required
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
          <span className="hint">At least {PASSWORD_MIN_LENGTH} characters. Passphrases welcome.</span>
        </label>
        <label>
          Confirm password
          <input
            type="password"
            name="confirm_password"
            autoComplete="new-password"
            required
            value={form.confirm_password}
            onChange={(e) => update('confirm_password', e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  )
}
