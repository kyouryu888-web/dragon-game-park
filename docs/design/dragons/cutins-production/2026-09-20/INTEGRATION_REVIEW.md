# Dragon reaction and cut-in integration record

The user approved the art direction and the revised UNO placement on 2026-09-26. The revised placement uses a small white circular portrait with a thin green border near each CPU seat and a compact outlined speech bubble. Existing card faces, board, hand, action text, and cut-in animation remain authoritative.

## Assets

- 30 transparent reaction portraits: `src/assets/dragons/reactions/lv1` through `lv5`, six emotions per level.
- 30 lightweight 192×192 transparent portraits for the seat wipe: `src/assets/dragons/reactions/display/lv1` through `lv5`.
- 20 transparent cut-ins (five levels × attack, pressure, victory, defeat): `src/assets/dragons/cutins/master/lv1` through `lv5`, 1536×1024.
- 20 900×1200 transparent fits of those cut-ins for UNO's existing portrait frame: `src/assets/dragons/cutins/uno`. This only fits the same art within that frame; it does not alter overlay timing or text.

`prompts-*.json` record generation prompts and references. `approval.json`, `producer-review-lv1-lv2.json`, and `provenance-advanced.json` retain the production trail. No Adobe app was used for transparency or export.

## Independent asset review

On 2026-09-26, the integration lead visually inspected all 20 cut-ins on white and dark backgrounds using `all-cutins-light.png` and `all-cutins-dark.png`. Each scene reads as attack, pressure, victory, or defeat; the five character designs remain identifiable. Lv3 retains its collar and chest ornament, Lv4 its crown, and Lv5 its star halo and wing ornaments. No cut-in has baked-in text, card art, a board, or a visible opaque background.

The technical audit in `integration-asset-audit.json` found 20/20 cut-ins and 30/30 display portraits readable, correctly dimensioned, and containing both transparent and opaque pixels. Each cut-in master is byte-identical to its approved production candidate. `invalidCount` is zero. This audit is separate from the artists' self-review.

## Integration verification (2026-09-26)

- `npx tsc --noEmit`, `npm run build`, and `npx vitest run` passed; the full suite was 45 files / 416 tests. `git diff --check` reported no whitespace errors.
- Edge at 375–430×844 and 900×700 confirmed small portraits without obstructing boards, cards, dice, clocks, or controls. UNO's 44px portrait is smaller than a hand card (~91px); Mancala uses 34px, Babanuki 32px, Backgammon 38px. Ten-player UNO uses one shared cue above the table instead of overlapping seat portraits. The result images are static and do not delay rematch/exit.
- Captured implementation views: [UNO mobile](previews/uno-mobile-wipe.png), [UNO ten players](previews/uno-10-player-shared-wipe.png), [Mancala mobile](previews/mancala-mobile-wipe.png), and [Babanuki guest](previews/babanuki-guest-mobile.png). The existing UNO card appearance and game board remain intact.
- Actual online Edge contexts, not mocked state: UNO host + guest + Lv2 CPU showed the same CPU draw reaction and existing full-screen cut-in at both clients; a separate human-only match showed no dragon art. Mancala host + guest + CPU showed the same speech after nine human moves, with no pit overlap after placing the bubble beside the portrait. Babanuki host + two guests + CPU showed matching public-event speech in three perspectives after seven human draws. Opponent cards remained back-facing; the top-seat bubble and side seats stayed inside 390px, without overlap on card buttons.
- Normal and Bakuretsu Reversi were browser-checked at 375–430×844 and 900×700; their reaction adapters test public event ordering, including delayed Bakuretsu playback frames. Backgammon was browser-checked at 390×844 and 900×700; its existing double cut-in displayed the new image through offer/acceptance with the original timing. No page errors were observed in these checks.
- The character reaction decision uses only match ID, public sequence, CPU ID, and published event outcome. Tests cover the five personality rates, truthful result labels, hidden-card independence, two-stage Lv1/Lv2 bravado, queue deduplication, rematch reset, and reduced/off preferences. No game rules or CPU move selection were changed.

## Publication

PR [#47](https://github.com/kyouryu888-web/dragon-game-park/pull/47) merged at `3e460fa37cf64f36080e0c9e54d8690987f4d5f5`. CI and Vercel Production succeeded for that merge commit. An Edge browser opened [the production site](https://dragon-game-park.vercel.app) at 390×844 and found the UNO portrait at 44×44, loaded image, original cards, and no horizontal overflow or page errors. All 73 WebP assets emitted by the production build returned HTTP 200 with `image/webp` content type from the production domain. Preview deployment succeeded; its URL required Vercel sign-in for browser access, so the visual browser check used the public production domain.
