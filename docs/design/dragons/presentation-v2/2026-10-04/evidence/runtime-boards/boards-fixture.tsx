import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '/src/styles/global.css';
import { ReversiGameScreen } from '/src/features/reversi/ReversiGameScreen';
import { createInitialReversiState } from '/src/features/reversi/reversiRules';
import { BakuretsuReversiGameScreen } from '/src/features/reversi/BakuretsuReversiGameScreen';
import { DEFAULT_BAKURETSU_REVERSI_CONFIG } from '/src/features/reversi/bakuretsuUi';
import { initGame, makeRng, emptyCell, idx } from '/src/features/reversi/bakuretsu/rules';
import { DEFAULT_CONFIG } from '/src/features/reversi/bakuretsu/config';
import { MancalaGamePage } from '/src/features/mancala/MancalaGamePage';
import { createInitialMancalaState } from '/src/features/mancala/createInitialMancalaState';
import { applyMove as mancalaMove, getMovePreview } from '/src/features/mancala/mancalaRules';
import { BackgammonPlayScreen } from '/src/features/backgammon/BackgammonPlayScreen';
import { createInitialBackgammonState } from '/src/features/backgammon/createInitialBackgammonState';
import { offerDouble, acceptDouble, declineDouble } from '/src/features/backgammon/backgammonRules';
import { detectBackgammonDragonReactions } from '/src/features/backgammon/backgammonDragonReactions';
import { useDragonReactions, useDragonReactionPreference } from '/src/components/dragonReactions';

const parameters = new URLSearchParams(location.search);
const scenario = parameters.get('scenario') || 'mancala';
const noop = () => {};
const humanConfig = { mode: 'online', name: '黒の人間', name2: '白の人間', cpuLevel: 'normal', humanSide: 'black' } as const;
const mancalaConfig = { playerCount: 2, players: [
  {name:'人間1',isCpu:false,cpuLevel:'normal'}, {name:'人間2',isCpu:false,cpuLevel:'normal'},
] } as const;
(window as any).qaBoard = { scenario, fixture: '固定された公開盤面と公開イベント。実オンライン接続ではない。' };

function capturePlan() {
  const start = createInitialMancalaState(mancalaConfig as any);
  const seen = new Set<string>();
  function search(state: any, path: string[], remaining: number): string[] | null {
    if (!remaining) return null;
    const key = `${state.currentPlayerId}:${state.board.map((pit:any)=>pit.stones).join(',')}:${remaining}`;
    if (seen.has(key)) return null;
    seen.add(key);
    for (const pit of state.board.filter((pit:any)=>!pit.isStore && pit.ownerPlayerId===state.currentPlayerId && pit.stones>0)) {
      const preview = getMovePreview(state,pit.id);
      const next = mancalaMove(state,pit.id);
      if (next.status !== 'playing') continue;
      if (preview && preview.captureCount >= 6) return [...path,pit.id];
      const result = search(next,[...path,pit.id],remaining-1);
      if (result) return result;
    }
    return null;
  }
  for (let depth=1;depth<=6;depth++) {
    seen.clear();
    const path=search(start,[],depth);
    if (path) return path;
  }
  return [];
}

function BackgammonFixture() {
  const initial = { ...createInitialBackgammonState(), phase:'rolling' as const, currentPlayer:'white' as const };
  const [state,setState] = useState(initial);
  const [events,setEvents] = useState<any[]>([]);
  const {preference} = useDragonReactionPreference();
  const {active} = useDragonReactions({ matchId:'qa-public-bg',events,preference });
  function advance(next:any) {
    const sequence = events.length + 1;
    const found=detectBackgammonDragonReactions(state,next,{matchId:'qa-public-bg',sequence,names:{white:'人間1',black:'人間2'}});
    setState(next); setEvents(previous=>[...previous,...found]);
    (window as any).qaBoard.lastCues=found;
  }
  (window as any).qaBoard.trigger = (action:string) => {
    if(action==='hit') advance({...state, bar:{white:0,black:2}});
    if(action==='single-hit') advance({...state, bar:{white:0,black:1}});
    if(action==='doubles') advance({...state,phase:'moving',rolled:[3,3],dice:[3,3,3,3]});
    if(action==='offer') advance(offerDouble(state));
    if(action==='accept') advance(acceptDouble(state));
    if(action==='drop') advance(declineDouble(state));
  };
  return <BackgammonPlayScreen state={state} publicReaction={{event:active,preference}}
    selectedFrom={null} destinations={new Set()} chainDestinations={new Set()} autoButton={null} offDestFor={null} pickableFroms={new Set()}
    centerMsg="公開イベント固定検証" movesLeftTxt="" showRollBtn={true} rollLabel="サイコロを振る" topPlayer={{name:'人間2',sub:'LOCAL',avatar:'initial',initial:'2',active:false}}
    botPlayer={{name:'人間1',sub:'LOCAL',avatar:'initial',initial:'1',active:true}} pips={{white:167,black:167}}
    onRoll={()=>{(window as any).qaBoard.rollClicked=true;}} onTapPoint={noop} onTapBar={noop} onTapOffTop={noop} onTapOffBot={noop}
    onQuit={noop} over={null} onRematch={noop} onBackToSettings={noop} onBackToHome={noop} canDouble={true}
    onDouble={()=>advance(offerDouble(state))} isDoubleWait={false} isDoubleOffer={state.phase==='double-offered'}
    onAcceptDouble={()=>advance(acceptDouble(state))} onDeclineDouble={()=>advance(declineDouble(state))} />;
}

function Fixture() {
  if(scenario==='mancala') {
    (window as any).qaBoard.capturePlan=capturePlan();
    return <MancalaGamePage config={mancalaConfig as any} onBackToSetup={noop} onBackToHome={noop}/>;
  }
  if(scenario==='backgammon') return <BackgammonFixture/>;
  if(scenario.startsWith('reversi')) {
    const initial=createInitialReversiState(humanConfig,()=>0.25);
    const board=initial.board.map(row=>[...row]);
    const row=scenario==='reversi-light'?2:0;
    board[row][0]=null; board[row][1]='white'; board[row][2]=scenario==='reversi-light'?'white':'black';
    if(scenario==='reversi-light') board[row][3]='black';
    return <ReversiGameScreen config={humanConfig} initialState={{...initial,board}} onBackToSetup={noop} onBackToHome={noop}/>;
  }
  const state=initGame(DEFAULT_CONFIG,makeRng(10));
  state.board=Array.from({length:64},emptyCell);
  function put(x:number,y:number,owner:any,specialType:any='NONE') {
    state.board[idx(x,y)]={state:'FACEUP',owner,specialType,durability:0,isQueued:false,activated:false};
  }
  put(2,4,'BLACK');put(3,4,'WHITE');put(4,4,'WHITE','BOMB');
  put(3,2,'WHITE');put(4,2,'BLACK');
  return <BakuretsuReversiGameScreen config={{...DEFAULT_BAKURETSU_REVERSI_CONFIG,mode:'online',name:'黒の人間',name2:'白の人間'}}
    initialSnapshot={{state,result:null,legalMoves:[],clocks:{BLACK:1200000,WHITE:1200000},autoMoveCounts:{BLACK:0,WHITE:0},matchNo:1,playbackReadyAt:null,turnStartsAt:null,turnDeadline:null}}
    onBackToSetup={noop} onBackToHome={noop}/>;
}

createRoot(document.getElementById('root')!).render(<>
  <Fixture/>
  <p data-fixture="public-board-events" style={{position:'fixed',right:3,bottom:0,fontSize:8,zIndex:1,pointerEvents:'none',opacity:.65}}>公開盤面固定の検証用ページ</p>
</>);
