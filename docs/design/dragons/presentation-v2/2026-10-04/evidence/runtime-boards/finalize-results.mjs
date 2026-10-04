import fs from 'node:fs/promises';import path from 'node:path';
const folder=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:\/)/,'$1'));
const read=async name=>JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));
const initial=await read('results.json');const resolved=await read('results-resolved-qa-issues.json');const narrow=await read('results-rerun.json');const online=await read('online-results.json');
const byName=new Map(initial.checks.map(check=>[check.name,{...check,source:'results.json'}]));
for(const [report,source] of [[resolved,'results-resolved-qa-issues.json'],[narrow,'results-rerun.json']])for(const check of report.checks)byName.set(check.name,{...check,source});
const checks=[...byName.values()];
const final={environment:initial.environment,date:'2026-10-04',checks,
 summary:{passed:checks.filter(check=>check.passed).length,failed:checks.filter(check=>!check.passed).length,liveOnlinePassed:online.checks.filter(check=>check.passed).length,liveOnlineFailed:online.checks.filter(check=>!check.passed).length,finalAppErrors:resolved.errors.length+narrow.errors.length+online.errors.length},
 resolvedDiagnostics:[{check:'Mancala actual completed major capture 375 lively',issue:'First fixture navigation requested missing favicon.ico and produced a 404 console error.',resolution:'Explicit existing /favicon.svg favicon added to the test fixture. Same 375px capture and console-health check reran successfully.'},{check:'Reduced-motion backgammon 390',issue:'Framer Motion emits its documented diagnostic warning when reduced motion is enabled.',resolution:'This exact expected reduced-motion diagnostic is classified separately. Reduced-motion rendering, public scene and console error checks reran successfully.'}],
 onlineSource:'online-results.json',screenshots:[...new Set([...initial.screenshots,...resolved.screenshots,...narrow.screenshots])],
 limits:['No real two-client standard/Bakuretsu Reversi match in this run. Existing board, animation, ACK/SQL focused tests passed.','Online checks are short live Mancala/Backgammon sessions, not full-match or reconnect coverage.','Fixed-event screens are explicitly test fixtures and are not evidence of live Supabase synchronization.']};
await fs.writeFile(path.join(folder,'final-results.json'),JSON.stringify(final,null,2));
for(const game of online.checks){await fs.writeFile(path.join(folder,`online-${game.game==='マンカラ'?'mancala':'backgammon'}-final.json`),JSON.stringify({environment:online.environment,check:game,room:online.rooms.find(room=>room.game===game.game),errors:online.errors},null,2));}
console.log(JSON.stringify(final.summary));
