import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
const target='http://127.0.0.1:5178';
const output=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/,'$1'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={environment:{url:target,browser:'Microsoft Edge headless',browserPlugin:'Browser plugin not available; authorized Playwright fallback',viewports:['375x844','390x844','900x700'],fixtureWarning:'Fixed public events exercise actual rendering/playback. They are not live Supabase matches.'},checks:[],screenshots:[],errors:[]};
const filter=process.env.QA_FILTER?new RegExp(process.env.QA_FILTER):null;
const expectedTimers=new Set([700,1900,2000,2500,2800]);
async function save(){await fs.writeFile(path.join(output,filter?'results-rerun.json':'results.json'),JSON.stringify(report,null,2));}
async function check(name,run){if(filter&&!filter.test(name))return;try{const detail=await run();report.checks.push({name,passed:true,...detail});console.log(`PASS ${name}`);}catch(error){report.checks.push({name,passed:false,error:error.message});console.log(`FAIL ${name}: ${error.message}`);}await save();}
function assert(value,message){if(!value)throw new Error(message);}
async function fresh(viewport,preference='lively',reducedMotion='no-preference') {
 const context=await browser.newContext({viewport,reducedMotion});
 await context.addInitScript(({preference,delays})=>{
  localStorage.setItem('dragon-reaction-presentation',preference);
  window.qaTimerLog=[];window.qaSceneLog=[];
  const original=window.setTimeout;
  window.setTimeout=function(callback,delay,...args){
    const record={delay,scheduledAt:performance.now()};
    if(delays.includes(delay)){window.qaTimerLog.push(record);return original(()=>{record.firedAt=performance.now();callback(...args);},delay);}
    return original(callback,delay,...args);
  };
  addEventListener('DOMContentLoaded',()=>{
   const tracked=new Map();
   const selectors=['.mancala-capture-moment','.backgammon-hit-moment','.reversi-cinematic'];
   function scan(){for(const selector of selectors){const node=document.querySelector(selector);const active=tracked.get(selector);
    if(node&&!active){const record={selector,start:performance.now(),text:node.textContent,animation:getComputedStyle(node).animationDuration};window.qaSceneLog.push(record);tracked.set(selector,record);}
    if(!node&&active){active.end=performance.now();active.duration=active.end-active.start;tracked.delete(selector);}
   }}
   new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});scan();
  });
 },{preference,delays:[...expectedTimers]});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(target))errors.push(`HTTP ${response.status()} ${response.url()}`);});
 page.on('console',message=>{if(message.type()==='warning'&&message.text().startsWith('You have Reduced Motion enabled'))return;if(['warning','error'].includes(message.type()))errors.push(`${message.type()}: ${message.text()}`);});
 async function cleanup(){report.errors.push(...errors.map(message=>({message,url:page.url()})));await context.close();}
 return {page,errors,cleanup};
}
async function health(page){
 const state=await page.evaluate(()=>({title:document.title,text:document.body.innerText.length,overlay:!!document.querySelector('vite-error-overlay'),overflow:document.documentElement.scrollWidth-innerWidth,broken:[...document.images].filter(img=>img.complete&&img.naturalWidth===0).map(img=>img.src),imageCount:document.images.length}));
 assert(state.text>30,'Blank page');assert(!state.overlay,'Framework error overlay');assert(state.overflow<=1,`Horizontal overflow ${state.overflow}px`);assert(state.broken.length===0,`Broken images ${state.broken.length}`);return state;
}
async function screenshot(page,name){if(name.startsWith('reversi-corner')||name.startsWith('bakuretsu'))await page.waitForTimeout(350);const filename=`${name}.png`;await page.screenshot({path:path.join(output,filename),fullPage:false});report.screenshots.push(filename);}
async function fixture(page,scenario){await page.goto(`${target}/docs/design/dragons/presentation-v2/2026-10-04/evidence/runtime-boards/boards-fixture.html?scenario=${scenario}`);await page.waitForFunction(()=>window.qaBoard);await page.waitForTimeout(100);assert((await page.title()).includes('固定公開イベント'),'Wrong fixture identity');}

for(const [game,variant] of [['マンカラ','mancala'],['バックギャモン','backgammon'],['リバーシ','reversi'],['リバーシ','bakuretsu']]) {
 await check(`actual entry and primary input ${variant} 390x844`,async()=>{
  const {page,errors,cleanup}=await fresh({width:390,height:844});
  try{await page.goto(target);assert((await page.title())==='ドラゴンゲームパーク','Wrong app title');await page.getByRole('button',{name:`${game}の盤へ進む`}).click();await page.getByRole('button',{name:/ドラゴンと対戦/}).click();if(variant==='bakuretsu')await page.getByRole('button',{name:'💥 爆裂リバーシー'}).click();await page.getByRole('button',{name:'この設定で対戦する'}).click();
   await page.waitForTimeout(100);const before=await health(page);
   if(variant==='mancala'){await page.locator('.pit-btn.is-selectable').first().click();await page.waitForTimeout(70);assert(await page.locator('.pit-btn.is-selectable').count()===0,'Mancala did not start sowing');}
   else if(variant==='backgammon'){const roll=page.getByRole('button',{name:/サイコロ|振る|先手/});await roll.first().click();await page.waitForTimeout(80);}
   else {const cell=page.locator('[role="gridcell"]').filter({hasText:''});const enabled=page.locator('[role="gridcell"]:not([disabled])');assert(await enabled.count()>0,'No legal move');await enabled.first().click();await page.waitForTimeout(130);}
   await screenshot(page,`entry-${variant}-390`);assert(!errors.length,errors.join('\n'));return {before,after:await health(page),interaction:'Home -> game setup -> VS CPU -> start -> primary board input'};
  }finally{await cleanup();}
 });
}

for(const viewport of [{width:375,height:844},{width:390,height:844},{width:900,height:700}]) {
 for(const preference of ['lively','subtle','off']) {
  await check(`Mancala actual completed major capture ${viewport.width} ${preference}`,async()=>{
   const {page,errors,cleanup}=await fresh(viewport,preference);
   try{await fixture(page,'mancala');const plan=await page.evaluate(()=>window.qaBoard.capturePlan);assert(plan.length===3,'Unexpected capture plan');
    for(let i=0;i<plan.length;i++) {
     await page.locator(`[data-pit-id="${plan[i]}"] button`).click();
     await page.waitForTimeout(40);assert(await page.locator('.pit-btn.is-selectable').count()===0,'No actual stone playback');
     if(i===plan.length-1&&preference!=='off') {
      await page.locator('.mancala-capture-moment').waitFor({state:'visible',timeout:12000});
      const enabled=await page.locator('.pit-btn.is-selectable').count();assert(enabled>0,'Capture art added an input wait');
      assert(await page.locator('.mancala-capture-moment').evaluate(node=>getComputedStyle(node).pointerEvents)==='none','Art blocks input');
      assert(await page.locator('.mancala-capture-moment').textContent()==='7石を捕獲','Incorrect public capture facts');
      if(preference==='lively')await screenshot(page,`mancala-capture-${viewport.width}`);
      await page.locator('.mancala-capture-moment').waitFor({state:'detached',timeout:1500});
     } else await page.waitForFunction(()=>document.querySelectorAll('.pit-btn.is-selectable').length>0,{timeout:15000});
    }
    if(preference==='off')assert(await page.locator('.mancala-capture-moment,.dragon-reaction-narration,.dragon-reaction-wipe').count()===0,'Off still shows dragon art');
    else {await page.locator('.dragon-reaction-narration').waitFor({state:'visible'});assert((await page.locator('.dragon-reaction-narration').textContent()).includes('7石を捕獲'),'Missing neutral public narration');}
    const scenes=await page.evaluate(()=>window.qaSceneLog);const scene=scenes.find(entry=>entry.selector==='.mancala-capture-moment');
    if(preference!=='off')assert(scene.duration>=650&&scene.duration<1000,`Capture duration ${scene.duration}`);
    const state=await health(page);assert(!errors.length,errors.join('\n'));return {plan,scenes,state,inputEnabledDuringScene:preference!=='off'};
   }finally{await cleanup();}
  });
 }
}
for(const viewport of [{width:375,height:844},{width:390,height:844},{width:900,height:700}]) {
 for(const preference of ['lively','subtle','off']) {
  for(const scenario of ['reversi-corner','reversi-light','bakuretsu']) {
   await check(`${scenario} human public playback ${viewport.width} ${preference}`,async()=>{
    const {page,errors,cleanup}=await fresh(viewport,preference);
    try{await fixture(page,scenario);await page.getByRole('gridcell',{name:scenario==='bakuretsu'?/^F5/:scenario==='reversi-light'?/^A3/:/^A1/}).click();
     if(scenario==='reversi-light') {
      if(preference==='lively'){await page.locator('.dragon-reaction-narration').waitFor({state:'visible'});assert((await page.locator('.dragon-reaction-narration').textContent()).includes('2枚反転'),'Wrong light flip facts');await screenshot(page,`reversi-light-${viewport.width}`);}
      else {await page.waitForTimeout(1000);assert(await page.locator('.dragon-reaction-narration').count()===0,'Subtle/off light event visible');}
      assert(await page.locator('.reversi-cinematic').count()===0,'Light flip caused a fullscreen scene');
     }else {
      await page.locator('.reversi-cinematic').waitFor({state:'visible',timeout:10000});
      assert(await page.locator('.dragon-reaction-speech,.dragon-reaction-narration').count()===0,'Duplicate wipe during fullscreen scene');
      const art=await page.locator('.reversi-cinematic .game-cutin-art').count();assert(art===(preference==='off'?0:1),'Preference art mismatch');
      if(preference==='lively')await screenshot(page,`${scenario}-${viewport.width}`);
      await page.waitForTimeout(scenario==='bakuretsu'?2850:1950);
      const timers=await page.evaluate(()=>window.qaTimerLog);const duration=scenario==='bakuretsu'?2800:1900;
      assert(timers.some(timer=>timer.delay===duration&&timer.firedAt-timer.scheduledAt>=duration-30),'Original fullscreen timer changed');
     }
     assert(!errors.length,errors.join('\n'));return {state:await health(page),scenes:await page.evaluate(()=>window.qaSceneLog),timers:await page.evaluate(()=>window.qaTimerLog)};
    }finally{await cleanup();}
   });
  }
 }
}
for(const viewport of [{width:375,height:844},{width:900,height:700}]) {
 for(const preference of ['lively','subtle','off']) {
  await check(`Backgammon multi-hit 700ms and click-through ${viewport.width} ${preference}`,async()=>{
   const {page,errors,cleanup}=await fresh(viewport,preference);
   try{await fixture(page,'backgammon');await page.evaluate(()=>window.qaBoard.trigger('hit'));
    if(preference!=='off'){await page.locator('.backgammon-hit-moment').waitFor({state:'visible'});assert((await page.locator('.backgammon-hit-moment').textContent()).includes('人間2の駒を2個ヒット'),'Wrong public hit facts');assert(await page.locator('.backgammon-hit-moment').evaluate(node=>getComputedStyle(node).pointerEvents)==='none','Hit art blocks input');await page.getByRole('button',{name:'サイコロを振る'}).click();assert(await page.evaluate(()=>window.qaBoard.rollClicked),'Input did not reach board');if(preference==='lively')await screenshot(page,`backgammon-hit-${viewport.width}`);await page.locator('.backgammon-hit-moment').waitFor({state:'detached',timeout:1500});}
    else{await page.waitForTimeout(150);assert(await page.locator('.game-cutin-art,.dragon-reaction-narration').count()===0,'Off art visible');}
    const scenes=await page.evaluate(()=>window.qaSceneLog);const scene=scenes.find(entry=>entry.selector==='.backgammon-hit-moment');if(preference!=='off')assert(scene.duration>=650&&scene.duration<1000,`Hit duration ${scene.duration}`);
    assert(!errors.length,errors.join('\n'));return {state:await health(page),scenes};
   }finally{await cleanup();}
  });
 }
}
for(const action of ['accept','drop']) {
 await check(`Backgammon cube 2500ms offer + 2000ms ${action}`,async()=>{
  const {page,errors,cleanup}=await fresh({width:390,height:844});
  try{await fixture(page,'backgammon');await page.getByRole('button',{name:'ダブル提案',exact:true}).click();await page.getByText('DOUBLE OFFERED!',{exact:true}).waitFor();await page.waitForTimeout(2600);await page.evaluate(action=>window.qaBoard.trigger(action),action);await page.getByText(action==='accept'?'DOUBLE ACCEPTED!!':'DOUBLE DROPPED...',{exact:true}).waitFor();await page.waitForTimeout(2100);const timers=await page.evaluate(()=>window.qaTimerLog);assert(timers.some(timer=>timer.delay===2500&&timer.firedAt),'Offer timer changed');assert(timers.some(timer=>timer.delay===2000&&timer.firedAt),'Response timer changed');assert(!errors.length,errors.join('\n'));return {timers,state:await health(page)};}finally{await cleanup();}
 });
}
for(const scenario of ['reversi-corner','bakuretsu','backgammon','mancala']) {
 await check(`Reduced-motion ${scenario} 390`,async()=>{
  const {page,errors,cleanup}=await fresh({width:390,height:844},'lively','reduce');
  try{await fixture(page,scenario);
   if(scenario==='backgammon'){await page.evaluate(()=>window.qaBoard.trigger('hit'));await page.locator('.backgammon-hit-moment').waitFor();}
   else if(scenario==='mancala'){const plan=await page.evaluate(()=>window.qaBoard.capturePlan);for(const move of plan){await page.locator(`[data-pit-id="${move}"] button`).click();await page.waitForTimeout(40);await page.waitForFunction(()=>document.querySelectorAll('.pit-btn.is-selectable').length>0,{timeout:15000});}await page.locator('.mancala-capture-moment').waitFor();assert(await page.locator('.mancala-capture-moment').evaluate(node=>getComputedStyle(node).animationName)==='none','Reduced capture animation persists');}
   else {await page.getByRole('gridcell',{name:scenario==='bakuretsu'?/^F5/:/^A1/}).click();await page.waitForTimeout(250);if(scenario==='bakuretsu')assert(await page.locator('.reversi-cinematic').count()===0,'Reduced mode inserted full moving scene');}
   await screenshot(page,`reduced-${scenario}-390`);assert(!errors.length,errors.join('\n'));return {state:await health(page),reducedMotion:await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)};
  }finally{await cleanup();}
 });
}
await browser.close();report.summary={passed:report.checks.filter(check=>check.passed).length,failed:report.checks.filter(check=>!check.passed).length,errorCount:report.errors.length};await save();console.log(JSON.stringify(report.summary));
