import { chromium } from 'playwright-core';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:390,height:844}});
await page.goto('http://127.0.0.1:5178');
console.log(JSON.stringify({title:await page.title(), buttons:await page.getByRole('button').allTextContents()},null,2));
await browser.close();
