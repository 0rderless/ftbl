# ftbl

A football league simulator that runs in the browser and installs on iPhone as a home-screen app.

You can create fictional clubs with their own badges and kits, add players, set up leagues and simulate seasons. Results come from a statistical match engine based on a Poisson goal model.

## Use it on iPhone

1. Open the published site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Launch **ftbl** from the home screen. It opens full screen and also works offline.

Every change is saved on the device first (IndexedDB), then uploaded to the Firebase Realtime Database under `ftbl/` a couple of seconds later. If the app is opened on another device, it loads the newest copy. The app also works offline and uploads once it's back online. There is no login.

To protect your data:
- A device with no data never overwrites the cloud. It downloads the cloud copy instead.
- When copies differ, the most recently saved one wins, and the other is kept as a backup.
- Import, restore and reset each keep a backup first.

Backups are listed under **Sim → Data & app → Backups** and can be restored from there. **Export backup** also downloads a JSON file.

## Features

- **Match engine.** Expected goals for each side are built from attack, midfield, defence, goalkeeper, opponent quality, home advantage, recent form, player availability, fatigue and tactical match-ups. Each match then adds random performance swings and overdispersion. The scoreline is drawn from a Poisson score matrix with a draw adjustment, and goals, assists, cards, injuries, substitutions and statistics are generated to fit that score.
- **Simulation settings.** There are 14 settings and 4 presets: Realistic, Balanced, Unpredictable and Custom. A built-in tester runs 2,400 matches with your current settings.
- **Club creator.** Name, abbreviation, founding year and colours. The badge designer has 28 presets, 14 shapes, 17 patterns and 31 emblems. Base, pattern, emblem and trim colours, text, trim style and stars above the badge can all be changed. Each club has home, away and third kits in 13 styles, plus a stadium, ratings and tactics.
- **Line-up editor.** On a club's Squad tab, switch to **My line-up** and tap a position to choose the player. You can also pick formation and up to 9 substitutes. Matches use your XI. If a chosen player is injured or suspended, one of your substitutes covers that match.
- **Player creator.** Nationality, age, position, attributes, overall rating, shirt number, preferred foot and club. Full squads can be generated automatically.
- **League creator.** Choose the clubs and a season length of 1 to 4 meetings per pair. Fixtures are generated automatically. You can set points per result, the tiebreaker, rest days between matchdays, and the champion, continental, promotion and relegation places. Leagues can be linked so clubs move up and down between divisions. Seeds can be random or fixed.
- **Champions League.** 32 clubs play in 8 groups of 4, home and away. The top two in each group reach the Round of 16, which is followed by two-legged quarter-finals and semi-finals. The final is a single match at a neutral ground. Level ties go to extra time and then penalties. The group draw keeps clubs from the same country or league apart. The top 3 of the Kronliga's final table qualify for the next season. The rest of the field are fictional continental clubs, which can be edited.
- **Simulation.** Play one match, a whole matchday or the rest of the season. Each match report has a timeline, statistics, line-ups on a pitch with player ratings, and pre-match win probabilities.
- **Football world.** Tables (overall, home and away), top scorers, assists, ratings, clean sheets, cards, team stats, form guides, season history, previous champions, league, club and player records, a trophy cabinet and player awards.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, PWA manifest, offline cache
js/engine/    match engine (no UI code): params.js, strength.js, tactics.js, poisson.js, match.js
js/league/    fixtures, tables, seasons, promotion/relegation, records
js/data/      data model, name pools, squad generator, demo world
js/core/      seeded RNG, persistent store, storage adapters, cloud sync (Firebase), validated world actions
js/ui/        app shell, router, components, badge and kit renderers, views/
tests/        unit tests (node:test) and an end-to-end browser test
```

The simulation settings are defined in `js/engine/params.js`. The UI builds its controls from those definitions, and the engine only reads the numbers returned by `resolveParams()`. The engine can therefore be tuned without changing the interface.

## Development

There is no build step. Any static file server will run it:

```
npm run serve        # http://localhost:8080
npm test             # engine, settings, league, storage and action tests (10,000+ simulated matches)
npm run test:e2e     # drives the real app in a mobile browser (needs Playwright + Chromium)
npm run build:sw     # refresh the offline cache list after changing files
```
