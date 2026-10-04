import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base='http://127.0.0.1:5178';
const folder='docs/design/dragons/presentation-v2/2026-10-04/evidence/runtime-cards';
const fixture=`${base}/${folder}/fixture.html`;
const results={ date:'2026-10-04',browser:'Microsoft Edge via playwright-core',browserPath:'Browser plugin not available',base,viewports:[{width:375,height:844},{width:390,height:844},{width:900,height:700}],checks:[],console:[],failures:[],screenshots:[] };
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
  const fixtureContext=await browser.newContext({viewport});
  const f=await fixtureContext.newPage();recordError(f,`fixture-${tag}`);
  try{
    await f.goto(fixture);await f.locator('.dragon-reaction-narration').waitFor();
    await f.waitForTimeout(250);await capture(f,`fixture-uno-narrator-${tag}`);await health(f,`fixture-uno-narrator-${tag}`);
    const narrator=await f.locator('.dragon-reaction-narration').boundingBox();
    const guide=await f.getByRole('button',{name:'カード効果',exact:true}).boundingBox();
    assert.ok(narrator.x>=0&&narrator.x+narrator.width<=viewport.width);
    assert.ok(narrator.x+narrator.width<=guide.x+1,'UNO narrator overlaps card-effect control');
    assert.equal(await f.locator('[data-presenter="cpu"]').count(),0);
    for(const preference of ['subtle','off']){
      await f.getByLabel('ドラゴン演出',{exact:true}).selectOption(preference);
      assert.equal(await f.locator('.dragon-reaction-narration').count(),0);
    }
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');
    await f.locator('.dragon-reaction-narration .dragon-reaction-face img').waitFor();
    await f.locator('.dragon-reaction-narration .dragon-reaction-face img').dispatchEvent('error');
    await f.locator('.dragon-reaction-narration .dragon-reaction-image-fallback').waitFor();
    assert.ok((await f.locator('.dragon-reaction-narration').innerText()).includes('🐲'));
    assert.ok((await f.locator('.dragon-reaction-narration').innerText()).includes('リバース・順番が逆に'));
    results.checks.push({label:`narrator-face-fallback-${tag}`,failedPortraitPreservesMascotAndPublicFact:true});
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');
    await f.getByRole('button',{name:'baba-draw',exact:true}).click();
    assert.equal(await f.locator('.dragon-reaction-narration').count(),1);
    assert.ok((await f.locator('.dragon-reaction-narration').innerText()).includes('1枚引きます'));
    await capture(f,`fixture-babanuki-narrator-${tag}`);await health(f,`fixture-babanuki-narrator-${tag}`);
    await f.getByRole('button',{name:'baba-declared',exact:true}).click();
    const preloadedScene = f.locator('link[rel="preload"][as="image"][href*="lv3-shuffle.webp"]');
    await preloadedScene.waitFor({state:'attached'});
    const preloadHref = await preloadedScene.getAttribute('href');
    await f.waitForFunction(href=>performance.getEntriesByType('resource').some(e=>e.name.endsWith(href)&&e.responseEnd>0),preloadHref);
    const preloadTiming = await f.evaluate(href=>performance.getEntriesByType('resource').filter(e=>e.name.endsWith(href)).map(e=>({initiator:e.initiatorType,duration:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize})),preloadHref);
    results.checks.push({label:`cold-preload-${tag}`,coldCondition:'Fresh isolated browser context; scene not mounted before public dice-stage preload',scene:preloadHref,timings:preloadTiming});
    await f.clock.install({time:new Date('2026-10-04T08:00:00Z')});await f.clock.pauseAt(new Date('2026-10-04T08:00:01Z'));
    await f.getByRole('button',{name:'baba-shuffle',exact:true}).click();
    await f.locator('.babanuki-shuffle-cutin').waitFor();
    await f.clock.runFor(300);
    await f.waitForTimeout(350);
    const layering=await f.evaluate(()=>({
      art:+getComputedStyle(document.querySelector('.babanuki-shuffle-cutin')).zIndex,
      panel:+getComputedStyle(document.querySelector('.babanuki-shuffle-showcase')).zIndex,
      panelOpacity:getComputedStyle(document.querySelector('.babanuki-shuffle-showcase')).opacity,
      flights:[...document.querySelectorAll('.babanuki-flying')].map(n=>({z:+getComputedStyle(n).zIndex,hiddenFace:!n.innerText.includes('♠')})),
      artRect:document.querySelector('.babanuki-shuffle-cutin .game-cutin-art')?.getBoundingClientRect().toJSON(),
      panelRect:document.querySelector('.babanuki-shuffle-showcase').getBoundingClientRect().toJSON()
    }));
    assert.equal(layering.art,9995);assert.equal(layering.panel,9996);assert.ok(layering.flights.length>0);
    assert.ok(layering.flights.every(n=>n.z===9998&&n.hiddenFace));
    if(layering.artRect){if(viewport.width<=430)assert.ok(layering.artRect.bottom<=layering.panelRect.top+1);else assert.ok(layering.artRect.right<=layering.panelRect.left+1);}
    await capture(f,`fixture-babanuki-shuffle-${tag}`);
    await f.clock.runFor(399);assert.equal(await f.locator('.babanuki-shuffle-cutin').count(),1);
    await f.clock.runFor(1);assert.equal(await f.locator('.babanuki-shuffle-cutin').count(),0);
    assert.equal(await f.locator('.babanuki-shuffle-showcase').count(),1,'Factual route panel must stay after cosmetic art disappears');
    await f.getByRole('button',{name:'baba-shuffle',exact:true}).click();
    await f.locator('.game-cutin-art-scene').waitFor();
    await f.locator('.game-cutin-art-scene').dispatchEvent('error');
    await f.locator('.game-cutin-art[data-art-fallback="true"]').waitFor({state:'attached'});
    assert.equal(await f.locator('.game-cutin-art-backdrop').count(),1);
    assert.equal(await f.locator('.game-cutin-art-character').count(),1);
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('off');
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');
    await f.locator('.game-cutin-art-scene').waitFor({state:'attached'});
    results.checks.push({label:`warm-fallback-${tag}`,warmCondition:'Same actor scene and fallback fetched by dice-stage preload before cutin mount; fixture waits load completion (real game dice stage is1700ms)',sceneErrorDispatched:true,fallbackBackdropAndCharacter:true,offLivelyHookOrderStable:true});
    await f.getByRole('button',{name:'baba-four',exact:true}).click();assert.equal(await f.locator('.babanuki-shuffle-cutin').count(),0);assert.equal(await f.locator('.babanuki-flying').count(),0);
    for(const preference of ['subtle','off']){
      await f.getByLabel('ドラゴン演出',{exact:true}).selectOption(preference);await f.getByRole('button',{name:'baba-shuffle',exact:true}).click();assert.equal(await f.locator('.babanuki-shuffle-cutin').count(),0);
    }
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');
    await f.getByRole('button',{name:'baba-public-shuffle',exact:true}).click();
    await f.locator('.babanuki-shuffle-cutin').waitFor();
    assert.equal(await f.locator('.babanuki-game-narration').count(),0);
    await f.clock.runFor(700);
    await f.locator('.babanuki-game-narration').waitFor();
    assert.ok((await f.locator('.babanuki-game-narration').innerText()).includes('出目3でシャッフル'));
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('subtle');
    await f.getByRole('button',{name:'baba-public-shuffle',exact:true}).click();
    await f.locator('.babanuki-game-narration').waitFor();
    assert.equal(await f.locator('.babanuki-shuffle-cutin').count(),0);
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('off');
    assert.equal(await f.locator('.babanuki-game-narration').count(),0);
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');
    await f.getByRole('button',{name:'uno-cut2',exact:true}).click();
    await f.locator('.game-cutin-art-scene').waitFor();
    await f.locator('.game-cutin-art-scene').dispatchEvent('error');
    await f.locator('.game-cutin-art[data-art-fallback="true"]').waitFor({state:'attached'});
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('off');
    await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');
    await f.locator('.game-cutin-art[data-art-fallback="true"]').waitFor({state:'attached'});
    results.checks.push({label:`shuffle-wipe-restore-and-persistent-hook-${tag}`,reactionRestoredAt700:true,subtlePriority3ReactionVisible:true,offHidesReaction:true,unoPersistentArtHookOrderAndFallback:true});
    await f.emulateMedia({reducedMotion:'reduce'});await f.getByLabel('ドラゴン演出',{exact:true}).selectOption('lively');await f.getByRole('button',{name:'baba-shuffle',exact:true}).click();assert.equal(await f.locator('.babanuki-shuffle-cutin').isVisible(),false);
    results.checks.push({label:`fixture-contracts-${tag}`,humanOnlyNeutralNarration:true,unoGuideNoOverlap:true,preferencesHideLightNarration:true,shuffleTimerVisibleAt699:true,shuffleTimerAbsentAt700:true,shuffleLayering:layering,subtleOffNoShuffleCutin:true,dice4NoShuffleCutinOrFlight:true,reducedMotionHidesShuffleCutin:true});
    console.log(`PASS public fixtures ${tag}`);
  }catch(error){results.failures.push({label:`fixture-${tag}`,message:error.message,stack:error.stack});console.log(`FAIL public fixtures ${tag}: ${error.message}`);await capture(f,`failure-fixture-${tag}`);}
  await fixtureContext.close();
}
await browser.close();
await writeFile(`${folder}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({checks:results.checks.length,consoleEntries:results.console.length,failures:results.failures},null,2));
if(results.failures.length||results.console.some(item=>item.level==='pageerror'||item.level==='error'))process.exitCode=1;