# Design : Migration Frontend React + Tailwind CSS

**Date** : 2026-02-13
**Status** : Approuvé

## Contexte

Le frontend actuel de Foot Du Lundi est un monolithe vanilla HTML/CSS/JS (~1080 lignes JS, ~1670 lignes CSS, ~214 lignes HTML). L'objectif est de migrer vers React + TypeScript + Tailwind CSS avec un redesign complet de l'interface.

## Décisions

| Décision | Choix |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| CSS | Tailwind CSS v4 |
| UI Components | Headless UI |
| Drag & Drop | @dnd-kit/core |
| PWA | vite-plugin-pwa |
| Serving | Express sert le build statique |
| Design | Redesign complet |
| Structure | Dossier `frontend/` séparé avec son propre `package.json` |
| State management | useState/useEffect + React Context (toasts, config) |
| Data fetching | Fetch natif wrappé dans `api/client.ts` |
| Routing | Pas de router — conditional rendering (Setup vs Dashboard) |

## Architecture

```
sdlv-booker/
├── frontend/                    # React app
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts        # GET/POST/PUT/DELETE wrapper
│       ├── hooks/
│       │   ├── use-dashboard.ts
│       │   ├── use-bookings.ts
│       │   ├── use-rules.ts
│       │   ├── use-slots.ts
│       │   └── use-toast.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.tsx
│       │   │   └── StatsBar.tsx
│       │   ├── rules/
│       │   │   ├── RuleCard.tsx
│       │   │   ├── RuleForm.tsx
│       │   │   └── PlaygroundPrefs.tsx
│       │   ├── bookings/
│       │   │   ├── BookingsList.tsx
│       │   │   └── Pagination.tsx
│       │   ├── manual/
│       │   │   ├── SlotSearch.tsx
│       │   │   └── SlotResults.tsx
│       │   ├── logs/
│       │   │   └── LogsTable.tsx
│       │   ├── ui/
│       │   │   ├── Button.tsx
│       │   │   ├── Badge.tsx
│       │   │   ├── Toast.tsx
│       │   │   ├── ConfirmDialog.tsx
│       │   │   ├── Toggle.tsx
│       │   │   └── Spinner.tsx
│       │   └── setup/
│       │       └── SetupScreen.tsx
│       ├── lib/
│       │   ├── constants.ts
│       │   └── format.ts
│       └── types/
│           └── index.ts
├── src/                         # Backend Express (inchangé)
├── public/                      # ← Output du build React
│   └── stripe-confirm.html      # Conservé (utilisé par Playwright)
├── package.json                 # Backend dependencies
└── Dockerfile
```

## Design System

### Palette

Tailwind natif, pas de variables CSS custom :
- **Brand** : `slate-900` (header, textes principaux), `sky-500` (accents, liens)
- **Success** : `emerald-500` (confirmé, réserver)
- **Danger** : `red-500` (annuler, supprimer)
- **Warning** : `amber-500` (indispo, doublon)
- **Fond** : `slate-50` (bg), `white` (cards)
- **Texte** : `slate-900` (principal), `slate-500` (secondaire), `slate-400` (muted)

### Composants Headless UI

- `Dialog` : modals (confirm, credentials, advance days, rule form)
- `Switch` : toggle on/off des règles
- `Listbox` : selects custom (jour, durée)
- `Transition` : animations entrée/sortie
- `TabGroup` : onglets upcoming/past des bookings

### Composants custom

- **Button** : variantes primary/secondary/danger/success/ghost/icon + loading state
- **Badge** : variantes par status
- **Toast** : container fixe + animations via React Context
- **Pagination** : numéros, prev/next, ellipsis
- **PlaygroundPrefs** : drag & drop via @dnd-kit/core

## Intégration Backend

### Proxy dev (Vite)

```ts
// vite.config.ts
server: {
  proxy: { '/api': 'http://localhost:3000' }
},
build: {
  outDir: '../public',
  emptyOutDir: true
}
```

### Changements Express

- `server.js` continue de servir `express.static('public')`
- `stripe-confirm.html` reste dans `public/` (hors React)
- Ajout fallback SPA : `app.get('*', (req, res) => res.sendFile('index.html'))`

### Dockerfile

Ajout d'un stage de build frontend :

```dockerfile
# Stage 0: Build frontend
FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stages suivants : copier public/ depuis frontend-builder
COPY --from=frontend-builder /app/public public/
```

### PWA

`vite-plugin-pwa` gère :
- Service Worker (Workbox)
- manifest.json
- Icônes

## Workflow de développement

```bash
# Terminal 1 : Backend Express
npm start

# Terminal 2 : Frontend React (HMR)
cd frontend && npm run dev
```

En production / Docker : seul le build statique est servi par Express.

## API Endpoints consommés

Le frontend React consomme exactement les mêmes endpoints que le frontend actuel :

- `GET /api/credentials/status`
- `PUT /api/credentials`
- `GET /api/dashboard`
- `GET /api/rules` / `POST` / `PUT` / `DELETE`
- `GET /api/bookings?status=&page=&limit=`
- `DELETE /api/bookings/:id`
- `POST /api/book-now`
- `POST /api/book-manual`
- `GET /api/slots`
- `GET /api/logs`
- `DELETE /api/logs`
- `GET /api/settings`
- `PUT /api/settings`

Aucun changement backend requis.
