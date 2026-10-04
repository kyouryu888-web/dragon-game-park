import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const out='docs/design/dragons/presentation-v2/2026-10-04/evidence/release';
const base=process.env.DGP_QA_URL||'http://127.0.0.1:5178';
const result={base,method:'Live Supabase via actual app UI only; independent Edge contexts; no state injection',games:[],errors:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
const check=(v,m)=>{if(!v)throw Error(m)};
async function enter(page,game,name,create,code){await page.goto(base);await page.getByRole('button',{name:game+'の盤へ進む',exact:true}).click();await page.getByPlaceholder('挑戦者の名（なくてもよい）').fill(name);await page.getByRole('button',{name:create?'ルームを作成':'コードで参加',exact:true}).click();if(create){await page.getByRole('button',{name:'ルームを作成する',exact:true}).click();}else{await page.locator('input').last().fill(code);await page.getByRole('button',{name:'このコードで参加する',exact:true}).click();}}
async function publicBoard(page){return page.locator('[data-pit-id]').evaluateAll(nodes=>nodes.map(n=>({pit:n.dataset.pitId,label:n.querySelector('button')?.getAttribute('aria-label')?.replace('（選択可能）',''),text:n.innerText})).sort((a,b)=>a.pit.localeCompare(b.pit)))}
for(const game of ['マンカラ','バックギャモン']){
 const cs=await Promise.all([{width:390,height:844},{width:900,height:700}].map(async viewport=>browser.newContext({viewport})));const ps=await Promise.all(cs.map(c=>c.newPage()));let code='';const run={game,passed:false,moves:[],reconnect:false};
 for(const p of ps)p.on('pageerror',e=>result.errors.push({game,message:e.message}));
 try{
  await enter(ps[0],game,'公開QA主',true);if(game==='バックギャモン'){await ps[0].getByTestId('online-room-code').waitFor({timeout:25000});code=(await ps[0].getByTestId('online-room-code').innerText()).trim();}else{await ps[0].getByText('コードをコピー',{exact:true}).waitFor({timeout:25000});code=(await ps[0].locator('body').innerText()).match(/\b[A-Z0-9]{6}\b/)[0];}run.room=code;await ps[0].waitForTimeout(2000);await enter(ps[1],game,'公開QA客',false,code);await ps[0].waitForTimeout(2000);if(game==='マンカラ'&&await ps[0].getByText('コードをコピー',{exact:true}).count()) { await enter(ps[0],game,'公開QA主',false,code);run.hostLobbyRestReentry=true; }
  if(game==='マンカラ'){
   await ps[0].locator('.pit-btn.is-selectable').first().waitFor({timeout:25000});const until=Date.now()+240000;
   while(Date.now()<until&&run.moves.length<220){
    if(await ps[0].getByRole('heading',{name:/勝利！|対戦終了/}).count())break;
    let acted=false;for(let i=0;i<2;i++){const options=ps[i].locator('.pit-btn.is-selectable');if(await options.count()){
     const pick=options.nth(run.moves.length%await options.count());if(!await pick.isEnabled())continue;const label=await pick.getAttribute('aria-label');await pick.click();run.moves.push({side:i,label});acted=true;break;
    }}
    if(acted)await ps[0].waitForTimeout(1700);else await ps[0].waitForTimeout(200);
    if(run.moves.length>=6&&!run.reconnect){await cs[1].setOffline(true);await ps[0].waitForTimeout(800);await cs[1].setOffline(false);await enter(ps[1],game,'公開QA客',false,code);await ps[1].locator('.pit-btn').first().waitFor({timeout:20000});run.reconnect=true;await ps[1].waitForTimeout(4000);}
   }
   await Promise.all(ps.map(p=>p.getByRole('heading',{name:/勝利！|対戦終了/}).waitFor({timeout:16000})));
   run.finalText=await Promise.all(ps.map(p=>p.locator('body').innerText()));run.points=run.finalText.map(t=>[...t.matchAll(/(\d+)石/g)].map(m=>Number(m[1])));check(JSON.stringify(run.points[0])===JSON.stringify(run.points[1]),'Final scores differ');run.finalScoresEqual=true;
  }else{
   await Promise.all(ps.map(p=>p.locator('.backgammon-play-screen').waitFor({timeout:20000})));await ps[0].getByRole('button',{name:'先手を決める',exact:true}).click();await ps[0].waitForTimeout(2000);
   await cs[1].setOffline(true);await ps[0].waitForTimeout(800);await cs[1].setOffline(false);await enter(ps[1],game,'公開QA客',false,code);await ps[1].locator('.backgammon-play-screen').waitFor({timeout:20000});run.reconnect=true;await ps[1].waitForTimeout(4000);
   let proposer;for(let n=0;n<40;n++){for(let i=0;i<2;i++){if(await ps[i].getByRole('button',{name:'ダブル提案',exact:true}).count()){proposer=i;break;}}if(proposer!==undefined)break;const roll=ps[0].getByRole('button',{name:'先手を決める',exact:true});if(await roll.count()&&await roll.isEnabled())await roll.click();await ps[0].waitForTimeout(500);}
   check(proposer!==undefined,'No real double offer available');await ps[proposer].getByRole('button',{name:'ダブル提案',exact:true}).click();await Promise.all(ps.map(p=>p.getByText('DOUBLE OFFERED!',{exact:true}).waitFor({timeout:15000})));await ps[1-proposer].getByRole('button',{name:'降りる (Drop)',exact:true}).click();
   await ps[0].waitForTimeout(3000);run.finalText=await Promise.all(ps.map(p=>p.locator('body').innerText()));check(run.finalText.every(t=>/勝|WIN|勝負|敗|マッチ/.test(t)),'No visible end result');run.finish='Real double offer and Drop; terminal round, not a full bear-off game';run.proposer=proposer;
  }
  for(let i=0;i<2;i++)await ps[i].screenshot({path:out+'/'+(game==='マンカラ'?'mancala':'backgammon')+'-complete-'+i+'.png',fullPage:false});run.passed=true;console.log('PASS '+game+' '+run.moves.length+' moves');
 }catch(e){run.error=e.message;console.log('FAIL '+game+': '+e.message);for(let i=0;i<2;i++)await ps[i].screenshot({path:out+'/'+(game==='マンカラ'?'mancala':'backgammon')+'-failure-'+i+'.png'}).catch(()=>{});}
 finally{
  for(const p of ps){const exit=p.getByRole('button',{name:game==='バックギャモン'?'盤を離れる':'ゲーム選択に戻る',exact:true});if(await exit.count()){await exit.click().catch(()=>{});if(game==='バックギャモン'&&await exit.count())await exit.click().catch(()=>{});}}
  if(game==='マンカラ'){const cancel=ps[0].getByRole('button',{name:'キャンセル（ルーム削除）',exact:true});if(await cancel.count()){await cancel.click();await ps[0].waitForTimeout(500);}}
  if(code)run.cleanup=await ps[0].evaluate(async({code,game})=>{const{supabase}=await import('/src/lib/supabase.ts');const table=game==='マンカラ'?'mancala_rooms':'backgammon_rooms';const d=await supabase.from(table).delete().eq('room_code',code);const r=await supabase.from(table).select('room_code').eq('room_code',code);return {deleted:!d.error,remaining:r.data?.length,error:d.error?.message??r.error?.message??null}},{code,game}).catch(e=>({error:e.message}));
  result.games.push(run);await fs.writeFile(out+'/online-boards-release.json',JSON.stringify(result,null,2));for(const c of cs)await c.close();
 }
}
await browser.close();if(result.games.some(g=>!g.passed)||result.errors.length)process.exitCode=1;