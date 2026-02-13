# React + Tailwind Frontend Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the vanilla HTML/CSS/JS frontend with a React 19 + TypeScript + Tailwind CSS v4 app, served by the existing Express backend.

**Architecture:** A `frontend/` directory with its own `package.json` contains the Vite-built React app. Vite proxies `/api` to Express in dev mode. In production, `npm run build` outputs to `../public/` which Express serves statically. The backend is unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Headless UI, @dnd-kit/core, vite-plugin-pwa

**Design Doc:** `docs/plans/2026-02-13-react-tailwind-migration-design.md`

---

## Pre-requisites

Before starting, back up the current frontend files that will be replaced:

```bash
mkdir -p /tmp/sdlv-backup
cp public/index.html public/app.js public/style.css public/sw.js public/manifest.json /tmp/sdlv-backup/
```

The file `public/stripe-confirm.html` must be **preserved** — it is used by Playwright for Stripe payment confirmation and is NOT part of the React app. Same for `public/icon.svg`.

---

## Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/vite-env.d.ts`

**Step 1: Create the Vite project**

```bash
cd /Users/ataaki/Desktop/sdlv-booker
npm create vite@latest frontend -- --template react-ts
```

**Step 2: Install dependencies**

```bash
cd frontend
npm install
npm install @headlessui/react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 3: Configure Vite for API proxy and build output**

Replace `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false, // Don't delete stripe-confirm.html & icons
  },
})
```

> **Important:** `emptyOutDir: false` because `public/stripe-confirm.html` and `public/icon.svg` must survive the build. We'll handle cleanup of old files (app.js, style.css, sw.js, manifest.json) manually in Task 18.

**Step 4: Replace the scaffolded `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Foot Du Lundi" />
  <meta name="description" content="Bot de réservation automatique pour les terrains de foot" />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  <title>Foot Du Lundi</title>
</head>
<body class="bg-slate-50 text-slate-900 antialiased min-h-dvh">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 5: Minimal `frontend/src/App.tsx`**

```tsx
export default function App() {
  return <div className="text-center p-8">Foot Du Lundi - React Migration</div>
}
```

**Step 6: Minimal `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Step 7: Delete scaffolded CSS files**

```bash
rm frontend/src/index.css frontend/src/App.css
```

**Step 8: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server starts on `localhost:5173`, shows "Foot Du Lundi - React Migration".

**Step 9: Verify build works**

```bash
cd frontend && npm run build
```

Expected: Build output in `../public/` with `index.html`, `assets/` folder. Existing `stripe-confirm.html` and `icon.svg` preserved.

**Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Configure Tailwind CSS v4

**Files:**
- Modify: `frontend/package.json` (add tailwindcss)
- Create: `frontend/src/index.css`

**Step 1: Install Tailwind CSS v4 + Vite plugin**

```bash
cd frontend && npm install tailwindcss @tailwindcss/vite
```

**Step 2: Add Tailwind Vite plugin to `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
})
```

**Step 3: Create `frontend/src/index.css`**

```css
@import "tailwindcss";

@theme {
  --font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

**Step 4: Import CSS in `frontend/src/main.tsx`**

Add at top of `main.tsx`:
```ts
import './index.css'
```

**Step 5: Test Tailwind classes work**

Update `App.tsx` to use Tailwind classes:

```tsx
export default function App() {
  return (
    <div className="flex items-center justify-center min-h-dvh bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4">
          ⚽
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Foot Du Lundi</h1>
        <p className="text-slate-500 mt-2">Migration en cours...</p>
      </div>
    </div>
  )
}
```

**Step 6: Verify**

```bash
cd frontend && npm run dev
```

Expected: Page shows styled content with DM Sans font, sky-blue football icon, proper spacing.

**Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: configure Tailwind CSS v4"
```

---

## Task 3: Create TypeScript types & utility modules

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/constants.ts`
- Create: `frontend/src/lib/format.ts`

**Step 1: Create types**

`frontend/src/types/index.ts`:

```ts
export interface Rule {
  id: number
  day_of_week: number
  target_time: string
  duration: number
  activity: string
  playground_order: string[] | null
  enabled: boolean
  created_at: string
  day_name: string
  duration_label: string
  j45: J45Info
}

export interface J45Info {
  target_date: string
  attempt_date: string
  days_until_attempt: number
}

export interface DashboardData {
  rules: Rule[]
  recent_logs: Log[]
  credentials_configured: boolean
  config: DashboardConfig
}

export interface DashboardConfig {
  advance_days: number
  playgrounds: Record<string, string>
  playground_names: string[]
  durations: number[]
  day_names: string[]
}

export interface Booking {
  id: string
  date: string
  startAt: string
  endAt: string
  playground: string
  pricePerParticipant: number
  confirmed: boolean
  canceled: boolean
}

export interface BookingsResponse {
  bookings: Booking[]
  total: number
  totalPages: number
  hasMore: boolean
}

export interface Log {
  id: number
  rule_id: number | null
  target_date: string
  target_time: string
  booked_time: string | null
  playground: string | null
  status: string
  booking_id: string | null
  error_message: string | null
  created_at: string
}

export interface Slot {
  playground: { id: string; name: string }
  startAt: string
  priceId: string
  price: number
  duration: number
  participantCount: number
}

export interface BookResult {
  status: 'success' | 'skipped' | 'no_slots' | 'failed'
  target_date?: string
  booked_time?: string
  playground?: string
  booking_id?: string
  price?: number
  error?: string
  error_message?: string
}

export type ToastType = 'success' | 'error' | 'warning' | 'info'
```

**Step 2: Create constants**

`frontend/src/lib/constants.ts`:

```ts
export const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
export const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export const DAY_OPTIONS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
]

export const DURATION_OPTIONS = [
  { value: 60, label: '60 min' },
  { value: 90, label: '90 min' },
  { value: 120, label: '120 min' },
]

export const STATUS_LABELS: Record<string, string> = {
  success: 'Réussi',
  failed: 'Échoué',
  payment_failed: 'Paiement échoué',
  no_slots: 'Indispo',
  pending: 'En cours',
  skipped: 'Doublon',
  cancelled: 'Annulé',
}
```

**Step 3: Create format utilities**

`frontend/src/lib/format.ts`:

```ts
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(dtStr: string | null | undefined): string {
  if (!dtStr) return '-'
  const d = new Date(dtStr + 'Z')
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(isoStr: string | null | undefined): string {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '-'
  return `${(cents / 100).toFixed(2)} EUR`
}
```

**Step 4: Verify build**

```bash
cd frontend && npm run build
```

Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add frontend/src/types/ frontend/src/lib/
git commit -m "feat: add TypeScript types, constants, and format utilities"
```

---

## Task 4: Create API client

**Files:**
- Create: `frontend/src/api/client.ts`

**Step 1: Create fetch wrapper**

`frontend/src/api/client.ts`:

```ts
const API = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new ApiError(res.status, data.error || `HTTP ${res.status}`)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
}
```

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: add API client with typed fetch wrapper"
```

---

## Task 5: Create UI primitives (Button, Badge, Spinner, Toggle)

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Badge.tsx`
- Create: `frontend/src/components/ui/Spinner.tsx`
- Create: `frontend/src/components/ui/Toggle.tsx`

**Step 1: Create Button component**

`frontend/src/components/ui/Button.tsx`:

```tsx
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'icon'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:border-slate-300',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600',
  ghost: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
  icon: 'text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, disabled, className = '', ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer
        disabled:opacity-60 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

export default Button
```

**Step 2: Create Spinner**

`frontend/src/components/ui/Spinner.tsx`:

```tsx
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5 border-[1.5px]',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-slate-300 border-t-slate-900 ${sizeClasses[size]} ${className}`}
    />
  )
}
```

**Step 3: Create Badge**

`frontend/src/components/ui/Badge.tsx`:

```tsx
type BadgeVariant = 'success' | 'failed' | 'payment_failed' | 'no_slots' | 'pending' | 'skipped' | 'cancelled' | 'auto' | 'manual' | 'error'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  payment_failed: 'bg-red-50 text-red-700',
  no_slots: 'bg-amber-50 text-amber-700',
  pending: 'bg-blue-50 text-blue-700',
  skipped: 'bg-violet-50 text-violet-700',
  cancelled: 'bg-stone-100 text-stone-600',
  auto: 'bg-sky-50 text-sky-700',
  manual: 'bg-fuchsia-50 text-purple-700',
  error: 'bg-red-50 text-red-700 border border-red-200',
}

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  title?: string
  className?: string
}

export default function Badge({ variant, children, title, className = '' }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${variantClasses[variant]} ${title ? 'cursor-help border-b border-dashed border-current' : ''} ${className}`}
    >
      {children}
    </span>
  )
}
```

**Step 4: Create Toggle**

`frontend/src/components/ui/Toggle.tsx`:

```tsx
import { Switch } from '@headlessui/react'

interface ToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label?: string
}

export default function Toggle({ enabled, onChange, label }: ToggleProps) {
  return (
    <Switch
      checked={enabled}
      onChange={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200
        ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      {label && <span className="sr-only">{label}</span>}
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200
          ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </Switch>
  )
}
```

**Step 5: Verify build**

```bash
cd frontend && npm run build
```

**Step 6: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add UI primitives (Button, Badge, Spinner, Toggle)"
```

---

## Task 6: Create Toast system

**Files:**
- Create: `frontend/src/components/ui/Toast.tsx`
- Create: `frontend/src/hooks/use-toast.tsx`

**Step 1: Create Toast context + provider**

`frontend/src/hooks/use-toast.tsx`:

```tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { ToastType } from '../types'

interface ToastItem {
  id: number
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast: (type: ToastType, title: string, message?: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, type, title, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
```

**Step 2: Create Toast display component**

`frontend/src/components/ui/Toast.tsx`:

```tsx
import { useToast } from '../../hooks/use-toast'
import type { ToastType } from '../../types'

const icons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}

const borderColors: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-sky-500',
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md pointer-events-none max-sm:top-auto max-sm:bottom-4 max-sm:left-3 max-sm:right-3 max-sm:max-w-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-lg border-l-4 ${borderColors[t.type]} animate-[slideIn_0.3s_ease-out]`}
        >
          <span className="text-lg shrink-0">{icons[t.type]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{t.title}</div>
            {t.message && (
              <div className="text-xs text-slate-500 mt-0.5 break-words">{t.message}</div>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0 cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Add keyframe to `frontend/src/index.css`**

Append to `frontend/src/index.css`:

```css
@keyframes slideIn {
  from { opacity: 0; transform: translateX(40px) scale(0.96); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
```

**Step 4: Wire ToastProvider into main.tsx**

Update `frontend/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider } from './hooks/use-toast'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
```

**Step 5: Verify build**

```bash
cd frontend && npm run build
```

**Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add toast notification system with context"
```

---

## Task 7: Create ConfirmDialog

**Files:**
- Create: `frontend/src/components/ui/ConfirmDialog.tsx`

**Step 1: Create dialog using Headless UI**

`frontend/src/components/ui/ConfirmDialog.tsx`:

```tsx
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  confirmVariant = 'primary',
  loading,
}: ConfirmDialogProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[10000]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-5 max-sm:items-end max-sm:p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-250"
            enterFrom="opacity-0 scale-95 max-sm:translate-y-full"
            enterTo="opacity-100 scale-100 max-sm:translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 max-sm:translate-y-0"
            leaveTo="opacity-0 scale-95 max-sm:translate-y-full"
          >
            <DialogPanel className="w-full max-w-md bg-white rounded-2xl max-sm:rounded-b-none p-7 shadow-xl">
              <DialogTitle className="text-lg font-bold text-slate-900">{title}</DialogTitle>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{message}</p>
              <div className="flex justify-end gap-2.5 mt-6 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onClose}>
                  Annuler
                </Button>
                <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
                  {confirmLabel}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
```

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/components/ui/ConfirmDialog.tsx
git commit -m "feat: add ConfirmDialog with Headless UI"
```

---

## Task 8: Create API hooks

**Files:**
- Create: `frontend/src/hooks/use-dashboard.ts`
- Create: `frontend/src/hooks/use-bookings.ts`
- Create: `frontend/src/hooks/use-rules.ts`
- Create: `frontend/src/hooks/use-slots.ts`

**Step 1: Dashboard hook**

`frontend/src/hooks/use-dashboard.ts`:

```ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import type { DashboardData } from '../types'

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await api.get<DashboardData>('/dashboard')
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 60_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { data, loading, error, refresh }
}
```

**Step 2: Bookings hook**

`frontend/src/hooks/use-bookings.ts`:

```ts
import { useState, useCallback } from 'react'
import { api } from '../api/client'
import type { BookingsResponse } from '../types'

export function useBookings() {
  const [data, setData] = useState<BookingsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'upcoming' | 'past'>('upcoming')
  const [page, setPage] = useState(1)

  const load = useCallback(async (s: 'upcoming' | 'past' = status, p: number = page) => {
    setLoading(true)
    setStatus(s)
    setPage(p)
    try {
      const result = await api.get<BookingsResponse>(`/bookings?status=${s}&page=${p}&limit=20`)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [status, page])

  return { data, loading, status, page, load }
}
```

**Step 3: Rules hook**

`frontend/src/hooks/use-rules.ts`:

```ts
import { useCallback } from 'react'
import { api } from '../api/client'
import type { BookResult } from '../types'

interface RuleInput {
  day_of_week: number
  target_time: string
  duration: number
  playground_order: string[] | null
}

export function useRules() {
  const createRule = useCallback(async (rule: RuleInput) => {
    return api.post('/rules', rule)
  }, [])

  const updateRule = useCallback(async (id: number, updates: Partial<RuleInput & { enabled: boolean }>) => {
    return api.put(`/rules/${id}`, updates)
  }, [])

  const deleteRule = useCallback(async (id: number) => {
    return api.delete(`/rules/${id}`)
  }, [])

  const toggleRule = useCallback(async (id: number, enabled: boolean) => {
    return api.put(`/rules/${id}`, { enabled })
  }, [])

  const bookNow = useCallback(async (ruleId: number, date: string) => {
    return api.post<BookResult>('/book-now', { rule_id: ruleId, date })
  }, [])

  return { createRule, updateRule, deleteRule, toggleRule, bookNow }
}
```

**Step 4: Slots hook**

`frontend/src/hooks/use-slots.ts`:

```ts
import { useState, useCallback } from 'react'
import { api } from '../api/client'
import type { Slot, BookResult } from '../types'

export function useSlots() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (params: {
    date: string
    from?: string
    to?: string
    duration?: number
  }) => {
    setLoading(true)
    try {
      let url = `/slots?date=${params.date}`
      if (params.duration) url += `&duration=${params.duration}`
      if (params.from) url += `&from=${params.from}`
      if (params.to) url += `&to=${params.to}`
      const result = await api.get<Slot[]>(url)
      setSlots(result)
    } catch {
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [])

  const bookSlot = useCallback(async (params: {
    date: string
    startTime: string
    duration: number
    playgroundName: string
  }) => {
    return api.post<BookResult>('/book-manual', params)
  }, [])

  return { slots, loading, search, bookSlot }
}
```

**Step 5: Verify build**

```bash
cd frontend && npm run build
```

**Step 6: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add API hooks (dashboard, bookings, rules, slots)"
```

---

## Task 9: Create layout components (Header, StatsBar)

**Files:**
- Create: `frontend/src/components/layout/Header.tsx`
- Create: `frontend/src/components/layout/StatsBar.tsx`

**Step 1: Create Header**

`frontend/src/components/layout/Header.tsx`:

The header shows the app logo, scheduler status badge, and a settings gear button. It accepts an `onOpenSettings` callback.

```tsx
import Button from '../ui/Button'

interface HeaderProps {
  onOpenSettings: () => void
}

export default function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="bg-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_300px_at_80%_20%,rgba(56,189,248,0.12),transparent_70%),radial-gradient(ellipse_400px_200px_at_20%_80%,rgba(16,185,129,0.08),transparent_70%)] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-5 py-7 relative flex items-center justify-between max-sm:px-3 max-sm:py-5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-xl shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            ⚽
          </div>
          <h1 className="text-[22px] font-bold text-white tracking-tight max-sm:text-lg">Foot Du Lundi</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="icon"
            onClick={onOpenSettings}
            className="!text-white/60 !border-white/15 hover:!text-white hover:!bg-white/10"
          >
            ⚙
          </Button>
          <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_theme(colors.emerald.500)] animate-pulse" />
            Scheduler actif
          </div>
        </div>
      </div>
    </header>
  )
}
```

**Step 2: Create StatsBar**

`frontend/src/components/layout/StatsBar.tsx`:

```tsx
interface StatsBarProps {
  activeRules: number
  upcomingBookings: number
  advanceDays: number
  onEditAdvanceDays: () => void
}

export default function StatsBar({ activeRules, upcomingBookings, advanceDays, onEditAdvanceDays }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5 my-6 max-sm:gap-2 max-sm:my-4">
      <StatCard value={String(activeRules)} label="Règles actives" />
      <StatCard value={String(upcomingBookings)} label="Réservations à venir" />
      <StatCard
        value={`J-${advanceDays}`}
        label="Ouverture créneaux"
        onClick={onEditAdvanceDays}
        editable
      />
    </div>
  )
}

function StatCard({
  value,
  label,
  onClick,
  editable,
}: {
  value: string
  label: string
  onClick?: () => void
  editable?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-4 text-center border border-slate-200 shadow-sm transition-shadow hover:shadow-md
        max-sm:p-3 max-sm:rounded-lg
        ${editable ? 'cursor-pointer group relative hover:border-sky-500 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.15)]' : ''}`}
    >
      {editable && (
        <span className="absolute top-1.5 right-2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity max-sm:opacity-50">
          ✎
        </span>
      )}
      <span className="block text-[28px] font-bold text-slate-900 leading-none max-sm:text-[22px]">{value}</span>
      <span className="block text-[11px] font-semibold text-slate-400 mt-1.5 uppercase tracking-wider max-sm:text-[9px]">{label}</span>
    </div>
  )
}
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat: add Header and StatsBar layout components"
```

---

## Task 10: Create Rules components (RuleCard, RuleForm, PlaygroundPrefs)

**Files:**
- Create: `frontend/src/components/rules/RuleCard.tsx`
- Create: `frontend/src/components/rules/RuleForm.tsx`
- Create: `frontend/src/components/rules/PlaygroundPrefs.tsx`

**Step 1: Create PlaygroundPrefs with @dnd-kit**

`frontend/src/components/rules/PlaygroundPrefs.tsx`:

Sortable drag-and-drop list of playground checkboxes. Uses `@dnd-kit/sortable`.

```tsx
import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface PlaygroundPrefsProps {
  allNames: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function PlaygroundPrefs({ allNames, selected, onChange }: PlaygroundPrefsProps) {
  // Order: selected first, then the rest
  const [items, setItems] = useState(() => {
    const rest = allNames.filter((n) => !selected.includes(n))
    return [...selected, ...rest].map((name) => ({
      id: name,
      checked: selected.length === 0 || selected.includes(name),
    }))
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id)
        const newIndex = prev.findIndex((i) => i.id === over.id)
        const next = arrayMove(prev, oldIndex, newIndex)
        onChange(next.filter((i) => i.checked).map((i) => i.id))
        return next
      })
    }
  }

  function handleToggle(name: string) {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === name ? { ...i, checked: !i.checked } : i))
      onChange(next.filter((i) => i.checked).map((i) => i.id))
      return next
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {items.map((item) => (
            <SortableItem key={item.id} item={item} onToggle={handleToggle} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ item, onToggle }: { item: { id: string; checked: boolean }; onToggle: (name: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-sm select-none transition-colors hover:border-slate-300 ${isDragging ? 'opacity-40' : ''}`}
    >
      <span {...attributes} {...listeners} className="text-slate-400 text-[10px] cursor-grab">
        ⠿
      </span>
      <label className="flex items-center gap-1 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggle(item.id)}
          className="accent-slate-900"
        />
        {item.id}
      </label>
    </div>
  )
}
```

**Step 2: Create RuleCard**

`frontend/src/components/rules/RuleCard.tsx`:

```tsx
import { DAY_NAMES_SHORT } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import type { Rule } from '../../types'
import Button from '../ui/Button'
import Toggle from '../ui/Toggle'

interface RuleCardProps {
  rule: Rule
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onToggle: (id: number, enabled: boolean) => void
  onBookNow: (id: number, date: string) => void
  bookingLoading?: boolean
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle, onBookNow, bookingLoading }: RuleCardProps) {
  const pgLabel = rule.playground_order?.length ? rule.playground_order.join(', ') : 'Aucune préférence'

  const j45 = rule.j45
  let j45Label = ''
  if (j45.days_until_attempt === 0) {
    j45Label = `Réservation auto aujourd'hui à 00:00 pour le ${formatDate(j45.target_date)}`
  } else if (j45.days_until_attempt === 1) {
    j45Label = `Réservation auto demain à 00:00 pour le ${formatDate(j45.target_date)}`
  } else {
    j45Label = `Réservation auto le ${formatDate(j45.attempt_date)} à 00:00 pour le ${formatDate(j45.target_date)} (dans ${j45.days_until_attempt}j)`
  }

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 transition-all shadow-sm hover:border-sky-500 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.15)]
        max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5
        ${rule.enabled ? '' : 'opacity-45'}`}
    >
      <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2.5 text-center min-w-14 font-bold text-sm tracking-wide max-sm:self-start max-sm:px-3 max-sm:py-1.5 max-sm:text-xs">
        {DAY_NAMES_SHORT[rule.day_of_week]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xl font-bold text-slate-900 tracking-tight max-sm:text-lg">{rule.target_time}</div>
        <div className="text-sm text-slate-500 mt-0.5">Football 5v5 - {rule.duration_label} - Tarif variable selon horaire</div>
        <div className="text-xs text-slate-400 mt-0.5">Terrains : {pgLabel}</div>
        <div className="text-xs text-sky-600 font-medium mt-1">{j45Label}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 max-sm:w-full max-sm:justify-between max-sm:flex-wrap max-sm:gap-2">
        <Button variant="success" size="sm" onClick={() => onBookNow(rule.id, j45.target_date)} loading={bookingLoading}>
          ⚡ Réserver
        </Button>
        <Button variant="icon" size="sm" onClick={() => onEdit(rule.id)}>✏</Button>
        <Toggle enabled={rule.enabled} onChange={(v) => onToggle(rule.id, v)} label={rule.enabled ? 'Désactiver' : 'Activer'} />
        <Button variant="icon" size="sm" onClick={() => onDelete(rule.id)}>🗑</Button>
      </div>
    </div>
  )
}
```

**Step 3: Create RuleForm**

`frontend/src/components/rules/RuleForm.tsx`:

A dialog (Headless UI) for adding/editing rules. Contains day select, time input, duration select, playground preferences.

```tsx
import { useState, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import { DAY_OPTIONS, DURATION_OPTIONS } from '../../lib/constants'
import type { Rule, DashboardConfig } from '../../types'
import Button from '../ui/Button'
import PlaygroundPrefs from './PlaygroundPrefs'

interface RuleFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: { day_of_week: number; target_time: string; duration: number; playground_order: string[] | null }) => Promise<void>
  rule: Rule | null // null = create, Rule = edit
  config: DashboardConfig
}

export default function RuleForm({ open, onClose, onSave, rule, config }: RuleFormProps) {
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [targetTime, setTargetTime] = useState('19:00')
  const [duration, setDuration] = useState(60)
  const [playgroundOrder, setPlaygroundOrder] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rule) {
      setDayOfWeek(rule.day_of_week)
      setTargetTime(rule.target_time)
      setDuration(rule.duration)
      setPlaygroundOrder(rule.playground_order ?? [])
    } else {
      setDayOfWeek(1)
      setTargetTime('19:00')
      setDuration(60)
      setPlaygroundOrder([])
    }
  }, [rule, open])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        day_of_week: dayOfWeek,
        target_time: targetTime,
        duration,
        playground_order: playgroundOrder.length > 0 ? playgroundOrder : null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[10000]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-5 max-sm:items-end max-sm:p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-250" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-lg bg-white rounded-2xl max-sm:rounded-b-none p-7 shadow-xl">
              <DialogTitle className="text-lg font-bold mb-5">
                {rule ? 'Modifier la règle' : 'Ajouter une règle'}
              </DialogTitle>

              <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Jour</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Heure</label>
                  <input
                    type="time"
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Durée</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Préférence de terrains (glisser pour ordonner, décocher pour exclure)
                </label>
                <PlaygroundPrefs
                  allNames={config.playground_names}
                  selected={playgroundOrder}
                  onChange={setPlaygroundOrder}
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-6 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="primary" onClick={handleSave} loading={saving}>Enregistrer</Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
```

**Step 4: Verify build**

```bash
cd frontend && npm run build
```

**Step 5: Commit**

```bash
git add frontend/src/components/rules/
git commit -m "feat: add Rules components (RuleCard, RuleForm, PlaygroundPrefs)"
```

---

## Task 11: Create Bookings components (BookingsList, Pagination)

**Files:**
- Create: `frontend/src/components/bookings/Pagination.tsx`
- Create: `frontend/src/components/bookings/BookingsList.tsx`

**Step 1: Create Pagination**

`frontend/src/components/bookings/Pagination.tsx`:

```tsx
import Button from '../ui/Button'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = generatePageNumbers(page, totalPages)

  return (
    <div className="flex items-center justify-center gap-3 mt-4 p-4 bg-slate-50 rounded-lg flex-wrap max-sm:gap-2">
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onPageChange(1)}>⏮</Button>
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>← Préc</Button>

      <div className="flex items-center gap-1 mx-3 max-sm:order-3 max-sm:w-full max-sm:justify-center max-sm:my-2">
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-2 text-slate-400 text-sm">...</span>
          ) : (
            <button
              key={p}
              disabled={p === page}
              onClick={() => onPageChange(p as number)}
              className={`min-w-9 h-9 px-2 border rounded-lg text-sm font-medium transition cursor-pointer
                ${p === page
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-900 hover:text-slate-900'
                }`}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>Suiv →</Button>
      <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => onPageChange(totalPages)}>⏭</Button>
    </div>
  )
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]
  const start = Math.max(2, current - 2)
  const end = Math.min(total - 1, current + 2)

  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('...')
  if (total > 1) pages.push(total)

  return pages
}
```

**Step 2: Create BookingsList**

`frontend/src/components/bookings/BookingsList.tsx`:

```tsx
import { useState } from 'react'
import { TabGroup, TabList, Tab } from '@headlessui/react'
import { formatDate, formatTime, formatPrice } from '../../lib/format'
import type { BookingsResponse } from '../../types'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import Pagination from './Pagination'

interface BookingsListProps {
  data: BookingsResponse | null
  loading: boolean
  status: 'upcoming' | 'past'
  page: number
  onLoad: (status: 'upcoming' | 'past', page: number) => void
  onCancel: (bookingId: string, date: string, time: string, playground: string) => void
  onRefresh: () => void
}

export default function BookingsList({ data, loading, status, page, onLoad, onCancel, onRefresh }: BookingsListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const tabIndex = status === 'upcoming' ? 0 : 1

  async function handleCancel(id: string, date: string, time: string, pg: string) {
    setCancellingId(id)
    await onCancel(id, date, time, pg)
    setCancellingId(null)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <TabGroup selectedIndex={tabIndex} onChange={(i) => onLoad(i === 0 ? 'upcoming' : 'past', 1)}>
          <TabList className="flex gap-2 border-b-2 border-slate-100 pb-0">
            {['À venir', 'Passées'].map((label) => (
              <Tab
                key={label}
                className={({ selected }) =>
                  `px-4 py-2.5 text-sm font-medium border-b-2 -mb-[2px] transition cursor-pointer focus:outline-none
                  ${selected ? 'text-slate-900 border-slate-900 font-semibold' : 'text-slate-500 border-transparent hover:text-slate-700'}`
                }
              >
                {label}
              </Tab>
            ))}
          </TabList>
        </TabGroup>
        <Button variant="secondary" size="sm" onClick={onRefresh}>Actualiser</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Spinner />
          <span>Chargement...</span>
        </div>
      ) : !data?.bookings?.length ? (
        <p className="text-center py-10 text-slate-400 text-sm">
          {status === 'upcoming' ? 'Aucune réservation à venir.' : 'Aucune réservation passée.'}
        </p>
      ) : (
        <>
          <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50">
            Page {page} / {data.totalPages} · {data.total} réservation{data.total > 1 ? 's' : ''}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Horaire</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Terrain</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Prix</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Statut</th>
                  {status === 'upcoming' && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${b.canceled ? 'opacity-60 [&_td]:line-through' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{formatDate(b.date)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatTime(b.startAt)} - {formatTime(b.endAt)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{b.playground || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{formatPrice(b.pricePerParticipant)}/pers</td>
                    <td className="px-4 py-2.5">
                      {b.canceled ? (
                        <Badge variant="error">Annulée</Badge>
                      ) : b.confirmed ? (
                        <Badge variant="success">Confirmée</Badge>
                      ) : (
                        <Badge variant="pending">Non confirmée</Badge>
                      )}
                    </td>
                    {status === 'upcoming' && (
                      <td className="px-4 py-2.5">
                        {!b.canceled && (
                          <Button
                            variant="danger"
                            size="sm"
                            loading={cancellingId === b.id}
                            onClick={() => handleCancel(b.id, b.date, formatTime(b.startAt), b.playground)}
                          >
                            Annuler
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={data.totalPages} onPageChange={(p) => onLoad(status, p)} />
        </>
      )}
    </div>
  )
}
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/bookings/
git commit -m "feat: add BookingsList with tabs and pagination"
```

---

## Task 12: Create Manual Booking components (SlotSearch, SlotResults)

**Files:**
- Create: `frontend/src/components/manual/SlotSearch.tsx`
- Create: `frontend/src/components/manual/SlotResults.tsx`

**Step 1: Create SlotSearch**

`frontend/src/components/manual/SlotSearch.tsx`:

Search form with date, time range, duration, and search button. Calls `onSearch`.

```tsx
import { useState } from 'react'
import Button from '../ui/Button'

interface SlotSearchProps {
  loading: boolean
  onSearch: (params: { date: string; from: string; to: string; duration?: number }) => void
}

export default function SlotSearch({ loading, onSearch }: SlotSearchProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(defaultDate)
  const [from, setFrom] = useState('19:00')
  const [to, setTo] = useState('22:00')
  const [duration, setDuration] = useState<string>('')

  function handleSearch() {
    if (!date) return
    onSearch({ date, from, to, duration: duration ? Number(duration) : undefined })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col gap-3.5">
        <div className="max-w-[280px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5 max-w-[400px]">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">De</label>
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">À</label>
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3.5 items-end max-w-[400px] max-sm:grid-cols-1">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Durée</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 max-sm:text-base max-sm:min-h-12"
            >
              <option value="">Toutes</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
          <Button variant="primary" onClick={handleSearch} loading={loading} className="max-sm:w-full">
            Rechercher
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Create SlotResults**

`frontend/src/components/manual/SlotResults.tsx`:

```tsx
import { useState } from 'react'
import type { Slot } from '../../types'
import { formatPrice } from '../../lib/format'
import Button from '../ui/Button'

interface SlotResultsProps {
  slots: Slot[]
  showDuration: boolean
  onBook: (slot: Slot) => Promise<void>
}

export default function SlotResults({ slots, showDuration, onBook }: SlotResultsProps) {
  const [bookingSlot, setBookingSlot] = useState<string | null>(null)

  if (slots.length === 0) return null

  async function handleBook(slot: Slot) {
    const key = `${slot.startAt}-${slot.playground.name}-${slot.duration}`
    setBookingSlot(key)
    try {
      await onBook(slot)
    } finally {
      setBookingSlot(null)
    }
  }

  return (
    <div className="mt-3.5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Heure</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Terrain</th>
            {showDuration && <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Durée</th>}
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Prix/pers</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const key = `${s.startAt}-${s.playground.name}-${s.duration}`
            return (
              <tr key={key} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-semibold text-slate-700">{s.startAt}</td>
                <td className="px-4 py-2.5 text-slate-500">{s.playground.name}</td>
                {showDuration && <td className="px-4 py-2.5 text-slate-500">{s.duration / 60} min</td>}
                <td className="px-4 py-2.5 text-slate-500">{formatPrice(s.price)}</td>
                <td className="px-4 py-2.5">
                  <Button variant="success" size="sm" onClick={() => handleBook(s)} loading={bookingSlot === key}>
                    Réserver
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/manual/
git commit -m "feat: add manual booking components (SlotSearch, SlotResults)"
```

---

## Task 13: Create LogsTable component

**Files:**
- Create: `frontend/src/components/logs/LogsTable.tsx`

**Step 1: Create LogsTable**

`frontend/src/components/logs/LogsTable.tsx`:

Table with checkbox selection for bulk deletion. Displays log type (auto/manual), dates, status badges, error tooltips.

```tsx
import { useState, useMemo } from 'react'
import type { Log } from '../../types'
import { STATUS_LABELS } from '../../lib/constants'
import { formatDate, formatDateTime } from '../../lib/format'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

interface LogsTableProps {
  logs: Log[]
  onDelete: (ids: number[]) => Promise<void>
}

export default function LogsTable({ logs, onDelete }: LogsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const allChecked = useMemo(
    () => logs.length > 0 && logs.every((l) => selectedIds.has(l.id)),
    [logs, selectedIds],
  )

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(logs.map((l) => l.id)) : new Set())
  }

  function toggleOne(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  async function handleDelete() {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      await onDelete([...selectedIds])
      setSelectedIds(new Set())
    } finally {
      setDeleting(false)
    }
  }

  if (!logs.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <p className="text-center py-10 text-slate-400 text-sm">Aucun historique.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</span>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            Supprimer ({selectedIds.size})
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-9 text-center px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="accent-slate-900 cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date cible</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Heure visée</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Réservée</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Terrain</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Statut</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="text-center px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(log.id)}
                    onChange={(e) => toggleOne(log.id, e.target.checked)}
                    className="accent-slate-900 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={log.rule_id != null ? 'auto' : 'manual'}>
                    {log.rule_id != null ? 'Auto' : 'Manuel'}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{formatDate(log.target_date)}</td>
                <td className="px-4 py-2.5 text-slate-500">{log.target_time}</td>
                <td className="px-4 py-2.5 text-slate-500">{log.booked_time || '-'}</td>
                <td className="px-4 py-2.5 text-slate-500">{log.playground || '-'}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    variant={log.status as 'success' | 'failed' | 'no_slots' | 'pending' | 'skipped' | 'payment_failed' | 'cancelled'}
                    title={log.error_message || undefined}
                  >
                    {STATUS_LABELS[log.status] || log.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/components/logs/
git commit -m "feat: add LogsTable with selectable rows and bulk delete"
```

---

## Task 14: Create SetupScreen component

**Files:**
- Create: `frontend/src/components/setup/SetupScreen.tsx`

**Step 1: Create login screen**

`frontend/src/components/setup/SetupScreen.tsx`:

```tsx
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
```

**Step 2: Add keyframe for setup screen animation in `frontend/src/index.css`**

Append:

```css
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.93) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/components/setup/ frontend/src/index.css
git commit -m "feat: add SetupScreen login component"
```

---

## Task 15: Assemble App.tsx (main dashboard)

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Write the full App component**

`frontend/src/App.tsx` is the main orchestrator. It:
1. Checks credentials on mount
2. Shows SetupScreen or Dashboard
3. Wires all hooks, state, and components together

```tsx
import { useState, useEffect, useCallback } from 'react'
import { api } from './api/client'
import { useToast } from './hooks/use-toast'
import { useDashboard } from './hooks/use-dashboard'
import { useBookings } from './hooks/use-bookings'
import { useRules } from './hooks/use-rules'
import { useSlots } from './hooks/use-slots'
import { formatDate } from './lib/format'
import { DAY_NAMES_FULL } from './lib/constants'
import type { Rule, Slot } from './types'

import ToastContainer from './components/ui/Toast'
import SetupScreen from './components/setup/SetupScreen'
import Header from './components/layout/Header'
import StatsBar from './components/layout/StatsBar'
import RuleCard from './components/rules/RuleCard'
import RuleForm from './components/rules/RuleForm'
import BookingsList from './components/bookings/BookingsList'
import SlotSearch from './components/manual/SlotSearch'
import SlotResults from './components/manual/SlotResults'
import LogsTable from './components/logs/LogsTable'
import ConfirmDialog from './components/ui/ConfirmDialog'
import Button from './components/ui/Button'
import Spinner from './components/ui/Spinner'

export default function App() {
  const { toast } = useToast()

  // Auth state
  const [credentialsOk, setCredentialsOk] = useState<boolean | null>(null) // null = loading

  // Dashboard
  const { data: dashboard, loading: dashLoading, refresh: refreshDashboard } = useDashboard()

  // Bookings
  const bookings = useBookings()

  // Rules
  const { createRule, updateRule, deleteRule, toggleRule, bookNow } = useRules()

  // Slots
  const slots = useSlots()

  // UI state
  const [ruleFormOpen, setRuleFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [bookingRuleId, setBookingRuleId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; date: string; time: string; pg: string } | null>(null)
  const [confirmBookSlot, setConfirmBookSlot] = useState<{ slot: Slot; date: string } | null>(null)
  const [advanceDaysOpen, setAdvanceDaysOpen] = useState(false)
  const [advanceDaysValue, setAdvanceDaysValue] = useState(45)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [slotSearchDate, setSlotSearchDate] = useState('')
  const [slotSearchDuration, setSlotSearchDuration] = useState<number | undefined>()

  // Check credentials on mount
  useEffect(() => {
    api.get<{ configured: boolean }>('/credentials/status')
      .then((s) => setCredentialsOk(s.configured))
      .catch(() => setCredentialsOk(false))
  }, [])

  // Load bookings when dashboard loads
  useEffect(() => {
    if (dashboard) bookings.load('upcoming', 1)
  }, [dashboard]) // eslint-disable-line react-hooks/exhaustive-deps

  // Loading
  if (credentialsOk === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // Setup screen
  if (!credentialsOk) {
    return (
      <>
        <SetupScreen onSuccess={() => { setCredentialsOk(true); refreshDashboard(); toast('success', 'Connexion réussie', 'Identifiants enregistrés.') }} />
        <ToastContainer />
      </>
    )
  }

  // ===== Handlers =====

  async function handleSaveRule(data: { day_of_week: number; target_time: string; duration: number; playground_order: string[] | null }) {
    if (editingRule) {
      await updateRule(editingRule.id, data)
      toast('success', 'Règle modifiée', `${DAY_NAMES_FULL[data.day_of_week]} à ${data.target_time}`)
    } else {
      await createRule(data)
      toast('success', 'Règle créée', `${DAY_NAMES_FULL[data.day_of_week]} à ${data.target_time}`)
    }
    refreshDashboard()
  }

  async function handleToggleRule(id: number, enabled: boolean) {
    try {
      await toggleRule(id, enabled)
      toast('info', enabled ? 'Règle activée' : 'Règle désactivée')
      refreshDashboard()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
      refreshDashboard()
    }
  }

  async function handleDeleteRule() {
    if (confirmDelete === null) return
    try {
      await deleteRule(confirmDelete)
      toast('success', 'Règle supprimée')
      refreshDashboard()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
    }
    setConfirmDelete(null)
  }

  async function handleBookNow(ruleId: number, date: string) {
    setBookingRuleId(ruleId)
    try {
      const result = await bookNow(ruleId, date)
      if (result.status === 'success') {
        toast('success', 'Réservation réussie', `${result.playground} à ${result.booked_time} le ${formatDate(result.target_date!)}`)
      } else if (result.status === 'skipped') {
        toast('warning', 'Doublon', `Une réservation existe déjà le ${formatDate(result.target_date!)}.`)
      } else if (result.status === 'no_slots') {
        toast('warning', 'Indisponible', `Aucun créneau disponible le ${formatDate(result.target_date!)}.`)
      } else {
        toast('error', 'Échec', result.error_message || result.error || 'Erreur inconnue')
      }
      refreshDashboard()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
    }
    setBookingRuleId(null)
  }

  async function handleCancelBooking() {
    if (!confirmCancel) return
    try {
      const params = new URLSearchParams({ date: confirmCancel.date, time: confirmCancel.time, playground: confirmCancel.pg })
      const result = await api.delete<{ success: boolean; error?: string }>(`/bookings/${confirmCancel.id}?${params}`)
      if (result.success) {
        toast('success', 'Réservation annulée', `${confirmCancel.pg} le ${formatDate(confirmCancel.date)} à ${confirmCancel.time}`)
      } else {
        toast('error', 'Erreur', result.error || 'Erreur')
      }
      bookings.load()
      refreshDashboard()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
    }
    setConfirmCancel(null)
  }

  function handleSlotSearch(params: { date: string; from: string; to: string; duration?: number }) {
    setSlotSearchDate(params.date)
    setSlotSearchDuration(params.duration)
    slots.search(params)
  }

  async function handleBookSlot() {
    if (!confirmBookSlot) return
    try {
      const result = await slots.bookSlot({
        date: confirmBookSlot.date,
        startTime: confirmBookSlot.slot.startAt,
        duration: confirmBookSlot.slot.duration / 60,
        playgroundName: confirmBookSlot.slot.playground.name,
      })
      if (result.status === 'success') {
        toast('success', 'Réservation réussie', `${result.playground} à ${result.booked_time} le ${formatDate(result.target_date!)}`)
        bookings.load()
        if (slotSearchDate) slots.search({ date: slotSearchDate, from: '', to: '', duration: slotSearchDuration })
      } else {
        toast('error', 'Échec', result.error || 'Erreur')
      }
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
    }
    setConfirmBookSlot(null)
  }

  async function handleSaveAdvanceDays() {
    const val = advanceDaysValue
    if (isNaN(val) || val < 1 || val > 90) {
      toast('warning', 'Valeur invalide', 'Entre 1 et 90.')
      return
    }
    try {
      await api.put('/settings', { booking_advance_days: val })
      toast('success', 'Paramètre mis à jour', `Intervalle : J-${val}`)
      refreshDashboard()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
    }
    setAdvanceDaysOpen(false)
  }

  async function handleSaveSettings() {
    if (!settingsEmail || !settingsPassword) {
      setSettingsError('Veuillez remplir tous les champs.')
      return
    }
    setSettingsError('')
    setSettingsLoading(true)
    try {
      await api.put('/credentials', { email: settingsEmail, password: settingsPassword })
      toast('success', 'Identifiants mis à jour')
      setSettingsOpen(false)
      refreshDashboard()
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSettingsLoading(false)
    }
  }

  async function handleOpenSettings() {
    try {
      const status = await api.get<{ email?: string }>('/credentials/status')
      setSettingsEmail(status.email || '')
    } catch { /* ignore */ }
    setSettingsPassword('')
    setSettingsError('')
    setSettingsOpen(true)
  }

  async function handleDeleteLogs(ids: number[]) {
    try {
      await api.delete('/logs', { ids })
      toast('success', 'Historique nettoyé', `${ids.length} entrée${ids.length > 1 ? 's' : ''} supprimée${ids.length > 1 ? 's' : ''}.`)
      refreshDashboard()
    } catch (err) {
      toast('error', 'Erreur', err instanceof Error ? err.message : 'Erreur')
    }
  }

  // ===== Computed =====
  const activeRules = dashboard?.rules.filter((r) => r.enabled).length ?? 0
  const upcomingCount = bookings.status === 'upcoming' ? (bookings.data?.total ?? 0) : 0
  const advanceDays = dashboard?.config.advance_days ?? 45

  // ===== Render =====
  return (
    <>
      <div className="max-w-5xl mx-auto px-5 pb-16 max-sm:px-3 max-sm:pb-8">
        <Header onOpenSettings={handleOpenSettings} />

        {dashLoading && !dashboard ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : dashboard && (
          <>
            <StatsBar
              activeRules={activeRules}
              upcomingBookings={upcomingCount}
              advanceDays={advanceDays}
              onEditAdvanceDays={() => { setAdvanceDaysValue(advanceDays); setAdvanceDaysOpen(true) }}
            />

            {/* Rules */}
            <section className="mb-7">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-[17px] font-bold">Règles de réservation</h2>
                <Button onClick={() => { setEditingRule(null); setRuleFormOpen(true) }}>+ Nouvelle règle</Button>
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3.5 text-sm text-sky-900 mb-4 leading-relaxed">
                <strong>Fonctionnement du bot</strong>
                <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                  <li>Le scheduler se déclenche chaque jour à <strong>00:00</strong> et réserve les créneaux qui ouvrent à J-{advanceDays}</li>
                  <li>Si ta banque demande une confirmation 3DS, le bot attend jusqu'à <strong>5 minutes</strong></li>
                  <li>Le bot choisit le meilleur terrain disponible selon tes préférences</li>
                </ul>
              </div>

              {dashboard.rules.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">
                  Aucune règle configurée. Cliquez sur "+ Nouvelle règle" pour commencer.
                </p>
              ) : (
                <div className="grid gap-2.5">
                  {dashboard.rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onEdit={(id) => { setEditingRule(dashboard.rules.find((r) => r.id === id) ?? null); setRuleFormOpen(true) }}
                      onDelete={(id) => setConfirmDelete(id)}
                      onToggle={handleToggleRule}
                      onBookNow={handleBookNow}
                      bookingLoading={bookingRuleId === rule.id}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Manual booking */}
            <section className="mb-7">
              <h2 className="text-[17px] font-bold mb-3.5">Réservation manuelle</h2>
              <SlotSearch loading={slots.loading} onSearch={handleSlotSearch} />
              <SlotResults
                slots={slots.slots}
                showDuration={!slotSearchDuration}
                onBook={async (slot) => setConfirmBookSlot({ slot, date: slotSearchDate })}
              />
            </section>

            {/* Bookings */}
            <section className="mb-7">
              <h2 className="text-[17px] font-bold mb-3.5">Mes réservations</h2>
              <BookingsList
                data={bookings.data}
                loading={bookings.loading}
                status={bookings.status}
                page={bookings.page}
                onLoad={bookings.load}
                onCancel={(id, date, time, pg) => setConfirmCancel({ id, date, time, pg })}
                onRefresh={() => bookings.load()}
              />
            </section>

            {/* Logs */}
            <section className="mb-7">
              <h2 className="text-[17px] font-bold mb-3.5">Historique</h2>
              <LogsTable logs={dashboard.recent_logs} onDelete={handleDeleteLogs} />
            </section>
          </>
        )}
      </div>

      {/* Rule Form Dialog */}
      {dashboard && (
        <RuleForm
          open={ruleFormOpen}
          onClose={() => setRuleFormOpen(false)}
          onSave={handleSaveRule}
          rule={editingRule}
          config={dashboard.config}
        />
      )}

      {/* Delete Rule Confirm */}
      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteRule}
        title="Supprimer la règle ?"
        message="Cette action est irréversible."
        confirmLabel="Supprimer"
        confirmVariant="danger"
      />

      {/* Cancel Booking Confirm */}
      <ConfirmDialog
        open={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancelBooking}
        title="Annuler la réservation ?"
        message={confirmCancel ? `${confirmCancel.pg} le ${formatDate(confirmCancel.date)} à ${confirmCancel.time}. Le remboursement sera automatique.` : ''}
        confirmLabel="Annuler la réservation"
        confirmVariant="danger"
      />

      {/* Book Slot Confirm */}
      <ConfirmDialog
        open={confirmBookSlot !== null}
        onClose={() => setConfirmBookSlot(null)}
        onConfirm={handleBookSlot}
        title="Confirmer la réservation"
        message={confirmBookSlot ? `${confirmBookSlot.slot.playground.name} le ${formatDate(confirmBookSlot.date)} à ${confirmBookSlot.slot.startAt} (${confirmBookSlot.slot.duration / 60}min)` : ''}
        confirmLabel="Réserver"
        confirmVariant="success"
      />

      {/* Advance Days Dialog */}
      <ConfirmDialog
        open={advanceDaysOpen}
        onClose={() => setAdvanceDaysOpen(false)}
        onConfirm={handleSaveAdvanceDays}
        title="Intervalle de réservation"
        message={`Jours d'avance (1-90) : actuellement J-${advanceDaysValue}`}
        confirmLabel="Enregistrer"
      />
      {/* Note: The advance days dialog needs a number input — wrap ConfirmDialog or build a small custom dialog. For MVP, we can use a prompt or enhance ConfirmDialog. This will be refined during implementation. */}

      {/* Settings Dialog (Credentials) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-5 max-sm:items-end max-sm:p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative bg-white rounded-2xl max-sm:rounded-b-none p-7 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">Identifiants DoInSport</h3>
            <p className="text-sm text-slate-500 mb-5">Le login sera testé avant enregistrement.</p>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
              <input type="email" value={settingsEmail} onChange={(e) => setSettingsEmail(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mot de passe</label>
              <input type="password" value={settingsPassword} onChange={(e) => setSettingsPassword(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500" />
            </div>
            {settingsError && <div className="bg-red-50 text-red-700 px-3.5 py-2.5 rounded-lg text-sm mb-3">{settingsError}</div>}
            <div className="flex justify-end gap-2.5 mt-5 max-sm:flex-col-reverse">
              <Button variant="secondary" onClick={() => setSettingsOpen(false)}>Annuler</Button>
              <Button onClick={handleSaveSettings} loading={settingsLoading}>Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </>
  )
}
```

**Step 2: Verify build**

```bash
cd frontend && npm run build
```

**Step 3: Verify full app works**

In two terminals:

```bash
# Terminal 1: Backend
npm start

# Terminal 2: Frontend dev
cd frontend && npm run dev
```

Open `http://localhost:5173` — should show setup screen or dashboard depending on credentials state.

**Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: assemble App with all components and business logic"
```

---

## Task 16: Configure PWA with vite-plugin-pwa

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/package.json` (new dependency)

**Step 1: Install vite-plugin-pwa**

```bash
cd frontend && npm install vite-plugin-pwa -D
```

**Step 2: Update vite.config.ts**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Foot Du Lundi',
        short_name: 'Foot Du Lundi',
        description: 'Bot de réservation automatique pour les terrains de foot',
        start_url: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0f172a',
        orientation: 'any',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
})
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: Build produces `sw.js` (workbox), `manifest.webmanifest`, and asset files in `../public/`.

**Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: configure PWA with vite-plugin-pwa"
```

---

## Task 17: Update Dockerfile

**Files:**
- Modify: `Dockerfile`
- Modify: `.dockerignore`

**Step 1: Update Dockerfile to include frontend build stage**

Add a new first stage for building the React frontend. Update the runtime stage to copy from this new stage.

Insert before `Stage 1: Builder`:

```dockerfile
# ============================================================================
# Stage 0: Frontend Builder - Build React app
# ============================================================================
FROM node:24-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output is now at /app/public/
```

In `Stage 3: Runtime`, replace:

```dockerfile
COPY public/ public/
```

with:

```dockerfile
# Copy built frontend (from React build) + preserved static files
COPY --from=frontend-builder /app/public/ public/
# Copy stripe-confirm.html and icons (not part of React build)
COPY public/stripe-confirm.html public/icon.svg public/
```

**Step 2: Update `.dockerignore`**

Add `frontend/node_modules/` to `.dockerignore`:

```
frontend/node_modules/
frontend/dist/
```

**Step 3: Verify Docker build**

```bash
docker build -t foot-du-lundi-test .
```

Expected: All stages complete successfully.

**Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add frontend build stage to Dockerfile"
```

---

## Task 18: Clean up old frontend files

**Files:**
- Delete: `public/app.js`
- Delete: `public/style.css`
- Delete: `public/sw.js`
- Delete: `public/manifest.json`
- Delete: `public/index.html` (replaced by React build output)
- Modify: `.gitignore`

> **Important:** Keep `public/stripe-confirm.html` and `public/icon.svg` — they are NOT part of the React app.

**Step 1: Delete old vanilla frontend files**

```bash
rm public/app.js public/style.css public/sw.js public/manifest.json public/index.html
```

**Step 2: Add React build output to `.gitignore`**

The `public/` directory now contains build artifacts (from `npm run build` in frontend) plus a few static files. Add to `.gitignore`:

```
# React build output (generated by frontend/npm run build)
public/assets/
public/index.html
public/sw.js
public/manifest.webmanifest
public/registerSW.js
public/workbox-*.js
```

**Step 3: Build the frontend to populate public/**

```bash
cd frontend && npm run build
```

**Step 4: Verify Express serves the React app**

```bash
cd /Users/ataaki/Desktop/sdlv-booker && npm start
```

Open `http://localhost:3000` — should show the React app (setup screen or dashboard).

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old vanilla frontend, update gitignore for React build"
```

---

## Task 19: Final verification & polish

**Step 1: Test the full flow end-to-end**

1. Start backend: `npm start`
2. Open `http://localhost:3000`
3. Verify setup screen shows if no credentials
4. Verify credentials login works
5. Verify dashboard loads with stats, rules, bookings, logs
6. Verify rule CRUD (create, edit, toggle, delete)
7. Verify manual slot search and booking
8. Verify booking cancellation
9. Verify log deletion
10. Verify advance days setting
11. Verify responsive design on mobile viewport

**Step 2: Test Docker build**

```bash
docker build -t foot-du-lundi .
docker run --rm -p 3000:3000 foot-du-lundi
```

Verify the app works from the Docker container.

**Step 3: Test PWA installability**

Open Chrome DevTools > Application > Manifest — verify installability.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete React + Tailwind frontend migration"
```

---

## Summary of all tasks

| Task | Description | Key files |
|------|-------------|-----------|
| 1 | Scaffold Vite + React + TS | `frontend/*` |
| 2 | Configure Tailwind CSS v4 | `frontend/vite.config.ts`, `frontend/src/index.css` |
| 3 | Types & utilities | `frontend/src/types/`, `frontend/src/lib/` |
| 4 | API client | `frontend/src/api/client.ts` |
| 5 | UI primitives | `frontend/src/components/ui/Button,Badge,Spinner,Toggle` |
| 6 | Toast system | `frontend/src/hooks/use-toast.tsx`, `Toast.tsx` |
| 7 | ConfirmDialog | `frontend/src/components/ui/ConfirmDialog.tsx` |
| 8 | API hooks | `frontend/src/hooks/use-*.ts` |
| 9 | Layout (Header, StatsBar) | `frontend/src/components/layout/` |
| 10 | Rules components | `frontend/src/components/rules/` |
| 11 | Bookings + Pagination | `frontend/src/components/bookings/` |
| 12 | Manual booking | `frontend/src/components/manual/` |
| 13 | LogsTable | `frontend/src/components/logs/` |
| 14 | SetupScreen | `frontend/src/components/setup/` |
| 15 | App.tsx assembly | `frontend/src/App.tsx` |
| 16 | PWA config | `frontend/vite.config.ts` |
| 17 | Dockerfile update | `Dockerfile`, `.dockerignore` |
| 18 | Cleanup old frontend | `public/*`, `.gitignore` |
| 19 | Final verification | E2E testing |
