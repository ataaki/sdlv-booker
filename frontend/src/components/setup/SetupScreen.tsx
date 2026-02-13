import { useState } from 'react'
import { api } from '../../api/client'
import Button from '../ui/Button'

interface SetupScreenProps {
  onSuccess: () => void
}

export default function SetupScreen({ onSuccess }: SetupScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await api.put('/credentials', { email, password })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-5 relative overflow-hidden max-sm:items-end max-sm:p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_300px_at_80%_20%,rgba(56,189,248,0.12),transparent_70%),radial-gradient(ellipse_400px_200px_at_20%_80%,rgba(16,185,129,0.08),transparent_70%)] pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl max-sm:rounded-b-none p-9 max-w-md w-full shadow-2xl animate-[modalIn_0.4s_ease-out] max-sm:p-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            ⚽
          </div>
          <h1 className="text-[22px] font-bold text-slate-900">Foot Du Lundi</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Connectez-vous avec vos identifiants DoInSport pour commencer.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            autoComplete="email"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe DoInSport"
            autoComplete="current-password"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-3.5 py-2.5 rounded-lg text-sm mb-3">{error}</div>
        )}

        <Button variant="primary" type="submit" loading={loading} className="w-full mt-2 min-h-11 text-base">
          Connexion
        </Button>
      </form>
    </div>
  )
}
