# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at localhost:4321
npm run build      # Production SSR build
npm run preview    # Preview production build locally
```

No test suite exists yet.

## Tech Stack

- **Astro 4** in SSR/server mode (Node.js standalone adapter) — not static output
- **better-sqlite3** — synchronous SQLite, single file `vocab.db` in project root
- **Tailwind CSS 3** with a custom `flip` keyframe animation for the flashcard
- **Vanilla JS only** — no React/Vue; interactivity via Astro inline `<script>` tags
- **TypeScript** in strict mode; path alias `@/*` → `src/*`

## Architecture

### Data layer (`src/lib/`)

- `db.ts` — SQLite singleton (`getDb()`), all query functions, and TypeScript types (`Word`, `Progress`, `WordWithProgress`, `UserStats`, `MasteryBreakdown`). The DB is created and migrated with `CREATE TABLE IF NOT EXISTS` on first call.
- `srs.ts` — SM-2 spaced repetition algorithm. Quality values: `0` (missed), `2` (hard), `3` (good), `5` (easy). Returns `{ interval_days, ease_factor, next_review, mastery }`.
- `seed.ts` — One-time bulk insert of the 320 words from `src/data/words.ts`, wrapped in a transaction. Called via `seedIfEmpty()` on page load.
- `levels.ts` — Maps level codes to display labels and Tailwind color classes.

### Study session flow

1. Dashboard calls `seedIfEmpty()`, then queries stats and due counts to render CTAs.
2. **POST `/api/queue`** inserts progress rows for unlearned words (by count and/or level), setting `next_review = today`.
3. **GET `/study?card=N`** renders the `Flashcard` component for card N of the session's due words.
4. User flips, rates → client sends **POST `/api/answer`** `{ progressId, quality }` → SRS computed, DB updated → response contains `nextUrl`.
5. **GET `/api/session`** is a pure redirect: advances to next card or, when done, calls `updateStreakOnSessionEnd()` and redirects to `/study?done=1`.

Session state lives entirely in URL query params (`card`, `reviewed`, `correct`); there is no client-side state store.

### Database schema (3 tables)

| Table | Key columns |
|---|---|
| `words` | `id`, `word`, `definition`, `part_of_speech`, `example`, `level` |
| `progress` | `word_id` (FK), `mastery` (0–5), `ease_factor`, `interval_days`, `next_review`, `times_seen`, `times_correct` |
| `user_stats` | Singleton row (id=1): `current_streak`, `longest_streak`, `last_study_date`, `total_reviewed`, `total_correct` |

### Pages & API routes

| Path | File | Notes |
|---|---|---|
| `/` | `pages/index.astro` | Dashboard |
| `/study` | `pages/study.astro` | Flashcard session + done screen |
| `/words` | `pages/words.astro` | Word browser; client-side search/filter |
| `/word-of-the-day` | `pages/word-of-the-day.astro` | Deterministic daily word (day-of-year % total) |
| `/parts-of-speech` | `pages/parts-of-speech.astro` | Reference page |
| `/api/answer` | POST | Submit flashcard rating |
| `/api/queue` | POST | Add words to study queue |
| `/api/session` | GET | Redirect-only session advance/end handler |
