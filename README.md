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
- **Champions League.** 32 clubs play in 8 groups of 4, home and away. The top two in each group reach the Round of 16, which is followed by two-legged quarter-finals and semi-finals. The final is a single match at a neutral ground. Level ties go to extra time and then penalties. The group draw keeps clubs from the same country or league apart. The top 3 of the Kronliga's final table qualify for the next season. The rest of the field are real European clubs such as Real Madrid, Man City, Bayern, PSG and Arsenal, with real names, colours, countries and stadiums. Ratings are approximate, and badges are original designs in club colours. Squads are generated. Every club can be edited.
- **Division 2.** 20 Geko clubs below Kronliga. Daffers Cup winners went in automatically, and the rest were the clubs with the most all-time Daffers Cup points. Kronliga's bottom 3 go down and Division 2's top 3 go up each season. Division 2's bottom 3 drop out of the leagues and are replaced by the non-league clubs that went furthest in the last Daffers Cup, so there are always 40 league clubs out of 100. Division 2 plays automatically whenever you play Kronliga.
- **Daffers Cup.** A knockout for all 100 clubs in the made-up country of Geko, played as one match per tie with extra time and penalties if level. The 12 smallest non-league clubs start in Round 1. Division 2 joins in Round 2, and Kronliga and the 14 strongest non-league clubs join in Round 3, so every round is full. The final is at the Geko National Stadium.
- **Win game.** Available in any league or cup: type part of a team's name, pick it, and it wins its next match, next 3, or every match. The game chooses the score.
- **Sim match (FIFA-style).** Watch a match play out live, with a running clock, ball and momentum on a pitch, goal pop-ups, an event feed and live stats. You can pause, change speed (1x to 8x) or skip to the result.
- **Auto play.** Pick which competitions to include and a speed (Slow, Normal, Fast or Turbo), then tap Start. Matchdays keep playing in turn, optionally into new seasons, while you browse. A bar shows live results and has a Stop button.
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
