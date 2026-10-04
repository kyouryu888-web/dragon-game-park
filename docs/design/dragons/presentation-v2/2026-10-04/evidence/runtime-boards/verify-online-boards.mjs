import {chromium} from 'playwright-core';import fs from 'node:fs/promises';import path from 'node:path';
const target='http://127.0.0.1:5178';const output=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/,'$1'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const result={environment:{url:target,browser:'Edge headless',hostViewport:'390x844',guestViewport:'900x700',connection:'Live existing Supabase via app UI. No seeded payload or private API writes.'},checks:[],rooms:[],errors:[]};
const assert=(value,message)=>{if(!value)throw new Error(message);};
async function newPage(viewport){const context=await browser.newContext({viewport});await context.addInitScript(()=>{window.qaOnlineEvents=[];addEventListener('DOMContentLoaded',()=>{const seen=new Set();new MutationObserver(()=>{for(const selector of ['.mancala-capture-moment','.dragon-reaction-narration']){const node=document.querySelector(selector);if(node&&!seen.has(node)){seen.add(node);window.qaOnlineEvents.push({selector,text:node.textContent,time:performance.now()});}}}).observe(document.body,{subtree:true,childList:true});});});const page=await context.newPage();page.on('pageerror',error=>result.errors.push(error.message));return{page,context};}
async function setup(page,game,name,create,code){await page.goto(target);await page.getByRole('button',{name:`${game}の盤へ進む`}).click();await page.getByPlaceholder('挑戦者の名（なくてもよい）').fill(name);if(create){await page.getByRole('button',{name:'ルームを作成',exact:true}).click();await page.getByRole('button',{name:'ルームを作成する',exact:true}).click();}else{await page.locator('input').last().fill(code);await page.getByRole('button',{name:'このコードで参加する',exact:true}).click();}}
async function screenshot(page,name){await page.screenshot({path:path.join(output,`${name}.png`),fullPage:false});}
async function leave(page,game){try{if(game==='バックギャモン'){const quit=page.getByRole('button',{name:'盤を離れる',exact:true});if(await quit.count()){await quit.click();await quit.click();}else if(await page.getByRole('button',{name:/設定に戻る/}).count())await page.getByRole('button',{name:/設定に戻る/}).first().click();}else{const exit=page.getByRole('button',{name:'ゲーム選択に戻る',exact:true});if(await exit.count())await exit.click();}return{exited:game==='バックギャモン'?await page.locator('.backgammon-play-screen').count()===0:await page.getByRole('button',{name:'マンカラの盤へ進む',exact:true}).count()>0};}catch(error){return{exited:false,error:error.message};}}
for(const game of ['マンカラ','バックギャモン']){
 const host=await newPage({width:390,height:844});const guest=await newPage({width:900,height:700});
 const check={game,passed:false};let roomCode='';
 try{
  await setup(host.page,game,'DGP QA H',true);
  const code=host.page.locator('[data-testid="online-room-code"]');
  if(game==='バックギャモン'){await code.waitFor({timeout:20000});roomCode=await code.innerText();}
  else {await host.page.getByText('コードをコピー',{exact:true}).waitFor({timeout:20000});roomCode=await host.page.locator('body').innerText().then(text=>text.match(/\b[A-Z0-9]{6}\b/)?.[0]);}
  assert(roomCode&&/^[A-Z0-9]{6}$/.test(roomCode),'No six-character room code');result.rooms.push({game,roomCode});
  await setup(guest.page,game,'DGP QA G',false,roomCode);
  if(game==='マンカラ'){
   await host.page.locator('.pit-btn.is-selectable').first().waitFor({state:'visible',timeout:20000});await guest.page.locator('.pit-btn').first().waitFor({timeout:20000});
   const moves=[{page:host.page,pit:'p1-pit-4'},{page:guest.page,pit:'p2-pit-0'},{page:host.page,pit:'p1-pit-0'}];
   check.moves=[];
   for(const move of moves){
    await move.page.locator(`[data-pit-id="${move.pit}"] button`).waitFor({state:'visible'});await move.page.locator(`[data-pit-id="${move.pit}"] button`).click();
    await move.page.waitForTimeout(60);
    if(move.pit==='p1-pit-0') {
      const facts=await Promise.all([host.page,guest.page].map(async(page,index)=>{
        await page.locator('.mancala-capture-moment').waitFor({state:'visible',timeout:12000});
        const fact=await page.locator('.mancala-capture-moment strong').innerText();
        await screenshot(page,index===0?'online-mancala-host-capture':'online-mancala-guest-capture');
        return fact;
      }));
      assert(facts[0]===facts[1]&&facts[0]==='7石を捕獲','Capture facts differ');
      check.publicFacts=facts;check.noCpuSeats=await host.page.locator('.dragon-reaction-wipe').count()===0;
      await Promise.all([host.page,guest.page].map(page=>page.locator('.mancala-capture-moment').waitFor({state:'detached',timeout:2000})));
    }
    await Promise.all([host.page,guest.page].map(page=>page.waitForFunction(()=>!document.querySelector('.floating-cluster'))));
    // Wait until the next player's actual button becomes enabled on their independent client.
    const next=move.pit==='p1-pit-4'?guest.page:move.pit==='p2-pit-0'?host.page:guest.page;
    await next.locator('.pit-btn.is-selectable').first().waitFor({timeout:16000});
    const boards=await Promise.all([host.page,guest.page].map(page=>page.locator('[data-pit-id]').evaluateAll(nodes=>nodes.map(node=>({pit:node.dataset.pitId,label:node.querySelector('button')?.getAttribute('aria-label')?.replace('（選択可能）',''),text:node.innerText})).sort((a,b)=>a.pit.localeCompare(b.pit)))));
    assert(JSON.stringify(boards[0])===JSON.stringify(boards[1]),'Mancala public board differs between clients');check.moves.push({pit:move.pit,boardEqual:true});
   }
   check.publicEvents=await Promise.all([host.page,guest.page].map(page=>page.evaluate(()=>window.qaOnlineEvents)));
  }else{
   await Promise.all([host.page,guest.page].map(page=>page.locator('.backgammon-play-screen').waitFor({timeout:20000})));
   // The host rolls the actual opening dice. The winner then proposes a real cube action.
   await host.page.getByRole('button',{name:/サイコロ|振る|先手/}).first().click();await host.page.waitForTimeout(1900);
   let proposer;
   if(await host.page.getByRole('button',{name:'ダブル提案',exact:true}).count())proposer=host.page;
   else if(await guest.page.getByRole('button',{name:'ダブル提案',exact:true}).count())proposer=guest.page;
   else {await host.page.waitForTimeout(2000);if(await host.page.getByRole('button',{name:'ダブル提案',exact:true}).count())proposer=host.page;else proposer=guest.page;}
   await proposer.getByRole('button',{name:'ダブル提案',exact:true}).click();
   await Promise.all([host.page,guest.page].map(page=>page.getByText('DOUBLE OFFERED!',{exact:true}).waitFor({timeout:12000})));
   check.proposer=proposer===host.page?'host':'guest';await Promise.all([screenshot(host.page,'online-backgammon-host-offer'),screenshot(guest.page,'online-backgammon-guest-offer')]);
   const accepter=proposer===host.page?guest.page:host.page;await accepter.getByRole('button',{name:'受ける (Take)',exact:true}).click();
   await Promise.all([host.page,guest.page].map(page=>page.getByText('DOUBLE ACCEPTED!!',{exact:true}).waitFor({timeout:12000})));
   await Promise.all([screenshot(host.page,'online-backgammon-host-accept'),screenshot(guest.page,'online-backgammon-guest-accept')]);
   const portraits=await Promise.all([host.page,guest.page].map(page=>page.locator('.dragon-reaction-wipe').count()));assert(portraits.every(count=>count===0),'Human online room has a CPU seat');check.sameCubeFacts=true;check.noCpuSeats=true;
   await Promise.all([host.page,guest.page].map(page=>page.getByText('DOUBLE ACCEPTED!!',{exact:true}).waitFor({state:'detached',timeout:5000})));
  }
  check.passed=true;
 }catch(error){check.error=error.message;check.publicEvents=await Promise.all([host.page,guest.page].map(page=>page.evaluate(()=>window.qaOnlineEvents)));console.log(`FAIL online ${game}: ${error.message}`);await Promise.allSettled([screenshot(host.page,`online-${game}-host-failure`),screenshot(guest.page,`online-${game}-guest-failure`)]);}
 finally{check.exits={host:await leave(host.page,game),guest:await leave(guest.page,game)};await host.context.close();await guest.context.close();result.checks.push(check);await fs.writeFile(path.join(output,'online-results.json'),JSON.stringify(result,null,2));if(check.passed)console.log(`PASS online ${game}`);}
}
await browser.close();console.log(JSON.stringify({passed:result.checks.filter(check=>check.passed).length,failed:result.checks.filter(check=>!check.passed).length,errors:result.errors.length}));
