import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base='http://127.0.0.1:5178',folder='docs/design/dragons/presentation-v2/2026-10-04/evidence/runtime-cards';
const report={date:'2026-10-04',scope:'Real existing Supabase with two isolated Edge contexts; no fabricated state',games:[],console:[],failures:[]};
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
 const page=await context.newPage();page.on('pageerror',e=>report.console.push({label,level:'pageerror',message:e.message}));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push({label,level:m.type(),message:m.text()});});
 return {context,page,label};
}
async function enter(s,game,name,create,code){
 const p=s.page;await p.goto(base);await p.getByRole('button',{name:game==='uno'?'UNOの盤へ進む':'最弱王ババ抜きの盤へ進む',exact:true}).click();
 await p.getByPlaceholder('挑戦者の名（なくてもよい）').fill(name);await p.getByRole('button',{name:'遠方の者と対戦'}).click();
 await p.getByRole('button',{name:create?'ルームを作成':'コードで参加',exact:true}).click();
 if(create){
  await p.getByRole('button',{name:game==='uno'?'2人':'3人',exact:true}).click();
  if(game==='babanuki')await p.locator('.game-setup-opponent-row').nth(1).getByRole('button',{name:'🐉 CPU',exact:true}).click();
  await p.getByRole('button',{name:'ルームを作成する',exact:true}).click();await p.getByTestId('online-room-code').waitFor({timeout:25000});return(await p.getByTestId('online-room-code').innerText()).trim();
 }
 await p.getByPlaceholder('6桁のコードを入力').fill(code);await p.getByRole('button',{name:'このコードで参加する',exact:true}).click();
}
async function observe(s){return s.page.evaluate(()=>window.publicReactionLog);}
async function shared(sides){const[a,b]=await Promise.all(sides.map(observe));return a.filter(e=>b.some(o=>o.key===e.key));}
async function cleanup(game,code,sides){
 for(const s of sides){const leave=s.page.getByRole('button',{name:'ゲーム選択に戻る',exact:true});if(await leave.count())await leave.click();}
 if(!code)return null;
 return sides[0].page.evaluate(async({game,code})=>{const{supabase}=await import('/src/lib/supabase.ts');const table=game==='uno'?'uno_rooms':'babanuki_rooms';
 const del=await supabase.from(table).delete().eq('room_code',code);const check=await supabase.from(table).select('room_code').eq('room_code',code);
 return{deleted:!del.error,remaining:check.data?.length,error:del.error?.message??check.error?.message??null};},{game,code});
}
for(const game of['uno','babanuki']){
 const host=await side({width:900,height:700},game+'-host'),guest=await side({width:390,height:844},game+'-guest'),sides=[host,guest];let code;
 const run={game,actions:[],synchronizedEvents:[]};
 try{
  code=await enter(host,game,'QAホスト',true);run.createdRoom=code;await enter(guest,game,'QAゲスト',false,code);console.log('JOINED '+game+' '+code);
  if(game==='uno'){
   for(const s of sides)await s.page.locator('.uno-table-arena').waitFor({timeout:25000});
   await host.page.getByRole('button',{name:'カードを引いて決める',exact:true}).click();await host.page.getByRole('button',{name:'ゲーム開始',exact:true}).click();
   for(let step=0;step<70;step++){
    let acted=false;
    for(const s of sides){const p=s.page,name=s===host?'QAホスト':'QAゲスト';
     if(await p.locator('.uno-pending-color-button').count()&&(await p.locator('body').innerText()).includes(name+'、色をえらんでください')){
      await p.locator('.uno-pending-color-button.is-blue').click();run.actions.push({step,side:s.label,kind:'public-color-confirm',color:'blue'});acted=true;break;
     }
     const playable=p.locator('.uno-hand-card.is-playable button.uno-card');
     if(await playable.count()){const labels=await playable.evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label')));let i=labels.findIndex(t=>t.includes('リバース'));if(i<0)i=labels.findIndex(t=>t.includes('ワイルド'));if(i<0)i=0;
      await playable.nth(i).click();run.actions.push({step,side:s.label,kind:'play-public-card',label:labels[i]});acted=true;break;
     }
     const draw=p.locator('.uno-hand-draw-button');if(await draw.count()&&await draw.isEnabled()){await draw.click();run.actions.push({step,side:s.label,kind:'draw-or-accept-public-count'});acted=true;break;}
     const pass=p.getByRole('button',{name:'出さずに次へ',exact:true});if(await pass.count()&&await pass.isEnabled()){await pass.click();run.actions.push({step,side:s.label,kind:'pass-drawn-card'});acted=true;break;}
     const uno=p.getByRole('button',{name:'ウノ! と言う',exact:true});if(await uno.count()){await uno.click();acted=true;break;}
    }
    await host.page.waitForTimeout(1500);run.synchronizedEvents=await shared(sides);
    if(run.synchronizedEvents.some(e=>e.text.includes('リバース'))&&run.synchronizedEvents.some(e=>e.text.includes('に決定')))break;
    if(!acted&&(await host.page.locator('body').innerText()).includes('の勝ち!'))break;
   }
   assert.ok(run.synchronizedEvents.some(e=>e.text.includes('リバース')),'No real shared reverse observed in bounded play');
   assert.ok(run.synchronizedEvents.some(e=>e.text.includes('に決定')),'No real shared color confirmation observed in bounded play');
   assert.ok(run.synchronizedEvents.every(e=>e.presenter==='narrator'));
  }else{
   for(const s of sides)await s.page.locator('.babanuki-table-surface').waitFor({timeout:25000});
   const backs=await Promise.all(sides.map(s=>s.page.locator('.babanuki-table-surface .babanuki-card').allTextContents()));
   assert.ok(backs.every(cards=>cards.length&&cards.every(text=>text.includes('🐉')&&!/[♠♥♦♣🃏]/.test(text))));run.opponentCardsPrivate=true;
   for(let step=0;step<24;step++){
    for(const s of sides){const p=s.page,shuffle=p.locator('.babanuki-shuffle-button');
     if(await shuffle.count()&&await shuffle.isEnabled()){await shuffle.click();run.actions.push({step,side:s.label,kind:'public-shuffle-declaration'});break;}
     const pick=p.locator('.babanuki-target .babanuki-card.is-pickable');if(await pick.count()){
      await pick.first().click();await p.getByRole('button',{name:'この札を引く',exact:true}).click();run.actions.push({step,side:s.label,kind:'public-draw'});break;
     }
    }
    await host.page.waitForTimeout(1800);run.synchronizedEvents=await shared(sides);
    if(run.synchronizedEvents.some(e=>e.text.includes('シャッフル'))&&run.synchronizedEvents.some(e=>e.text.includes('1枚引きます')))break;
   }
   assert.ok(run.synchronizedEvents.some(e=>e.text.includes('1枚引きます')),'No shared real public draw observed');
   assert.ok(run.synchronizedEvents.some(e=>e.text.includes('シャッフル')),'No shared real shuffle declaration observed in bounded play');
  }
  for(const s of sides)await s.page.screenshot({path:folder+'/online-'+game+'-'+(s===host?'host':'guest')+'.png',fullPage:false});
  run.hostReactions=await observe(host);run.guestReactions=await observe(guest);console.log('PASS online '+game+' shared events '+run.synchronizedEvents.length);
 }catch(e){run.error={message:e.message,stack:e.stack};report.failures.push({game,...run.error});console.log('FAIL online '+game+': '+e.message);
  for(const s of sides)await s.page.screenshot({path:folder+'/online-failure-'+game+'-'+(s===host?'host':'guest')+'.png',fullPage:false});
 }finally{run.cleanup=await cleanup(game,code,sides).catch(e=>({error:e.message}));report.games.push(run);
  for(const s of sides)await s.context.close();await writeFile(folder+'/online-results.json',JSON.stringify(report,null,2));
 }
}
await browser.close();console.log(JSON.stringify({games:report.games.map(g=>({game:g.game,actions:g.actions.length,events:g.synchronizedEvents.length,cleanup:g.cleanup})),failures:report.failures,consoleEntries:report.console.length},null,2));if(report.failures.length)process.exitCode=1;
