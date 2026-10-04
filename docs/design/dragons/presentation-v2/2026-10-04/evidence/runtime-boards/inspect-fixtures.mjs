import { chromium } from 'playwright-core';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
for(const scenario of ['mancala','backgammon','reversi-corner','bakuretsu']) {
 await page.goto(`http://127.0.0.1:5178/docs/design/dragons/presentation-v2/2026-10-04/evidence/runtime-boards/boards-fixture.html?scenario=${scenario}`);
 await page.waitForTimeout(800);
 console.log(JSON.stringify({scenario,qa:await page.evaluate(()=>window.qaBoard),buttons:(await page.getByRole('button').allTextContents()).slice(0,10),grids:await page.getByRole('grid').count(),errors}));
}
await browser.close();
