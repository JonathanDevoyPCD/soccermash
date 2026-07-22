# SuperRuck 2027 - Rugby World Cup Predictor

A tablet-friendly web app for a workplace Rugby World Cup 2027 predictor game, in the style of
Superbru: every player predicts the score of every match, all tournament long.

## Features

- All 52 Rugby World Cup 2027 fixtures (Australia, 1 Oct - 13 Nov 2027), pool stage teams pre-loaded,
  knockout rounds filled in by admin as the draw resolves
- Each player signs in with a one-time email code (no shared password for players) and predicts a
  score for every match
- Predictions lock automatically at kickoff and other players' picks are hidden until then
- Every player's prediction on every match is its own database row, so two players saving at the same
  time never overwrite each other
- Scoring, Superbru-style: Win Point (correct winner), Margin Point (within 5 of the actual margin),
  Bonus Point (closest margin on that match), Grand Slam bonus (every match in a round correct)
- Live leaderboard, updated as admin enters results
- Admin mode enters match results, edits knockout team names once they're known, and adds players
- Optional Supabase sync so everyone shares the same live state across devices

## Usage

1. Open `index.html` in a browser (or visit the GitHub Pages URL below).
2. Enter your email, then the 6-digit code that gets emailed to you.
3. First time signing in: pick your name from the roster (or add it if it's missing).
4. Predict a score for each upcoming match before it kicks off - predictions lock automatically at
   kickoff.
5. Click `Admin mode` and enter `1234` to enter match results or edit knockout team names as rounds
   are decided.

## Supabase Setup

1. In Supabase, open the SQL editor and run `supabase-schema.sql`. This creates the `players`,
   `matches` and `predictions` tables, sets up row-level security, and seeds the roster + fixtures.
2. In Authentication settings, confirm the email template used for one-time codes includes `{{ .Token }}`
   so players receive a 6-digit code (not just a magic-link URL).
3. Confirm `supabase-config.js` contains the project URL and publishable key.
4. Commit and push any config changes.

The app runs at `https://jonathandevoypcd.github.io/SuperRuck2027/` once GitHub Pages is enabled for
this repo.

## Files

- `index.html` - main page
- `styles.css` - tablet-friendly styling
- `app.js` - game logic, auth, scoring and Supabase sync
- `supabase-config.js` - Supabase browser client configuration
- `supabase-schema.sql` - database tables, row-level security policies, and seed data
- `players.txt` - historical seed list (already migrated into `supabase-schema.sql`); not read by the app
- `README.md` - setup and usage notes
