# 2026 Soccer World Cup Pot Pick Game

A tablet-friendly local web app for a workplace World Cup pot-pick game.

## Features

- Four 2026 World Cup pots with the supplied teams
- Add co-workers as players, including pasting multiple names at once
- Import names from `players.txt`
- Each player chooses one team from Pot 1, Pot 2, Pot 3, and Pot 4
- Each player can be locked individually once their own four teams are chosen
- Locked picks cannot be changed unless admin mode is enabled
- Admin mode can unlock picks and select the winning team for each pot
- Winners are shown per pot based on the saved player picks
- State is saved in the browser with `localStorage`
- Optional Supabase sync for shared choices across devices

## Usage

1. Open `index.html` in a browser on the tablet.
2. Click `Import players.txt` to load the names from `players.txt`, or use `Add players` to paste names manually.
3. Select a player and choose one team from each pot.
4. Click `Lock [player name]` once that player has chosen all four teams. Other players can stay open.
5. Click `Admin mode` and enter `1234` to unlock picks or edit results.
6. In `Pot Results`, select the winning team for each pot as the tournament progresses.

## Supabase Setup

1. In Supabase, open the SQL editor and run `supabase-schema.sql`.
2. Confirm `supabase-config.js` contains the project URL and publishable key.
3. Commit and push any config changes.

The app runs at `https://jonathandevoypcd.github.io/soccermash/` once GitHub Pages is enabled for this repo.

## Files

- `index.html` - main page
- `styles.css` - tablet-friendly styling
- `app.js` - game logic and browser storage
- `supabase-config.js` - Supabase browser client configuration
- `supabase-schema.sql` - database table and row-level security policies
- `README.md` - setup and usage notes
