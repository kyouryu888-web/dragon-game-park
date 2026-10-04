import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const output=path.dirname(fileURLToPath(import.meta.url)),target='http://127.0.0.1:5178';
const result={environment:{target,browser:'Microsoft Edge headless',viewports:['390x844','900x700'],method:'Independent contexts. Live existing Supabase; actual UI create/join/legal clicks/reload/rejoin. No game state injection or new SQL.'},checks:[],errors:[],warnings:[],cleanupDiagnostics:[]};
const browser=await chromium.launch({channel:'msedge',headless:true});
const assert=(v,m)=>{if(!v)throw Error(m)},save=()=>fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));
async function client(label,viewport,check){
 const context=await browser.newContext({viewport});await context.addInitScript(()=>{
  window.qaEvents=[];addEventListener('DOMContentLoaded',()=>{const active=new Map();const scan=()=>{for(const selector of ['.reversi-cinematic','.dragon-reaction-narration']){const node=document.querySelector(selector),text=node?.textContent?.replace(/\s+/g,' ').trim(),old=active.get(selector);if(old&&(!node||old.text!==text)){old.end=performance.now();old.durationMs=Math.round(old.end-old.start);active.delete(selector)}if(node&&text&&(!old||old.text!==text)){const e={selector,text,classes:node.className,start:performance.now(),time:Date.now()};window.qaEvents.push(e);active.set(selector,e)}}};new MutationObserver(scan).observe(document.body,{subtree:true,childList:true,characterData:true});scan()});
 });
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push({label,message:e.message}));
 page.on('console',m=>{if(m.type()==='error')(check.cleanupStarted?result.cleanupDiagnostics:result.errors).push({label,message:m.text()});if(m.type()==='warning')result.warnings.push({label,message:m.text()})});
 page.on('response',r=>{if(r.url().includes('/rest/v1/rpc/ack_bakuretsu_reversi_playback'))check.ackResponses.push({client:label,status:r.status(),time:Date.now()})});
 return{context,page,label,segments:[],savedSceneTypes:new Set()};
}
async function enter(page,name,create,code,variant){
 await page.goto(target);await page.getByRole('button',{name:'リバーシの盤へ進む',exact:true}).click();await page.getByPlaceholder('挑戦者の名（なくてもよい）').fill(name);
 if(create){await page.getByRole('button',{name:'ルームを作成',exact:true}).click();await page.getByRole('button',{name:variant==='normal'?'⚫ 通常リバーシ':'💥 爆裂リバーシー',exact:true}).click();await page.getByRole('button',{name:'黒・先手',exact:true}).click();await page.getByRole('button',{name:'ルームを作成する',exact:true}).click()}
 else{await page.getByPlaceholder('6桁のコードを入力').fill(code);await page.getByRole('button',{name:'このコードで参加する',exact:true}).click()}
}
const publicBoard=p=>p.locator('[role="gridcell"]').evaluateAll(nodes=>nodes.map(n=>({coordinate:n.dataset.coordinate,owner:n.dataset.disc??n.dataset.owner})).sort((a,b)=>a.coordinate.localeCompare(b.coordinate)));
const enabled=p=>p.locator('[role="gridcell"]:not([disabled])').count(),finished=p=>p.locator('.reversi-result-panel').count();
const shot=(p,name)=>p.screenshot({path:path.join(output,name+'.png'),fullPage:false});
async function waitReady(clients,previous,check){
 const started=Date.now();let changed=!previous,last='',since=0;
 for(;;){
  const boards=await Promise.all(clients.map(c=>publicBoard(c.page))),strings=boards.map(JSON.stringify);
  if(strings.some(b=>b!==previous))changed=true;
  const counts=await Promise.all(clients.map(c=>enabled(c.page))),finals=await Promise.all(clients.map(c=>finished(c.page))),scenes=await Promise.all(clients.map(c=>c.page.locator('.reversi-cinematic').count()));
  await Promise.all(clients.map(async(c,i)=>{if(scenes[i]){const node=c.page.locator('.reversi-cinematic');const kind=await node.getAttribute('class').catch(()=>null);if(kind&&!c.savedSceneTypes.has(kind)){c.savedSceneTypes.add(kind);await c.page.waitForTimeout(600);await shot(c.page,check.variant+'-'+c.label+'-'+kind.replace(/\W+/g,'-'));check.screenshots.push({client:c.label,kind,text:await node.innerText().catch(()=>'(scene completed before text read)')})}}}));
  const same=strings[0]===strings[1]&&boards[0].length===64,ready=counts.some(n=>n>0)||finals.every(n=>n>0);
  if(changed&&same&&ready&&scenes.every(n=>n===0)){if(last===strings[0]){if(Date.now()-since>=350)return{boards:boards[0],counts,finished:finals.every(n=>n>0),waitMs:Date.now()-started}}else{last=strings[0];since=Date.now()}}else{last='';since=0}
  if(Date.now()-started>55000)throw Error('Public board/input did not settle: '+JSON.stringify({counts,finals,scenes,same,changed,statuses:await Promise.all(clients.map(c=>c.page.locator('.reversi-status-tray').innerText().catch(()=>'')))}));
  await clients[0].page.waitForTimeout(100)
 }
}
async function moveChoice(page,variant,n){
 let placed='NORMAL';if(variant==='bakuretsu'){await page.getByRole('button',{name:'通常',exact:true}).click();if([2,4,6].includes(n)){const desired=n===2?'爆弾':n===4?'盾':'感染',button=page.getByRole('button',{name:desired+'コマを選ぶ',exact:true});if(await button.count()&&await button.isEnabled()){await button.click();placed=desired}}}
 const options=await page.locator('[role="gridcell"]:not([disabled])').evaluateAll(nodes=>nodes.map(n=>({coordinate:n.dataset.coordinate,label:n.getAttribute('aria-label')})));
 const score=m=>(['A1','H1','A8','H8'].includes(m.coordinate)?1000:0)+Number(m.label.match(/(?:反転|と)(\d+)枚/)?.[1]??0)*10+(['A','H'].includes(m.coordinate[0])||['1','8'].includes(m.coordinate[1])?5:0);
 options.sort((a,b)=>score(b)-score(a)||a.coordinate.localeCompare(b.coordinate));assert(options.length,'No legal UI move');return{...options[0],placed}
}
const collect=async c=>[...c.segments,...await c.page.evaluate(()=>window.qaEvents??[])];
for(const variant of ['normal']){
 const check={variant,passed:false,moves:[],ackResponses:[],screenshots:[],syncNotices:[],reconnect:null,cleanup:null};result.checks.push(check);await save();
 const host=await client('host-'+variant,{width:390,height:844},check),guest=await client('guest-'+variant,{width:900,height:700},check),clients=[host,guest];let code='';
 try{
  await enter(host.page,'QA H',true,null,variant);await host.page.locator('[data-testid="online-room-code"]').waitFor({timeout:20000});code=(await host.page.locator('[data-testid="online-room-code"]').innerText()).trim();check.roomCode=code;assert(/^[A-Z0-9]{6}$/.test(code),'Invalid room code');
  await enter(guest.page,'QA G',false,code,variant);await Promise.all(clients.map(c=>c.page.locator('[role="gridcell"]').first().waitFor({timeout:20000})));let stable=await waitReady(clients,null,check);check.initialBoardEqual=true;const playerMoves=[0,0];
  for(let index=0;index<120&&!stable.finished;index++){
   const actorIndex=stable.counts[0]>0?0:1,actor=clients[actorIndex];playerMoves[actorIndex]++;const choice=await moveChoice(actor.page,variant,playerMoves[actorIndex]),before=JSON.stringify(stable.boards),clickedAt=Date.now();
   await actor.page.waitForTimeout(550);await actor.page.locator('[data-coordinate="'+choice.coordinate+'"]').click();stable=await waitReady(clients,before,check);
   check.moves.push({move:index+1,actor:actor.label,coordinate:choice.coordinate,placed:choice.placed,boardEqual:true,elapsedMs:Date.now()-clickedAt,nextEnabled:stable.counts,final:stable.finished});
   assert((await Promise.all(clients.map(c=>c.page.locator('.dragon-reaction-wipe').count()))).every(n=>n===0),'CPU-seat portrait shown in human-only room');
   const notices=await Promise.all(clients.map(c=>c.page.locator('.reversi-online-sync-message,.bakuretsu-online-sync-message').allTextContents()));for(let ci=0;ci<notices.length;ci++){for(const text of notices[ci]){if(text!=='相手の一手を優先して盤面を同期しました')throw Error('Critical online sync error: '+text);if(!check.syncNotices.some(n=>n.client===clients[ci].label&&n.text===text))check.syncNotices.push({client:clients[ci].label,text,firstAfterMove:index+1,publicBoardRecovered:true})}}check.moves.at(-1).publicBoardChanged=JSON.stringify(stable.boards)!==before;
   if(index===7&&!stable.finished){const old=JSON.stringify(stable.boards),start=Date.now();guest.segments.push(...await guest.page.evaluate(()=>window.qaEvents??[]));await guest.page.reload();await enter(guest.page,'QA G',false,code,variant);await guest.page.locator('[role="gridcell"]').first().waitFor({timeout:20000});stable=await waitReady(clients,null,check);assert(JSON.stringify(stable.boards)===old,'Reconnect changed public board');const events=await guest.page.evaluate(()=>window.qaEvents??[]);check.reconnect={passed:true,afterMove:index+1,elapsedMs:Date.now()-start,boardEqual:true,noOldSceneReplay:events.every(e=>e.selector!=='.reversi-cinematic')};assert(check.reconnect.noOldSceneReplay,'Reconnect replayed old scene');await Promise.all(clients.map(c=>shot(c.page,variant+'-'+c.label+'-reconnected')))}
   await save();if((index+1)%10===0)console.log(variant+' '+(index+1)+' actual placements, boards equal, ACK responses '+check.ackResponses.length)
  }
  assert(stable.finished,'No result within 120 actual legal placements');const scores=await Promise.all(clients.map(c=>c.page.locator('.reversi-result-score').innerText())),headings=await Promise.all(clients.map(c=>c.page.locator('.reversi-result-panel h2').innerText()));assert(scores[0]===scores[1]&&headings[0]===headings[1],'Final scores/winner differ');
  check.final={passed:true,actualPlacements:check.moves.length,scores,headings,publicBoard:stable.boards};check.events=await Promise.all(clients.map(collect));check.neutralNarration=check.events.map(events=>events.filter(e=>e.selector==='.dragon-reaction-narration').map(e=>e.text));check.cinematics=check.events.map(events=>events.filter(e=>e.selector==='.reversi-cinematic'));check.sceneFactsEqual=JSON.stringify(check.cinematics[0].map(e=>e.text))===JSON.stringify(check.cinematics[1].map(e=>e.text));assert(check.sceneFactsEqual,'Public cinematic sequence differs');if(variant==='bakuretsu'){assert(check.ackResponses.length>0,'No actual playback ACK');assert(check.ackResponses.every(a=>a.status===200),'ACK non-200')};await Promise.all(clients.map(c=>shot(c.page,variant+'-'+c.label+'-finished')));check.passed=true;console.log('PASS '+variant+' completed '+check.moves.length+' actual placements')
 }catch(error){check.error=error.message;check.events=await Promise.all(clients.map(collect)).catch(()=>[]);console.log('FAIL '+variant+': '+error.message);await Promise.allSettled(clients.map(c=>shot(c.page,variant+'-'+c.label+'-failure')))}
 finally{
  check.exits={};for(const c of clients){try{await c.page.getByRole('button',{name:'設定に戻る',exact:true}).first().click();check.exits[c.label]=await c.page.locator('[role="gridcell"]').count()===0}catch(error){check.exits[c.label]={error:error.message}}}
  check.cleanupStarted=true;
  if(code){try{check.cleanup=await host.page.evaluate(async({variant,code})=>{if(variant==='normal'){const api=await import('/src/features/reversi/reversiOnline.ts');await api.deleteReversiRoom(code);return{ownQaRoomDeleted:(await api.fetchReversiRoom(code))===null,method:'Existing deleteReversiRoom, only created QA code, after both UI exits'}}const api=await import('/src/features/reversi/bakuretsuReversiOnline.ts'),id=sessionStorage.getItem('dgp-bakuretsu-reversi-online-player-id');if(!id)return{ownQaRoomDeleted:false,error:'Host identity missing'};await api.deleteBakuretsuReversiRoom(code,id);return{ownQaRoomDeleted:(await api.fetchBakuretsuReversiRoom(code,id))===null,method:'Existing host delete RPC, only created QA code, after both UI exits'}},{variant,code})}catch(error){check.cleanup={ownQaRoomDeleted:false,error:error.message}}}
  await save();await host.context.close();await guest.context.close()
 }
 if(check.error?.includes('credit'))break
}
await browser.close();console.log(JSON.stringify({passed:result.checks.filter(c=>c.passed).length,failed:result.checks.filter(c=>!c.passed).length,errors:result.errors.length,warnings:result.warnings.length}));
