# Release card-game verification — 2026-10-04

## Result

PASS: real online full matches for standard UNO, hard UNO and Babanuki. The final runner exits 0 for both commands. No application source changes were needed for this QA.

| Actual match | Human UI actions | Shared public reaction observations | Opponent privacy observations | Elapsed | Final result |
|---|---:|---:|---:|---:|---|
| Standard UNO, 2 humans | 44 | 9 | 81 | 69.6s | Both contexts: QA guest wins; identical scores and remaining cards |
| Babanuki, 2 humans + 1 CPU | 18 | 18 | 181 | 111.5s | Both contexts: guest 1st, CPU 2nd, host weakest king |
| Hard UNO, 2 humans | 54 | 18 | 180 | 126.5s | Both contexts: host eliminated, guest wins; identical scores and remaining cards |

All 442 privacy observations found zero opponent card faces in the opponent stacks/table card DOM. These checks inspect rendered opponent card areas, not raw network payloads or the full database schema.

Each match included the following real reconnection exercise:

- The guest browser context was set offline for 1,800ms and then brought online.
- The same page re-entered the existing room through the public setup and code-entry UI.
- The guest retained the same session participant ID.
- No old reaction was replayed during bootstrap (empty reaction log immediately after re-entry).
- Guest REST requests then received 120ms additional request delay for the remaining UI play.
- The match completed and both contexts displayed the same final ranks/scores/card counts.

Page errors: 0. Unexpected console errors: 0. The standard/Babanuki run recorded two network console errors while the browser was deliberately offline. Hard UNO recorded no console errors. Screenshots were visually inspected for the standard UNO and Babanuki mobile results.

## Environment and actual interaction paths

- URL: http://127.0.0.1:5178/
- Edge through the repository's existing Playwright-core.
- Host: 900 × 700. Guest: 390 × 844.
- The Windows browser helper initialization previously failed; the delegated release QA used the documented ordinary Playwright + Edge fallback.
- Page title present, meaningful game UI visible, and no Vite error overlay.
- Home → game setup → create/join actual Supabase room → real card actions → guest reconnect → real card actions → identical results.
- No fixture, injected game state, new SQL, or direct database gameplay write.

Standard UNO observed public skip, reverse, and remaining 3/2/1-card reactions. Hard UNO observed reverse, confirmed blue color, remaining-card reactions, roulette drawing/stop, hard special cards, and a real KO outcome. Babanuki observed human narration and CPU speech for draw, pair, shuffle declaration/outcome, finish and weakest-king result. The Babanuki full-match random shuffle observed in the successful run was die 1, not die 3. The die-3 700ms art was previously verified by local public-event fixtures; this real match does not claim a die-3 observation.

## Reproduction

From the implementation worktree:

~~~powershell
node docs/design/dragons/presentation-v2/2026-10-04/evidence/release-cards/full-matches.mjs

$env:QA_GAMES = 'uno'
$env:QA_UNO_HARD = '1'
node docs/design/dragons/presentation-v2/2026-10-04/evidence/release-cards/full-matches.mjs
~~~

The runner creates its own random-code QA room and cleans only that exact room after leaving the game UI. The code is not a game-state seeding utility.

## Evidence and room cleanup

- Final standard/Babanuki details: results.json
- Final hard details: hard/results.json
- Final desktop/mobile result screenshots: uno-finished-*.png, babanuki-finished-*.png, hard/uno-finished-*.png
- Initial QA attempt: first-attempt.mjs and first-attempt-results.json, plus its screenshots.
- Initial QA cleanup confirmation: first-attempt-cleanup.json.

All five rooms from these attempts were deleted with exact room-code filters and then checked absent (remaining 0). No unrelated rooms were selected for deletion.

The initial harness had two QA-only problems: it clicked an opponent's visible but internally rejected pending UNO pass/OK controls, and it treated whitespace adjacent to Babanuki's viewer marker as a rank difference. It also hit a duplicate visible return-button selector at the finale. These were corrected in the harness by using the named action owner, removing whitespace for final-rank comparison, and choosing the visible finale return control. The failed attempt remains preserved. The corrected run completed every match.

## Remaining limits

This evidence covers Edge at 900 × 700 and 390 × 844. It does not establish packet-loss behavior, arbitrary disconnect duration, every random shuffle die, or every possible hard-card combination. It also does not claim backend raw-payload privacy or every CPU level in a full online UNO match. Those limits are distinct from the passed real UI completion/reconnection checks.
