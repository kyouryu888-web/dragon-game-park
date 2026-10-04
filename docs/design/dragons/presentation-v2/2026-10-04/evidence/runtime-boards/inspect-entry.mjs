import { chromium } from 'playwright-core';const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
for(const game of ['マンカラ','バックギャモン','リバーシ']) {await page.goto('http://127.0.0.1:5178');await page.getByRole('button',{name:`${game}の盤へ進む`}).click();await page.getByRole('button',{name:/ドラゴンと対戦/}).click();await page.waitForTimeout(100);console.log(JSON.stringify({game,buttons:await page.getByRole('button').allTextContents()}));}
await browser.close();
