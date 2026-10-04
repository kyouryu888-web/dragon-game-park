import {chromium} from 'playwright-core';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage();await page.goto('http://127.0.0.1:5178');
const cleanup=await page.evaluate(async()=>{
const {supabase}=await import('/src/lib/supabase.ts');
const rooms=[{table:'uno_rooms',code:'9EP526'},{table:'babanuki_rooms',code:'FWFH5S'}],out=[];
for(const room of rooms){const del=await supabase.from(room.table).delete().eq('room_code',room.code);const check=await supabase.from(room.table).select('room_code').eq('room_code',room.code);out.push({table:room.table,roomCode:room.code,deleted:!del.error,remaining:check.data?.length,error:del.error?.message??check.error?.message??null});}
return out;});await writeFile('docs/design/dragons/presentation-v2/2026-10-04/evidence/release-cards/first-attempt-cleanup.json',JSON.stringify(cleanup,null,2));console.log(JSON.stringify(cleanup));await browser.close();