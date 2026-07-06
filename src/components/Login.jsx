import { useState } from 'react'

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!password || loading) return

    setLoading(true)
    setError(null)

    let res
    try {
      res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    } catch {
      setError('No se pudo conectar con el servidor.')
      setLoading(false)
      return
    }

    const data = await res.json()
    if (res.ok && data.ok) {
      onSuccess()
      return
    }

    setError(data.error || 'Clave incorrecta.')
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <img
          className="login-logo"
          src="https://rnpfthuoxyvuozcqpjlj.supabase.co/storage/v1/object/public/Brand%20Platam/logo_platam_conf_dark.png"
          alt="Platam Confirming"
        />
        <p className="login-subtitle">Acceso al dashboard</p>

        <input
          type="password"
          className="login-input"
          placeholder="Clave de acceso"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />

        {error && <p className="error-message">{error}</p>}

        <button type="submit" className="btn-primary login-submit" disabled={loading || !password}>
          {loading ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
