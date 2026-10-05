# Commander Randomizer

Mobile-first web app that randomizes Magic: The Gathering Commander pods (tables) for a group that plays several rounds in a night. Everything is shared in real time through Firestore, so everyone sees the same roster, attendance and history.

Live: https://victoralbenor.github.io/commander-randomizer/

## How it works

- **Roster** – shared list of players. Anyone can add or remove people and it updates for everyone.
- **Present** – shared attendance toggles for who is playing.
- **Tables** – randomizes everyone present into tables. Pairings come from the **whole shared history**, so people who have sat together the least are seated together first, and repeats are avoided across rounds, not just against the last one. Players whose table number changed since the previous roll are highlighted.
- **Manual round** – for games started as people arrive: add the tables by hand and save them as a played round. They count as history, so the next randomize avoids repeating those pairings.
- **Sit together** – group players (e.g. a newcomer and the friends they brought) so they share a table in the next randomize only. The group is cleared after the roll; the pairs it forces cost nothing, and the resulting table counts as normal history.
- **History** – every roll is saved in Firestore and never edited or deleted, so the record stays consistent for fairness.

The pairing logic lives in `src/lib/pairing.js` (pure functions, unit-tested).

## Setup

```bash
npm install
```

Create `.env.local` with your Firebase web app config:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Enable **Anonymous** sign-in in Firebase Authentication and publish the rules in [`firestore.rules`](firestore.rules).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the pairing unit tests (`node --test`) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run deploy` | Build and publish to GitHub Pages (`gh-pages` branch) |

## Data model (Firestore)

- `players/{id}` – `{ name, isPresent }`
- `rolls/{id}` – `{ createdAt, tables: [{ manual, players: [{ id, name }] }] }`, append-only

## Deployment

`.github/workflows/deploy.yml` tests, lints, builds and publishes `main` to GitHub Pages on every push (`npm run deploy` still works for manual publishing). It needs the six `VITE_FIREBASE_*` values as repository secrets.

Other branches are built by `.github/workflows/preview.yml` and published under `/preview/<branch>/` (e.g. `https://victoralbenor.github.io/commander-randomizer/preview/together-groups/`).
