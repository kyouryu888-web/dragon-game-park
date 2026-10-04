import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '/src/styles/global.css';
import { DragonPresentationControl } from '/src/components/DragonPresentationControl';
import { decideDragonReaction, useDragonReactionPreference } from '/src/components/dragonReactions';
import { UnoTableView } from '/src/features/uno/UnoTableView';
import { createInitialUnoState } from '/src/features/uno/createInitialUnoState';
import { detectUnoDragonReactions } from '/src/features/uno/unoDragonReactions';
import { UnoCinematicOverlay } from '/src/features/uno/UnoCinematicOverlay';
import { BabanukiTable } from '/src/features/babanuki/BabanukiTable';
import { BabanukiShuffleCutin } from '/src/features/babanuki/BabanukiShuffleCutin';
import { DiceResultPanel } from '/src/features/babanuki/BabanukiShufflePanel';
import { detectBabanukiDragonReactions } from '/src/features/babanuki/babanukiDragonReactions';

const noop = () => {};
const unoStart = createInitialUnoState({ variant:'hard', playerConfigs:[{name:'あおい',isCpu:false},{name:'みどり',isCpu:false}] });
const card = (id, color='red') => ({id,kind:'number',color,value:3});
const unoBefore = { ...unoStart,status:'playing',currentPlayerId:'player-1',turnCount:4,direction:'clockwise',activeColor:'red',pendingDrawCount:0,pendingAction:null,hands:{'player-1':Array.from({length:7},(_,i)=>card(`hand${i}`)),'player-2':Array.from({length:7},(_,i)=>card(`secret${i}`))},discardPile:[card('table')] };
const unoAfter = { ...unoBefore,direction:'counterclockwise',currentPlayerId:'player-2',turnCount:5,discardPile:[{id:'public-reverse',kind:'action',symbol:'reverse',color:'red'}] };
const unoReverse = decideDragonReaction(detectUnoDragonReactions(unoBefore,unoAfter)[0]);
const babaPlayers = Array.from({length:3},(_,i)=>({id:`human-${i}`,name:['あおい','みどり','あかね'][i],isCpu:false,cpuLevel:'normal',hand:Array.from({length:4},(_,n)=>({id:`h${i}c${n}`,suit:'spade',rank:n+1})),spotlightCardId:null,finishedRank:null,shuffleRight:true}));
const babaState = {players:babaPlayers,seatOrder:babaPlayers.map(p=>p.id),currentPlayerId:'human-0',phase:'awaiting-draw',shuffleUsedThisTurn:false,pendingShuffle:null,discardPile:[],finishOrder:[],loserId:null,events:[],eventSeq:1};
const babaShuffle = decideDragonReaction(detectBabanukiDragonReactions({kind:'shuffle',declarerId:'human-0',dice:3,mapping:{}},babaPlayers,'fixture',3)[0]);
const babaDraw = decideDragonReaction(detectBabanukiDragonReactions({kind:'draw',fromId:'human-2',toId:'human-0',fromIndex:0,cardId:'private-never-rendered'},babaPlayers,'fixture',2)[0]);
const shuffleActor = {id:'cpu',name:'白銀ドラゴン',isCpu:true,cpuLevel:'normal'};
const flights = babaPlayers.map(p=>({id:`flight-${p.id}`,fromKey:`hand:${p.id}`,toKey:'pile',card:null,faceUp:false,stack:4,durationMs:1250}));
function Fixture() {
  const [scenario,setScenario] = useState('uno-reverse');
  const [serial,setSerial] = useState(0);
  const [cutinVisible,setCutinVisible] = useState(false);
  const {preference} = useDragonReactionPreference();
  const choose = value => {setScenario(value);setSerial(n=>n+1);};
  const publicShuffle = scenario === 'baba-public-shuffle';
  const shuffle = scenario === 'baba-shuffle' || publicShuffle;
  const isUno = scenario.startsWith('uno');
  return <main style={{padding:12,minHeight:'100vh'}}>
    <header style={{position:'relative',height:54,fontSize:11,color:'#efd7ff'}}>
      <strong>公開イベント固定データ検証（実対局ではありません）</strong>
      <div>描画は実ゲームのコンポーネントを使用</div>
      <DragonPresentationControl />
    </header>
    <nav style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>{['uno-reverse','baba-draw','baba-declared','baba-shuffle','baba-public-shuffle','baba-four','uno-cut2','uno-cut4'].map(value=><button id={`case-${value}`} key={value} onClick={()=>choose(value)} style={{fontSize:10,padding:5}}>{value}</button>)}</nav>
    <div data-scenario={scenario} data-shuffle-cutin-visible={cutinVisible}>
      {isUno ? <UnoTableView state={unoAfter} currentPlayer={unoAfter.players[1]} nextPlayerId='player-1' topCard={unoAfter.discardPile[0]} currentHand={unoAfter.hands['player-1']} handPlayer={unoAfter.players[0]} playableIds={new Set()} canAct={false} isCpuThinking={false} message='公開されたリバースの案内' dragonReaction={scenario==='uno-reverse'?unoReverse:null} dragonPreference={preference} onPlay={noop} onDraw={noop} onAcceptDraw={noop}/> : <BabanukiTable state={babaState} viewerId='human-0' drawTargetId='human-2' canDraw={false} selectedIndex={null} onDrawCard={noop} onSelectOwnCard={noop} flights={shuffle?flights:[]} hidden={[]} pairFlashPlayerId={null} leavingPlayerId={null} shuffleState='ready' canShuffle={false} onShuffle={noop} shuffleDice={shuffle?3:scenario==='baba-four'?4:null} dragonReaction={publicShuffle&&!cutinVisible?babaShuffle:scenario==='baba-draw'?babaDraw:null} dragonPreference={preference}/>}
      {shuffle && <BabanukiShuffleCutin key={`cutin-${serial}`} dice={3} actor={publicShuffle?babaPlayers[0]:shuffleActor} preference={preference} onVisibilityChange={setCutinVisible}/>}
      {(shuffle || scenario==='baba-four' || scenario==='baba-declared') && <DiceResultPanel dice={shuffle||scenario==='baba-declared'?3:4} actor={shuffleActor} declarerName='白銀ドラゴン' stage={scenario==='baba-declared'?'dice':'moving'} preference={preference}/>}
      {scenario.startsWith('uno-cut') && <UnoCinematicOverlay key={`uno-cut-${serial}`} event={{kind:'draw-counter',key:`fixture-${serial}`,playerId:'cpu',playerName:'白銀ドラゴン',addedCount:scenario==='uno-cut2'?2:4,totalCount:scenario==='uno-cut2'?4:6,cardName:scenario==='uno-cut2'?'ドロー2':'ワイルド ドロー4',reversed:false}} players={[{...shuffleActor,isEliminated:false}]} preference={preference}/>}
    </div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);