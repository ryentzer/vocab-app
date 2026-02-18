# VocabUp

A personal vocabulary-building web app that takes you from an 8th-grade vocabulary to a college/advanced level using spaced-repetition flashcards.

Built with **Astro 4**, **SQLite**, and **Tailwind CSS**.

---

## Features

### Flashcard Study Sessions
Study words using a flip-card interface. After revealing the definition and example sentence, rate your recall:
- **Missed** — didn't know it
- **Hard** — knew it with difficulty
- **Good** — knew it comfortably
- **Easy** — knew it instantly

Each rating updates the word's schedule using the **SM-2 spaced repetition algorithm**, so words you struggle with come back sooner and words you've mastered fade into the background.

### Spaced Repetition (SM-2)
Words are scheduled based on your performance. The algorithm tracks:
- **Interval** — days until next review
- **Ease factor** — how quickly the interval grows
- **Mastery level** — 0 (new) through 5 (mastered)

### Dashboard
At a glance:
- Current and longest **day streak**
- Number of **words due today**
- **Mastery breakdown** — New / Learning / Mastered progress bar
- All-time accuracy stats

### Select Words to Study
You choose what enters your queue:
- **Browse page** — click `+ Queue` on any word to add it to today's session
- **Dashboard** — add batches of 5, 10, or 20 new words at once
- **By level** — add all unlearned words from a specific grade tier

### Word of the Day
A new featured word every day, deterministically selected by date. Includes the full definition, part of speech, and an example sentence. One click adds it to your study queue.

### Word Browser
Search and filter the full 320-word list by level or mastery status. Click any row for a detail view with a queue button.

### Streak Tracking
Studies consecutive days to maintain a streak. Miss a day and it resets. Your longest streak is always saved.

---

## Word List

320 curated words organized into four levels:

| Level | Count | Description |
|---|---|---|
| **Grades 6–8** | ~42 | Foundational vocabulary for strong middle-school reading |
| **Grades 9–10** | ~48 | High school academic vocabulary |
| **SAT / 11–12** | ~88 | Words commonly tested on the SAT and ACT |
| **GRE** | ~142 | Graduate-level and literary vocabulary |

---

## Tech Stack

- **[Astro 4](https://astro.build)** — SSR framework (`output: 'server'`, `@astrojs/node` adapter)
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — fast, synchronous SQLite for progress persistence
- **[Tailwind CSS](https://tailwindcss.com)** — utility-first styling
- Vanilla JS for flashcard flip interactions

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
# → http://localhost:4321
```

The SQLite database (`vocab.db`) is created and seeded automatically on first run. It is gitignored.

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

---

## Project Structure

```
src/
├── pages/
│   ├── index.astro           # Dashboard
│   ├── study.astro           # Flashcard study session
│   ├── word-of-the-day.astro # Daily featured word
│   ├── words.astro           # Browse / search all words
│   └── api/
│       ├── answer.ts         # POST — submit flashcard rating
│       ├── queue.ts          # POST — add words to study queue
│       └── session.ts        # GET  — advance card or end session
├── components/
│   ├── Flashcard.astro       # Flip card + rating buttons
│   ├── StatsBar.astro        # Streak + mastery summary
│   └── WordRow.astro         # Row in word browser table
├── lib/
│   ├── db.ts                 # SQLite singleton + all queries
│   ├── srs.ts                # SM-2 spaced repetition algorithm
│   ├── seed.ts               # One-time DB seed
│   └── levels.ts             # Level labels and colors
└── data/
    └── words.ts              # 320 curated words with definitions
```
