import { useState, useEffect, useCallback } from 'react'
import { api } from './api/client'
import { useDashboard } from './hooks/use-dashboard'
import { useBookings } from './hooks/use-bookings'
import { useRules } from './hooks/use-rules'
import { useSlots } from './hooks/use-slots'
import { useToast } from './hooks/use-toast'
import type { Rule, Slot, DashboardConfig } from './types'
import Spinner from './components/ui/Spinner'
import ToastContainer from './components/ui/Toast'
import ConfirmDialog from './components/ui/ConfirmDialog'
import Button from './components/ui/Button'
import Header from './components/layout/Header'
import StatsBar from './components/layout/StatsBar'
import RuleCard from './components/rules/RuleCard'
import RuleForm from './components/rules/RuleForm'
import BookingsList from './components/bookings/BookingsList'
import SlotSearch from './components/manual/SlotSearch'
import SlotResults from './components/manual/SlotResults'
import LogsTable from './components/logs/LogsTable'
import SetupScreen from './components/setup/SetupScreen'

type CredentialsStatus = { configured: boolean; email?: string }

export default function App() {
  // --- Credentials check ---
  const [credentialsChecked, setCredentialsChecked] = useState(false)
  const [credentialsConfigured, setCredentialsConfigured] = useState(false)
  const [credentialsEmail, setCredentialsEmail] = useState('')

  // --- Hooks ---
  const { toast } = useToast()
  const dashboard = useDashboard()
  const bookings = useBookings()
  const rules = useRules()
  const slotsHook = useSlots()

  // --- UI state ---
  const [ruleFormOpen, setRuleFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<Rule | null>(null)
  const [deleteRuleLoading, setDeleteRuleLoading] = useState(false)
  const [bookNowRuleId, setBookNowRuleId] = useState<number | null>(null)
  const [cancelBookingTarget, setCancelBookingTarget] = useState<{
    id: string; date: string; time: string; playground: string
  } | null>(null)
  const [cancelBookingLoading, setCancelBookingLoading] = useState(false)
  const [advanceDaysDialogOpen, setAdvanceDaysDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsTimezone, setSettingsTimezone] = useState('Europe/Paris')
  const [settingsTelegramToken, setSettingsTelegramToken] = useState('')
  const [settingsTelegramChatId, setSettingsTelegramChatId] = useState('')
  const [telegramTesting, setTelegramTesting] = useState(false)
  const [slotSearchDate, setSlotSearchDate] = useState('')

  // --- Check credentials on mount ---
  useEffect(() => {
    async function check() {
      try {
        const result = await api.get<CredentialsStatus>('/credentials/status')
        setCredentialsConfigured(result.configured)
        if (result.email) setCredentialsEmail(result.email)
      } catch {
        setCredentialsConfigured(false)
      } finally {
        setCredentialsChecked(true)
      }
    }
    check()
  }, [])

  // --- Auto-load bookings when dashboard loads ---
  useEffect(() => {
    if (dashboard.data) {
      bookings.load('upcoming', 1)
    }
    // Only run when dashboard.data first becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.data !== null])

  // --- Rule handlers ---
  const handleOpenNewRule = useCallback(() => {
    setEditingRule(null)
    setRuleFormOpen(true)
  }, [])

  const handleEditRule = useCallback((id: number) => {
    const rule = dashboard.data?.rules.find((r) => r.id === id)
    if (rule) {
      setEditingRule(rule)
      setRuleFormOpen(true)
    }
  }, [dashboard.data])

  const handleSaveRule = useCallback(async (data: {
    day_of_week: number; target_time: string; trigger_time: string; duration: number; playground_order: string[] | null
  }) => {
    try {
      if (editingRule) {
        await rules.updateRule(editingRule.id, data)
        toast('success', 'Règle modifiée')
      } else {
        await rules.createRule(data)
        toast('success', 'Règle créée')
      }
      await dashboard.refresh()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
      throw err
    }
  }, [editingRule, rules, dashboard, toast])

  const handleToggleRule = useCallback(async (id: number, enabled: boolean) => {
    try {
      await rules.toggleRule(id, enabled)
      toast('success', enabled ? 'Règle activée' : 'Règle désactivée')
      await dashboard.refresh()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [rules, dashboard, toast])

  const handleDeleteRuleConfirm = useCallback(async () => {
    if (!deleteRuleTarget) return
    setDeleteRuleLoading(true)
    try {
      await rules.deleteRule(deleteRuleTarget.id)
      toast('success', 'Règle supprimée')
      setDeleteRuleTarget(null)
      await dashboard.refresh()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setDeleteRuleLoading(false)
    }
  }, [deleteRuleTarget, rules, dashboard, toast])

  const handleBookNow = useCallback(async (ruleId: number, date: string) => {
    setBookNowRuleId(ruleId)
    try {
      const result = await rules.bookNow(ruleId, date)
      if (result.status === 'success') {
        toast('success', 'Réservation réussie', `${result.booked_time || ''} - ${result.playground || ''}`)
        await dashboard.refresh()
        await bookings.load('upcoming', 1)
      } else {
        toast('warning', 'Réservation non aboutie', result.error_message || result.error || result.status)
      }
    } catch (err) {
      toast('error', 'Erreur de réservation', err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setBookNowRuleId(null)
    }
  }, [rules, dashboard, bookings, toast])

  // --- Cancel booking ---
  const handleCancelBookingRequest = useCallback((id: string, date: string, time: string, playground: string) => {
    setCancelBookingTarget({ id, date, time, playground })
  }, [])

  const handleCancelBookingConfirm = useCallback(async () => {
    if (!cancelBookingTarget) return
    setCancelBookingLoading(true)
    try {
      const params = new URLSearchParams({
        date: cancelBookingTarget.date,
        time: cancelBookingTarget.time,
        playground: cancelBookingTarget.playground,
      })
      const result = await api.delete<{ success: boolean; error?: string }>(
        `/bookings/${cancelBookingTarget.id}?${params}`
      )
      if (result.success) {
        toast('success', 'Réservation annulée')
        setCancelBookingTarget(null)
        await bookings.load('upcoming', 1)
        await dashboard.refresh()
      } else {
        toast('error', 'Erreur', result.error || 'Annulation échouée')
      }
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setCancelBookingLoading(false)
    }
  }, [cancelBookingTarget, bookings, dashboard, toast])

  // --- Slot search & book ---
  const handleSlotSearch = useCallback((params: { date: string; from: string; to: string; duration?: number }) => {
    setSlotSearchDate(params.date)
    slotsHook.search(params)
  }, [slotsHook])

  const handleBookSlot = useCallback(async (slot: Slot) => {
    try {
      const result = await slotsHook.bookSlot({
        date: slotSearchDate,
        startTime: slot.startAt,
        duration: slot.duration,
        playgroundName: slot.playground.name,
      })
      if (result.status === 'success') {
        toast('success', 'Réservation réussie', `${slot.startAt} - ${slot.playground.name}`)
        await bookings.load('upcoming', 1)
        await dashboard.refresh()
      } else {
        toast('warning', 'Réservation non aboutie', result.error_message || result.error || result.status)
      }
    } catch (err) {
      toast('error', 'Erreur de réservation', err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [slotsHook, slotSearchDate, bookings, dashboard, toast])

  // --- Logs ---
  const handleDeleteLogs = useCallback(async (ids: number[]) => {
    try {
      await api.delete('/logs', { ids })
      toast('success', `${ids.length} log${ids.length > 1 ? 's' : ''} supprimé${ids.length > 1 ? 's' : ''}`)
      await dashboard.refresh()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [dashboard, toast])

  // --- Settings ---
  const handleOpenSettings = useCallback(async () => {
    setSettingsEmail(credentialsEmail)
    setSettingsPassword('')
    setSettingsTelegramToken('')
    setSettingsOpen(true)
    try {
      const settings = await api.get<{
        timezone: string
        telegram_bot_token: string
        telegram_chat_id: string
      }>('/settings')
      setSettingsTimezone(settings.timezone || 'Europe/Paris')
      setSettingsTelegramChatId(settings.telegram_chat_id || '')
    } catch {
      // ignore — fields stay empty
    }
  }, [credentialsEmail])

  const handleSaveSettings = useCallback(async () => {
    setSettingsSaving(true)
    try {
      if (settingsPassword) {
        if (!settingsEmail) {
          toast('error', 'Erreur', 'Email requis avec le mot de passe.')
          setSettingsSaving(false)
          return
        }
        await api.put('/credentials', { email: settingsEmail, password: settingsPassword })
        setCredentialsEmail(settingsEmail)
      }

      const settingsPayload: Record<string, string> = {
        timezone: settingsTimezone,
        telegram_chat_id: settingsTelegramChatId,
      }
      if (settingsTelegramToken) settingsPayload.telegram_bot_token = settingsTelegramToken
      await api.put('/settings', settingsPayload)

      toast('success', 'Paramètres enregistrés')
      setSettingsOpen(false)
      await dashboard.refresh()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSettingsSaving(false)
    }
  }, [settingsEmail, settingsPassword, settingsTimezone, settingsTelegramToken, settingsTelegramChatId, dashboard, toast])

  const handleTelegramTest = useCallback(async () => {
    setTelegramTesting(true)
    try {
      await api.post('/telegram/test', {})
      toast('success', 'Message test envoyé')
    } catch (err) {
      toast('error', 'Erreur Telegram', err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setTelegramTesting(false)
    }
  }, [toast])

  // --- Advance days ---
  const handleAdvanceDaysConfirm = useCallback(() => {
    setAdvanceDaysDialogOpen(false)
  }, [])

  // --- Loading state ---
  if (!credentialsChecked) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-50 dark:bg-slate-900">
        <Spinner size="lg" />
      </div>
    )
  }

  // --- Setup screen ---
  if (!credentialsConfigured) {
    return (
      <>
        <SetupScreen onSuccess={() => {
          setCredentialsConfigured(true)
          dashboard.refresh()
        }} />
        <ToastContainer />
      </>
    )
  }

  // --- Dashboard loading ---
  if (dashboard.loading && !dashboard.data) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto" />
          <p className="text-slate-400 text-sm mt-3">Chargement du tableau de bord...</p>
        </div>
        <ToastContainer />
      </div>
    )
  }

  // --- Dashboard error ---
  if (dashboard.error && !dashboard.data) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-red-500 font-semibold">Erreur</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{dashboard.error}</p>
          <Button variant="primary" onClick={dashboard.refresh} className="mt-4">
            Réessayer
          </Button>
        </div>
        <ToastContainer />
      </div>
    )
  }

  const dashData = dashboard.data
  if (!dashData) return null

  const config: DashboardConfig = dashData.config
  const activeRulesCount = dashData.rules.filter((r) => r.enabled).length

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-3 pb-6 sm:px-5 sm:pb-10">
        <Header onOpenSettings={handleOpenSettings} />

        <StatsBar
          activeRules={activeRulesCount}
          upcomingBookings={bookings.upcomingTotal}
          advanceDays={config.advance_days}
          onEditAdvanceDays={() => setAdvanceDaysDialogOpen(true)}
        />

        {/* Info note */}
        <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-lg p-3.5 mb-4 text-sky-900 dark:text-sky-300 text-xs leading-relaxed sm:p-4 sm:mb-6 sm:text-[13px]">
          <p className="font-semibold mb-1.5">Fonctionnement du bot</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Chaque règle se déclenche à son heure configurée et réserve les créneaux qui ouvrent à <strong>J-{config.advance_days}</strong></li>
            <li>Si ta banque demande une confirmation 3DS, le bot attend jusqu'à <strong>5 minutes</strong> que tu valides sur ton appli bancaire</li>
            <li>Le bot choisit le meilleur terrain disponible selon tes préférences</li>
          </ul>
        </div>

        {/* Rules section */}
        <section className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">Règles de réservation</h2>
              <p className="text-xs text-slate-400 mt-0.5">Configurez vos réservations automatiques</p>
            </div>
            <Button variant="primary" size="sm" onClick={handleOpenNewRule}>
              + Nouvelle règle
            </Button>
          </div>
          {dashData.rules.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-10 text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Aucune règle configurée</p>
              <p className="text-xs text-slate-400 mt-1">Cliquez sur "Nouvelle règle" pour commencer.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dashData.rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={handleEditRule}
                  onDelete={(id) => {
                    const r = dashData.rules.find((x) => x.id === id)
                    if (r) setDeleteRuleTarget(r)
                  }}
                  onToggle={handleToggleRule}
                  onBookNow={handleBookNow}
                  bookingLoading={bookNowRuleId === rule.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Manual booking section */}
        <section className="mb-6 sm:mb-8">
          <div className="mb-3.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">Réservation manuelle</h2>
            <p className="text-xs text-slate-400 mt-0.5">Recherchez et réservez un créneau spécifique</p>
          </div>
          <SlotSearch loading={slotsHook.loading} onSearch={handleSlotSearch} />
          <SlotResults
            slots={slotsHook.slots}
            showDuration={true}
            onBook={handleBookSlot}
          />
        </section>

        {/* Bookings section */}
        <section className="mb-6 sm:mb-8">
          <div className="mb-3.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">Réservations</h2>
            <p className="text-xs text-slate-400 mt-0.5">Vos réservations à venir et passées</p>
          </div>
          <BookingsList
            data={bookings.data}
            loading={bookings.loading}
            status={bookings.status}
            page={bookings.page}
            onLoad={bookings.load}
            onCancel={handleCancelBookingRequest}
            onRefresh={() => bookings.load(bookings.status, bookings.page)}
          />
        </section>

        {/* Logs section */}
        <section className="mb-6 sm:mb-8">
          <div className="mb-3.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">Historique</h2>
            <p className="text-xs text-slate-400 mt-0.5">Journal des tentatives de réservation</p>
          </div>
          <LogsTable logs={dashData.recent_logs} onDelete={handleDeleteLogs} />
        </section>
      </div>

      {/* Rule form dialog */}
      <RuleForm
        open={ruleFormOpen}
        onClose={() => setRuleFormOpen(false)}
        onSave={handleSaveRule}
        rule={editingRule}
        config={config}
      />

      {/* Delete rule confirm dialog */}
      <ConfirmDialog
        open={deleteRuleTarget !== null}
        onClose={() => setDeleteRuleTarget(null)}
        onConfirm={handleDeleteRuleConfirm}
        title="Supprimer la règle"
        message={deleteRuleTarget
          ? `Voulez-vous vraiment supprimer la règle du ${deleteRuleTarget.day_name} à ${deleteRuleTarget.target_time} ?`
          : ''}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        loading={deleteRuleLoading}
      />

      {/* Cancel booking confirm dialog */}
      <ConfirmDialog
        open={cancelBookingTarget !== null}
        onClose={() => setCancelBookingTarget(null)}
        onConfirm={handleCancelBookingConfirm}
        title="Annuler la réservation"
        message={cancelBookingTarget
          ? `Voulez-vous vraiment annuler la réservation du ${cancelBookingTarget.date} à ${cancelBookingTarget.time} (${cancelBookingTarget.playground}) ?`
          : ''}
        confirmLabel="Annuler la réservation"
        confirmVariant="danger"
        loading={cancelBookingLoading}
      />

      {/* Advance days info dialog */}
      <ConfirmDialog
        open={advanceDaysDialogOpen}
        onClose={() => setAdvanceDaysDialogOpen(false)}
        onConfirm={handleAdvanceDaysConfirm}
        title="Ouverture des créneaux"
        message={`Les créneaux sont ouverts à la réservation J-${config.advance_days} avant la date cible. Cette valeur est configurée côté serveur.`}
        confirmLabel="Compris"
        confirmVariant="primary"
      />

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[10000]">
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="fixed inset-0 flex items-end justify-center p-4 sm:items-center sm:p-5">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl rounded-b-none sm:rounded-b-2xl p-7 shadow-xl">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-5">Paramètres</h2>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
                <input
                  type="email"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                  placeholder="Mot de passe DoInSport"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fuseau horaire du serveur</label>
                <input
                  type="text"
                  value={settingsTimezone}
                  onChange={(e) => setSettingsTimezone(e.target.value)}
                  placeholder="Europe/Paris"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Ex: Europe/Paris, America/New_York, Asia/Tokyo</p>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Telegram</h3>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Token du bot</label>
                  <input
                    type="password"
                    value={settingsTelegramToken}
                    onChange={(e) => setSettingsTelegramToken(e.target.value)}
                    placeholder="Laisser vide pour ne pas modifier"
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Chat ID</label>
                  <input
                    type="text"
                    value={settingsTelegramChatId}
                    onChange={(e) => setSettingsTelegramChatId(e.target.value)}
                    placeholder="Ex: 123456789"
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg text-base min-h-12 sm:text-sm sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <Button variant="secondary" size="sm" onClick={handleTelegramTest} loading={telegramTesting}>
                  Tester
                </Button>
              </div>

              <div className="flex flex-col-reverse gap-2.5 mt-6 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                  Annuler
                </Button>
                <Button variant="primary" onClick={handleSaveSettings} loading={settingsSaving}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  )
}
