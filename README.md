# 2026 Soccer World Cup Pot Pick Game

A tablet-friendly local web app for a workplace World Cup pot-pick game.

## Features

- Four 2026 World Cup pots with the supplied teams
- Add co-workers as players, including pasting multiple names at once
- Import names from `players.txt`
- Each player chooses one team from Pot 1, Pot 2, Pot 3, and Pot 4
- Picks can only be locked once all four teams are chosen
- Locked picks cannot be changed unless admin mode is enabled
- Admin mode can unlock picks and select the winning team for each pot
- Winners are shown per pot based on the saved player picks
- State is saved in the browser with `localStorage`

## Usage

1. Open `index.html` in a browser on the tablet.
2. Click `Import players.txt` to load the names from `players.txt`, or use `Add players` to paste names manually.
3. Select a player and choose one team from each pot.
4. Click `Lock picks` once all four teams are chosen.
5. Click `Admin mode` and enter `2026soccer` to unlock picks or edit results.
6. In `Pot Results`, select the winning team for each pot as the tournament progresses.

## Files

- `index.html` - main page
- `styles.css` - tablet-friendly styling
- `app.js` - game logic and browser storage
- `README.md` - setup and usage notes
