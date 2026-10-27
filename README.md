# Circus Clowns 🤡🎪

A one-tap circus game, sister game of Circus Dogs. The clown starts standing on a circus ball, and more
balls of different sizes roll in, each at its own speed. **Quick tap = small hop, hold longer = higher jump.**
Jump onto the coming ball and ride it, then jump to the next one. Once in every 5 balls, at a random moment, a very fast ball comes: a blinking "!" warns you at the right edge first, and the ball has speed streaks behind it.

Obstacles (all of them can appear from the very first point; the game gets faster as the score grows):
- hanging rings of fire swing in, in different sizes and heights, always above the clown. Jump through them. Touching the flames = game over.
- a tiny bouncing ball. Never touch it, and you cannot stand on it: jump over it or let it bounce past.
- two tiny bouncing balls in a row.
- two rings of fire in a row.
- now and then a **spiky ball** (dark, with metal spikes) rolls in first with a normal ball right behind it. Never land on it or touch it: jump over it onto the ball behind.
- a **cannon** at the right edge blinks "!" and beeps, then fires a **human cannonball** straight across at leg/body height. Jump over it.
- Everything speeds up a lot after 5 points, then a bit more every 5 points ("FASTER!").

The clown falls and cries (sad trombone) when a ball bumps the ball he is standing on, when he lands
too far on the side of a ball, runs into a ball, misses and falls to the floor, touches a ring of fire
or a tiny bouncing ball. Landing right on top of a ball shows **PERFECT!**.
Each ball landed, ring passed and tiny ball dodged = 1 point and 1 coin.

- Every clown juggles while balancing on the ball, each with its own things (balls, pins, rings, cupcakes, rubber ducks, teacups, cream pies ...; the mime only pretends).
- Every clown says a quick **"Oops!"** on each jump, in a voice that fits its personality (squeaky, grumpy, posh, dreamy, wild ...). The voices are real spoken recordings in `www/sounds/oops-<clown>.wav`.
- Portrait game with an **AdMob banner at the top** (see *Ads* below).
- Circus march background music, purple tent (music and sound buttons in the top-right).
- **Clown Shop:** 35 clowns, priced like the Circus Dogs shop: the free Giggles, then 29 clowns from 100 coins,
  each 20 more than the last (Sunny, Bubbles, Domino the Pierrot, Patches the hobo, Harlequin, Jester ... up to 660),
  and 5 special clowns, each 50 more than the last (Grumbles 710, Tickles 760, Sir Bumble 810, Mayhem 860, Starlight 910). Different suits, wigs, hats, make-up, juggling and voices. Full list and prices in `www/clowns.js`.
- Share your score from the Game Over card (phone share menu with a score picture).
- Best score, coins and unlocked clowns are saved on the phone.

## Adding or changing clowns

All clowns live in **`www/clowns.js`**. Each entry sets the name, price, look (suit, pattern, wig, hat, make-up...)
and voice. To use **real recordings or your own art** instead of the built-in ones:

1. Put the files in `www/sounds/` and `www/images/`
2. In that clown's `files` line, point to them:
   ```js
   files: { oops: 'sounds/oops-sunny.wav', cry: 'sounds/sunny-cry.mp3', gameOver: 'images/sunny-cry.png' }
   ```
Any file left as `null` (or that fails to load) falls back to the built-in sound or drawing.
Every clown uses the same hitbox size, so no clown is easier than another.

## Ads (AdMob)

Settings are in **`www/ads-config.js`**. ⚠️ It currently holds **Google's sample ids** (test ads only).
Create a *Circus Clowns* app and a banner ad unit in AdMob and paste the real ids there before the
Play Store release. The **debug APK always shows Google test ads**; the **release AAB/APK uses the ids in the file**.

## How the Android app is built

Everything runs on GitHub; nothing needs to be installed on your computer.

1. The web game is in `www/` (`index.html` + `game.js` + `clowns.js`).
2. On every push to `main`, the **Build Android app** workflow (Actions tab):
   - wraps the game with Capacitor (`npx cap add android`)
   - runs `scripts/android-setup.py` (portrait, fullscreen, AdMob app id, app icon from `resources/app-icon.png`, version number)
   - builds the APK and AAB
3. Open **Actions → latest run → Artifacts → `circus-clown-android`** to download:
   - `circus-clown-debug-TEST-ADS.apk`: install directly on a phone for testing
   - `playstore-icon-512.png`: the icon for the Play Console
   - `circus-clown-release.aab` / `.apk`: only when the signing secrets below are set

## Signed release for Google Play (optional)

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | your `.jks`/`.keystore` file, base64-encoded |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias |
| `KEY_PASSWORD` | key password (can be the same as the keystore password) |

App ID: `com.alxmobileapps.circusclown`

## Before publishing

- Real AdMob ids in `www/ads-config.js`
- A Circus Clowns privacy policy page, then set `PRIVACY_URL` in `www/game.js`
