import { useEffect, useState } from 'react'
import App from '../App'
import Login from './Login'

export default function AuthGate() {
  const [status, setStatus] = useState('checking') // checking | authenticated | unauthenticated

  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => setStatus(data.authenticated ? 'authenticated' : 'unauthenticated'))
      .catch(() => setStatus('unauthenticated'))
  }, [])

  if (status === 'checking') {
    return (
      <div className="center-state">
        <div className="spinner" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Login onSuccess={() => setStatus('authenticated')} />
  }

  return <App />
}
