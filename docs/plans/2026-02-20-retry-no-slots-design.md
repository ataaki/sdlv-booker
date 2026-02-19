# Design: Retry sur absence de slots

**Date:** 2026-02-20
**Statut:** Approuvé

## Contexte

Quand le scheduler tente une réservation et qu'aucun slot n'est disponible (`no_slots`), la tentative échoue définitivement. L'utilisateur veut pouvoir configurer un retry automatique par règle, avec une escalade progressive des délais.

## Périmètre

- Retry uniquement sur le statut `no_slots` (pas les erreurs paiement/API)
- Configuration par règle (pas globale)
- Nombre de retries potentiellement infini
- Délais progressifs via une liste d'étapes éditables

## Modèle de données

### Modification `booking_rules`

```sql
ALTER TABLE booking_rules ADD COLUMN retry_config TEXT DEFAULT NULL;
```

Format JSON :
```json
[
  {"count": 5, "delay_minutes": 5},
  {"count": 5, "delay_minutes": 10},
  {"count": 0, "delay_minutes": 60}
]
```

- `count = 0` = infini (boucle indéfiniment sur cette étape)
- `delay_minutes` = délai entre chaque tentative dans l'étape
- `retry_config = null` = pas de retry (comportement actuel)

### Nouvelle table `retry_queue`

```sql
CREATE TABLE IF NOT EXISTS retry_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  target_date TEXT NOT NULL,
  target_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  activity TEXT NOT NULL,
  playground_order TEXT,
  retry_config TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  attempts_in_step INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rule_id) REFERENCES booking_rules(id)
);
```

Statuts : `active`, `success`, `exhausted`, `cancelled`

### Migration

Version v3 dans le système de migrations existant.

## Logique d'exécution (Scheduler)

Le cron existant (chaque minute) ajoute une vérification :

```
Chaque minute :
  1. [existant] Vérifier les règles dont trigger_time == maintenant
  2. [nouveau]  Vérifier retry_queue WHERE status='active' AND next_retry_at <= maintenant
```

### Création d'un retry

Quand un booking échoue avec `no_slots` et que `rule.retry_config` est non-null :
1. Créer une entrée `retry_queue` avec `current_step=0`, `attempts_in_step=0`
2. Calculer `next_retry_at = now + retry_config[0].delay_minutes`

### Traitement d'un retry

1. Relancer `findAndBookSlot` avec les paramètres du retry
2. Si **succès** → statut `success`, log succès, notification Telegram
3. Si **encore `no_slots`** :
   - Incrémenter `attempts_in_step` et `total_attempts`
   - Si `count > 0` et `attempts_in_step >= count` → `current_step++`, `attempts_in_step = 0`
   - Si plus d'étapes → statut `exhausted`, notification Telegram
   - Sinon → calculer `next_retry_at` selon delay de l'étape courante

## Interface utilisateur

### RuleForm — Section "Retry si aucun slot"

- Toggle ON/OFF pour activer le retry
- Liste d'étapes éditables (quand activé) :
  - Chaque étape : nombre de tentatives (0 = ∞) + délai (nombre + unité min/h)
  - Bouton "+ Ajouter une étape"
  - Bouton × pour supprimer une étape
- Résumé textuel du comportement configuré

### RuleCard — Indicateur retry actif

- Badge "Retry en cours" avec compteur (ex: "Tentative 3/5 — étape 1/3")
- Bouton pour annuler le retry en cours

## Fichiers impactés

### Backend
- `src/db/database.js` — migration v3, fonctions CRUD retry_queue
- `src/scheduler/scheduler.js` — logique retry dans le cron
- `src/services/booking.js` — intégration retry après no_slots
- `src/routes/api.js` — endpoints retry_queue (GET, DELETE/cancel)
- `src/utils/validators.js` — validation retry_config
- `src/constants.js` — constantes RETRY_STATUS
- `src/services/logging.js` — logs retry
- `src/services/telegram.js` — notifications retry

### Frontend
- `frontend/src/types/index.ts` — types RetryStep, RetryConfig, RetryQueue
- `frontend/src/components/rules/RuleForm.tsx` — section retry config
- `frontend/src/components/rules/RuleCard.tsx` — badge retry actif
- `frontend/src/components/rules/RetryStepsEditor.tsx` — nouveau composant liste d'étapes
- `frontend/src/hooks/use-rules.ts` — gestion retry_config dans CRUD
- `frontend/src/hooks/use-dashboard.ts` — inclure retry_queue actifs
