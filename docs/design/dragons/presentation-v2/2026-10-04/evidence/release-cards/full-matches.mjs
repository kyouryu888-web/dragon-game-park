import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base=process.env.QA_BASE??'http://127.0.0.1:5178';
const folder='docs/design/dragons/presentation-v2/2026-10-04/evidence/release-cards'+(process.env.QA_UNO_HARD?'/hard':'');
await mkdir(folder,{recursive:true});
const report={date:new Date().toISOString(),scope:'Real existing Supabase, independent Edge contexts, UI actions only; no fixtures or game-state injection',browser:'Playwright + Edge; Browser skill absent, delegated task explicitly permits fallback',base,games:[],console:[],failures:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
async function side(viewport,label){
 const context=await browser.newContext({viewport});
 await context.addInitScript(()=>{
  window.publicReactionLog=[];
  new MutationObserver(()=>document.querySelectorAll('.dragon-reaction-narration.is-reacting,.dragon-reaction-wipe.is-reacting').forEach(n=>{
   const item={presenter:n.getAttribute('data-presenter'),actor:n.getAttribute('data-cpu-id'),emotion:n.getAttribute('data-emotion'),text:n.innerText};const key=JSON.stringify(item);
   if(!window.publicReactionLog.some(i=>i.key===key))window.publicReactionLog.push({...item,key});
  })).observe(document,{subtree:true,childList:true,attributes:true});
 });
 const page=await context.newPage(),s={context,page,label,offline:false,previous:[]};
 page.on('pageerror',e=>report.console.push({label,level:'pageerror',message:e.message,expectedOffline:s.offline}));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push({label,level:m.type(),message:m.text(),expectedOffline:s.offline});});
 return s;
}
async function enter(s,game,name,create,code){
 const p=s.page;await p.goto(base);assert.ok((await p.title()).length);
 assert.equal(await p.locator('vite-error-overlay').count(),0);
 await p.getByRole('button',{name:game==='uno'?'UNOの盤へ進む':'最弱王ババ抜きの盤へ進む',exact:true}).click();
 await p.getByPlaceholder('挑戦者の名（なくてもよい）').fill(name);await p.getByRole('button',{name:'遠方の者と対戦'}).click();
 await p.getByRole('button',{name:create?'ルームを作成':'コードで参加',exact:true}).click();
 if(create){
  if(game==='uno'&&process.env.QA_UNO_HARD)await p.getByRole('button',{name:/ハード版/}).click();
  await p.getByRole('button',{name:game==='uno'?'2人':'3人',exact:true}).click();
  if(game==='babanuki')await p.locator('.game-setup-opponent-row').nth(1).getByRole('button',{name:'🐉 CPU',exact:true}).click();
  await p.getByRole('button',{name:'ルームを作成する',exact:true}).click();await p.getByTestId('online-room-code').waitFor({timeout:25000});return(await p.getByTestId('online-room-code').innerText()).trim();
 }
 await p.getByPlaceholder('6桁のコードを入力').fill(code);await p.getByRole('button',{name:'このコードで参加する',exact:true}).click();
 await p.locator(game==='uno'?'.uno-table-arena':'.babanuki-table-surface').waitFor({timeout:25000});
}
async function observe(s){return [...s.previous,...await s.page.evaluate(()=>window.publicReactionLog??[])];}
async function shared(sides){const[a,b]=await Promise.all(sides.map(observe));return a.filter(e=>b.some(o=>o.key===e.key));}
async function privacy(s,game){
 if(game==='uno')return s.page.evaluate(()=>({backs:document.querySelectorAll('.uno-opponent-stack .uno-mini-back').length,exposed:document.querySelectorAll('.uno-opponent-stack .uno-card,.uno-opponent-stack [aria-label*="赤"],.uno-opponent-stack [aria-label*="ワイルド"]').length}));
 const cards=await s.page.locator('.babanuki-table-surface .babanuki-card').allTextContents();
 return {backs:cards.filter(t=>t.includes('🐉')).length,exposed:cards.filter(t=>/[♠♥♦♣🃏]/.test(t)).length};
}
async function counts(s,game){
 return s.page.evaluate(game=>{
  if(game==='uno')return [...document.querySelectorAll('.uno-seat')].map(n=>({id:n.getAttribute('data-player-id'),count:[...n.querySelectorAll('.uno-seat-badge>span')].map(x=>x.textContent).find(t=>/\d+まい|アウト/.test(t))??''})).sort((a,b)=>a.id.localeCompare(b.id));
  return [...document.querySelectorAll('.babanuki-seat')].map(n=>n.innerText.replace(/\s+/g,' ').replace(/🐉/g,'')).sort();
 },game);
}
async function reconnect(s,game,code,run){
 const key=game==='uno'?'dgp-uno-online-player-id':'dgp-babanuki-online-player-id';
 const beforeId=await s.page.evaluate(key=>sessionStorage.getItem(key),key);
 s.previous.push(...await s.page.evaluate(()=>window.publicReactionLog??[]));s.offline=true;
 await s.context.setOffline(true);await s.page.waitForTimeout(1800);await s.context.setOffline(false);s.offline=false;
 await enter(s,game,'QAゲスト',false,code);
 const afterId=await s.page.evaluate(key=>sessionStorage.getItem(key),key);assert.equal(beforeId,afterId);
 await s.page.waitForTimeout(350);
 const bootstrap=await s.page.evaluate(()=>window.publicReactionLog??[]);
 run.reconnect={networkOfflineMs:1800,sameSessionParticipant:beforeId===afterId,rejoinedRoom:code,bootstrapReactions:bootstrap};
 await s.context.route('**/rest/v1/**',async route=>{await new Promise(r=>setTimeout(r,120));await route.continue();});
 run.reconnect.restRequestDelayMs=120;console.log('REJOIN '+game+' same participant, 120ms request latency');
}
async function maybeClick(p,loc){const n=p.locator(loc);if(await n.count()&&await n.first().isVisible()&&await n.first().isEnabled()){await n.first().click({timeout:5000});return true;}return false;}
async function unoStep(s){
 const p=s.page;
 const pending=p.locator('.uno-pending-panel'); // scoped color only is owned to avoid foreign chooser controls
 const body=await p.locator('body').innerText(),myName=s.label.endsWith('host')?'QAホスト':'QAゲスト';
 if(await p.locator('.uno-pending-color-button').count()&&body.includes((s.label.endsWith('host')?'QAホスト':'QAゲスト')+'、色をえらんでください')){
  await p.locator('.uno-pending-color-button.is-blue').click();return 'public-color-blue';
 }
 const ok=p.getByRole('button',{name:'OK',exact:true});
 if(body.includes(myName+' の手札があと1まい')&&await ok.count()&&await ok.isVisible()&&await ok.isEnabled()){await ok.click();return 'uno-declaration';}
 const swap=p.locator('.uno-pending-target-button');
 if(body.includes(myName+'、こうかんする相手をえらんでください')&&await swap.count()){await swap.first().click();return 'public-hand-swap';}
 const playable=p.locator('.uno-hand-card.is-playable button.uno-card');
 if(await playable.count()){
  const labels=await playable.evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')??''));
  let i=labels.findIndex(t=>t.includes('ドロー'));if(i<0)i=labels.findIndex(t=>t.includes('リバース'));if(i<0)i=labels.findIndex(t=>t.includes('スキップ'));if(i<0)i=0;
  await playable.nth(i).click({timeout:5000});return 'played '+labels[i]; // card became public through normal UI
 }
 const pass=p.getByRole('button',{name:'出さずに次へ',exact:true});
 if(body.includes(myName+' が今引いたカードだけ出せます')&&await pass.count()&&await pass.isVisible()&&await pass.isEnabled()){await pass.click();return 'pass-drawn-card';}
 if(await maybeClick(p,'.uno-hand-draw-button'))return 'draw-or-accept';
 return null;
}
async function babaStep(s){
 const p=s.page;
 if(await maybeClick(p,'.babanuki-shuffle-button'))return 'public-shuffle-declaration';
 const pick=p.locator('.babanuki-target .babanuki-card.is-pickable');
 if(await pick.count()){
  await pick.first().click({timeout:5000});
  const confirm=p.getByRole('button',{name:'この札を引く',exact:true});
  if(await confirm.count()&&await confirm.isVisible()){await confirm.click({timeout:5000});return 'public-draw';}
 }
 return null;
}
async function cleanup(game,code,sides){
 for(const s of sides){const leave=s.page.getByRole('button',{name:'ゲーム選択に戻る',exact:true});if(await leave.count()){const visible=leave.filter({visible:true});if(await visible.count())await visible.last().click();}}
 if(!code)return null;
 return sides[0].page.evaluate(async({game,code})=>{
 const{supabase}=await import('/src/lib/supabase.ts');const table=game==='uno'?'uno_rooms':'babanuki_rooms';
 const del=await supabase.from(table).delete().eq('room_code',code);const check=await supabase.from(table).select('room_code').eq('room_code',code);
 return{deleted:!del.error,remaining:check.data?.length,error:del.error?.message??check.error?.message??null};
 },{game,code});
}
async function runGame(game){
 const start=Date.now(),host=await side({width:900,height:700},game+'-host'),guest=await side({width:390,height:844},game+'-guest'),sides=[host,guest];
 const run={game,actions:[],privacyChecks:0,synchronizedEvents:[]};let code;
 try{
  code=await enter(host,game,'QAホスト',true);run.createdRoom=code;await enter(guest,game,'QAゲスト',false,code);console.log('JOINED '+game+' '+code);
  await host.page.locator(game==='uno'?'.uno-table-arena':'.babanuki-table-surface').waitFor({timeout:25000});
  if(game==='uno'){await host.page.getByRole('button',{name:'カードを引いて決める',exact:true}).click();await host.page.getByRole('button',{name:'ゲーム開始',exact:true}).click();}
  let done=false,rejoined=false,lastAction=Date.now();
  for(let step=0;step<600&&Date.now()-start<900000;step++){
   const result=await Promise.all(sides.map(async s=>{
    if(game==='uno')return (await s.page.locator('h1').allTextContents()).find(t=>t.includes('の勝ち!'))??null;
    return await s.page.locator('.babanuki-loser-glow').count()?(await s.page.locator('.babanuki-loser-glow').innerText()):null;
   }));
   if(result.every(Boolean)){done=true;run.result=result;break;}
   if(!rejoined&&run.actions.length>=6){await reconnect(guest,game,code,run);rejoined=true;await host.page.waitForTimeout(600);}
   let acted=false;
   for(const s of sides){
    const p=await privacy(s,game);assert.equal(p.exposed,0,'Opponent card face leaked into DOM');run.privacyChecks++;
    const kind=await (game==='uno'?unoStep(s):babaStep(s));
    if(kind){run.actions.push({step,side:s.label,kind,elapsedMs:Date.now()-start});acted=true;lastAction=Date.now();break;}
   }
   if(step%15===0){console.log('PROGRESS '+game+' step='+step+' humanActions='+run.actions.length+' elapsed='+Math.round((Date.now()-start)/1000)+'s');run.synchronizedEvents=await shared(sides);await writeFile(folder+'/'+game+'-progress.json',JSON.stringify(run,null,2));}
   if(Date.now()-lastAction>45000){
    run.idleBodies=await Promise.all(sides.map(s=>s.page.locator('body').innerText()));
    throw new Error('No human action for 45s; inspect idleBodies (could be CPU-only endgame)');
   }
   await host.page.waitForTimeout(acted?900:650);
  }
  assert.ok(done,'Full match did not complete within bounded real UI loop');
  assert.ok(rejoined,'Match ended before reconnect could be tested');
  await host.page.waitForTimeout(game==='babanuki'?2500:600);
  run.rankings=await Promise.all(sides.map(s=>s.page.locator('.rank-card').allTextContents()));
  const normalize=rs=>rs.map(t=>t.replace(/（あなた）/g,'').replace(/\s+/g,'').trim());
  assert.deepEqual(normalize(run.rankings[0]),normalize(run.rankings[1]),'Both contexts must show same final rank/counts');
  run.synchronizedEvents=await shared(sides);assert.ok(run.synchronizedEvents.length>=2,'Expected shared real public reactions');
  run.hostReactions=await observe(host);run.guestReactions=await observe(guest);
  for(const s of sides)await s.page.screenshot({path:folder+'/'+game+'-finished-'+(s===host?'desktop':'mobile')+'.png',fullPage:false});
  run.finished=true;run.elapsedMs=Date.now()-start;
  console.log('PASS '+game+' full match actions='+run.actions.length+' shared='+run.synchronizedEvents.length);
 }catch(e){
  run.error={message:e.message,stack:e.stack};report.failures.push({game,...run.error});
  run.bodies=await Promise.all(sides.map(s=>s.page.locator('body').innerText().catch(()=>'')));
  console.log('FAIL '+game+' '+e.message);
  for(const s of sides)await s.page.screenshot({path:folder+'/'+game+'-failure-'+(s===host?'desktop':'mobile')+'.png',fullPage:false}).catch(()=>{});
 }finally{
  run.cleanup=await cleanup(game,code,sides).catch(e=>({error:e.message}));report.games.push(run);
  for(const s of sides)await s.context.close();await writeFile(folder+'/results.json',JSON.stringify(report,null,2));
 }
}
await Promise.all((process.env.QA_GAMES??'uno,babanuki').split(',').map(runGame));
await browser.close();
console.log(JSON.stringify({games:report.games.map(g=>({game:g.game,finished:g.finished,actions:g.actions.length,sharedEvents:g.synchronizedEvents.length,reconnect:g.reconnect,cleanup:g.cleanup})),failures:report.failures,pageerrors:report.console.filter(c=>c.level==='pageerror'),unexpectedErrors:report.console.filter(c=>c.level==='error'&&!c.expectedOffline)},null,2));
if(report.failures.length||report.console.some(c=>c.level==='pageerror'))process.exitCode=1;
