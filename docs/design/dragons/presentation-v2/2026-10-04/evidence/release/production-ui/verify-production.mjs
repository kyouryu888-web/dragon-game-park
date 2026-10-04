import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base=process.env.DGP_QA_URL||'https://dragon-game-park.vercel.app';
const folder='docs/design/dragons/presentation-v2/2026-10-04/evidence/release/production-ui';
const fixture=`${base}/${folder}/fixture.html`;
const results={ date:'2026-10-04',browser:'Microsoft Edge via playwright-core',browserPath:'Ordinary Playwright + Edge fallback after Windows browser helper initialization failure',base,viewports:[{width:375,height:844},{width:430,height:844},{width:900,height:700}],checks:[],console:[],failures:[],screenshots:[] };
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function capture(page,label){const path=`${folder}/${label}.png`;await page.screenshot({path,fullPage:false});results.screenshots.push(path);}
async function health(page,label){
  assert.equal(await page.locator('vite-error-overlay').count(),0);
  assert.ok((await page.locator('body').innerText()).length>100);
  const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(overflow.scroll<=overflow.width+1,`${label}: horizontal document overflow ${JSON.stringify(overflow)}`);
  const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.className));
  assert.deepEqual(broken,[]);
  results.checks.push({label,pageIdentity:{url:page.url(),title:await page.title()},nonBlank:true,frameworkOverlay:false,documentOverflow:overflow,brokenImages:broken});
}
function recordError(page,label){
  page.on('pageerror',e=>results.console.push({label,level:'pageerror',message:e.message}));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))results.console.push({label,level:m.type(),message:m.text()});});
}
for(const viewport of results.viewports){
  const tag=`${viewport.width}x${viewport.height}`;
  const context=await browser.newContext({viewport});
  const page=await context.newPage();recordError(page,tag);
  try{
    await page.goto(base);await page.getByRole('button',{name:'UNOの盤へ進む',exact:true}).click();
    await page.getByRole('button',{name:'ドラゴンと対戦'}).click();
    await page.getByRole('button',{name:'この設定で対戦する',exact:true}).click();
    await page.getByRole('button',{name:'カードを引いて決める',exact:true}).click();
    await page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
    await page.locator('.uno-table-arena').waitFor();
    await page.getByRole('button',{name:'カード効果',exact:true}).click();
    assert.ok((await page.locator('body').innerText()).includes('リバース'));
    await page.getByRole('button',{name:'カード効果',exact:true}).click();
    await page.waitForTimeout(400);
    await capture(page,`real-uno-${tag}`);await health(page,`real-uno-${tag}`);
    for(const preference of ['off','subtle','lively']){
      await page.getByLabel('ドラゴン演出',{exact:true}).selectOption(preference);
      assert.equal(await page.evaluate(()=>localStorage.getItem('dragon-reaction-presentation')),preference);
      if(preference==='off')assert.equal(await page.locator('.dragon-reaction-wipe').count(),0);
    }
    await page.getByRole('button',{name:'ゲーム選択に戻る',exact:true}).click();
    await page.getByRole('button',{name:'最弱王ババ抜きの盤へ進む',exact:true}).click();
    await page.getByRole('button',{name:'ドラゴンと対戦'}).click();
    await page.getByRole('button',{name:'この設定で対戦する',exact:true}).click();
    await page.locator('.babanuki-target .babanuki-card.is-pickable').first().waitFor({timeout:35000});
    await page.locator('.babanuki-target .babanuki-card.is-pickable').first().click();
    await page.getByRole('button',{name:'この札を引く',exact:true}).click();
    await page.waitForTimeout(220);
    await capture(page,`real-babanuki-${tag}`);await health(page,`real-babanuki-${tag}`);
    for(const preference of ['off','subtle','lively']){
      await page.getByLabel('ドラゴン演出',{exact:true}).selectOption(preference);
      assert.equal(await page.evaluate(()=>localStorage.getItem('dragon-reaction-presentation')),preference);
      if(preference==='off')assert.equal(await page.locator('.dragon-reaction-wipe').count(),0);
    }
    results.checks.push({label:`real-controls-${tag}`,unoStarterAndHelp:true,babanukiDrawConfirmation:true,persistedPreferences:['off','subtle','lively']});
    console.log(`PASS real flows ${tag}`);
  }catch(error){results.failures.push({label:`real-${tag}`,message:error.message,stack:error.stack});console.log(`FAIL real flows ${tag}: ${error.message}`);await capture(page,`failure-real-${tag}`);}
  await context.close();
}
await browser.close(); await writeFile(folder+'/results.json',JSON.stringify(results,null,2)); console.log(JSON.stringify({checks:results.checks.length,failures:results.failures,errors:results.console.filter(e=>e.level==='error'||e.level==='pageerror')}));if(results.failures.length||results.console.some(e=>e.level==='error'||e.level==='pageerror'))process.exitCode=1;
