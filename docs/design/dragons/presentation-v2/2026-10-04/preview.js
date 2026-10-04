const params = new URLSearchParams(location.search);
const ROOT = document.getElementById('preview-root');
const images = {
  uno: {
    old: new URL('../../../../../src/features/uno/assets/draw-counter.webp', import.meta.url).href,
    current: new URL('../../../../../src/assets/dragons/cutins/uno/lv3-attack.webp', import.meta.url).href,
    proposed: new URL('./images/uno-draw-counter-lv3-v2.png', import.meta.url).href,
  },
  babanuki: { proposed: new URL('./images/babanuki-shuffle-lv3-v1.png', import.meta.url).href },
};
const iframeMode = params.get('embed') === '1';
if (iframeMode) await bootGameFrame();
else bootReview();

function bootReview() {
  document.body.className = 'review-page';
  const selected = {
    game: params.get('game') === 'babanuki' ? 'babanuki' : 'uno',
    version: ['old','current','proposed'].includes(params.get('version')) ? params.get('version') : 'proposed',
    viewport: params.get('viewport') === 'desktop' ? 'desktop' : 'mobile',
    phase: ['wipe','cutin','after'].includes(params.get('phase')) ? params.get('phase') : 'cutin',
    reduced: params.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches,
    playing: false,
  };
  ROOT.innerHTML = `<main class="review-shell">
    <header class="review-header"><div><h1>ゲームらしさが伝わる演出へ</h1><p>小さなリアクションを重ね、見せ場でカードが躍る。画像と出し方を、実寸で比べます。</p></div><a href="./EVENT_MATRIX.md">5ゲームの場面表を見る</a></header>
    <div class="review-layout"><aside class="review-controls" aria-label="比較条件">
      <div class="control-group"><label class="control-label" for="game">ゲーム</label><select id="game" class="game-select"><option value="uno">UNO · ドロー返し</option><option value="babanuki">ババ抜き · シャッフル</option></select></div>
      <fieldset class="control-group version-group"><legend>画像とリアクション</legend><div class="version-stack"><button data-version="old"><strong>旧画像</strong><span>UNOカードと動きの参考</span></button><button data-version="current"><strong>現行</strong><span id="current-label">公開済みのドラゴン画像</span></button><button data-version="proposed"><strong>今回の候補</strong><span>Lv3の姿＋ゲームの小道具</span></button></div></fieldset>
      <fieldset class="control-group"><legend>画面の大きさ</legend><div class="segments"><button data-viewport="mobile">スマホ</button><button data-viewport="desktop">PC</button></div></fieldset>
      <label class="motion-check"><input id="reduce-motion" type="checkbox">動きを抑えて見る</label>
      <button class="replay" id="replay">演出を再生</button>
      <p class="review-note">既存の盤面・カード・ワイプをテストデータで表示する比較用デモです。UNOは前後のワイプを含む比較用再生、ババ抜きは判定1700ms→移動2500ms→保持500msです。画像候補と台詞は未採用です。</p>
    </aside><section aria-label="演出プレビュー">
      <div class="preview-heading"><h2 id="scene-title"></h2><span id="frame-label"></span></div>
      <div class="phase-row" aria-label="場面"><button data-phase="wipe">① 小さなリアクション</button><button data-phase="cutin">② 見せ場</button><button data-phase="after">③ 余韻</button><span class="phase-time" id="phase-time">静止表示</span></div>
      <div class="frame-scroll"><div class="frame-holder"><iframe class="game-frame" title="演出の比較用ゲーム画面"></iframe></div></div>
      <p class="asset-error" role="status">画像候補を読み込めませんでした。生成画像が保存された後、ページを再読み込みしてください。</p>
      <p class="preview-summary" id="summary"></p>
      <div class="review-links"><a id="source-capture" target="_blank" rel="noopener">参考：前回検証した実画面</a><a id="source-image" target="_blank" rel="noopener">画像を原寸で開く</a></div>
    </section></div></main>`;
  const frame = ROOT.querySelector('iframe');
  const holder = ROOT.querySelector('.frame-holder');
  let timers = [];
  function stop() { timers.forEach(clearTimeout); timers = []; selected.playing = false; }
  function update(reload = false) {
    if (selected.game === 'babanuki' && selected.version === 'old') selected.version = 'current';
    const mobile = selected.viewport === 'mobile';
    holder.style.width = mobile ? '390px' : '900px';
    holder.style.height = mobile ? '844px' : '700px';
    ROOT.querySelector('#game').value = selected.game;
    ROOT.querySelector('#reduce-motion').checked = selected.reduced;
    ROOT.querySelector('[data-version="old"]').disabled = selected.game === 'babanuki';
    for (const [key,attribute] of [['version','data-version'],['viewport','data-viewport'],['phase','data-phase']]) ROOT.querySelectorAll(`[${attribute}]`).forEach(button => button.setAttribute('aria-pressed',String(button.getAttribute(attribute) === selected[key])));
    ROOT.querySelector('#scene-title').textContent = selected.game === 'uno' ? 'ドロー2で返す瞬間' : '出目3 · 全手札をシャッフル';
    ROOT.querySelector('#current-label').textContent = selected.game === 'uno' ? '公開済みのドラゴン画像' : '既存のサイコロ判定パネル';
    ROOT.querySelector('#frame-label').textContent = mobile ? '390 × 844 px · 実寸' : '900 × 700 px · 実寸';
    ROOT.querySelector('#phase-time').textContent = selected.playing ? '再生中' : '静止表示';
    ROOT.querySelector('#summary').textContent = selected.game === 'uno'
      ? selected.version === 'proposed' ? '色とりどりのカードがドラゴンの腕から外へ広がる構図。ワイプは「まだ返せる！」から「お返しだ！」へ、表情と台詞を短く切り替えます。' : selected.version === 'old' ? 'カードが弧を描く旧画像。Lv3の姿の比較ではなく、カードと動きが一体になった構図の参考です。' : '現在はLv3のドラゴンを中心に、既存のカード飛行を重ねる演出です。ワイプの台詞は汎用の内容です。'
      : selected.version === 'proposed' ? '伏せ札を中央で大きく混ぜるシャッフルの見せ場。カードの表、ジョーカーの場所、交換相手は示しません。' : '現在のシャッフルはサイコロ判定と移動パネルが中心です。この場面にドラゴンの全画面カットインはありません。';
    ROOT.querySelector('#source-capture').href = selected.game === 'uno'
      ? new URL('../../cutins-production/2026-09-20/previews/uno-mobile-wipe.png', import.meta.url).href
      : new URL('../../cutins-production/2026-09-20/previews/babanuki-guest-mobile.png', import.meta.url).href;
    const asset = images[selected.game][selected.version];
    ROOT.querySelector('#source-image').hidden = !asset;
    if (asset) ROOT.querySelector('#source-image').href = asset;
    const url = new URL(location.href); for (const key of ['game','version','viewport','phase']) url.searchParams.set(key,selected[key]); url.searchParams.set('reduced',selected.reduced ? '1':'0'); history.replaceState(null,'',url);
    if (reload || !frame.src) { const embed = new URL('./preview.html',import.meta.url); embed.search = new URLSearchParams({embed:'1',game:selected.game,version:selected.version,phase:selected.phase,reduced:selected.reduced?'1':'0'}).toString(); frame.src = embed.href; }
    else frame.contentWindow?.postMessage({type:'dragon-design-preview',...selected},location.origin);
  }
  ROOT.querySelector('#game').addEventListener('change',event => {stop(); selected.game = event.target.value; update(true);});
  ['version','viewport','phase'].forEach(key => ROOT.querySelectorAll(`[data-${key}]`).forEach(button => button.addEventListener('click',() => {stop(); selected[key] = button.dataset[key]; update(key === 'version');})));
  ROOT.querySelector('#reduce-motion').addEventListener('change',event => {stop(); selected.reduced = event.target.checked; update();});
  ROOT.querySelector('#replay').addEventListener('click',() => {
    stop(); selected.playing = true; selected.phase = 'wipe'; update();
    const revealAt = selected.game === 'babanuki' ? 1700 : 1400;
    const finishAt = revealAt + (selected.game === 'babanuki' ? 2500 : 2400);
    const stopAt = finishAt + (selected.game === 'babanuki' ? 500 : 1400);
    timers.push(setTimeout(() => {selected.phase = 'cutin'; update();},revealAt));
    timers.push(setTimeout(() => {selected.phase = 'after'; update();},finishAt));
    timers.push(setTimeout(() => {selected.playing = false; update();},stopAt));
  });
  addEventListener('message',event => {if(event.origin === location.origin && event.data?.type === 'dragon-design-asset-status') ROOT.querySelector('.asset-error').classList.toggle('is-visible',!event.data.ok);});
  update(true);
}

async function bootGameFrame() {
  await import('../../../../../src/styles/global.css');
  const [{default:React},{createRoot},{UnoTableView},{UnoCinematicOverlay},{BabanukiTable},{DiceResultPanel}] = await Promise.all([
    import('react'),import('react-dom/client'),
    import('../../../../../src/features/uno/UnoTableView.tsx'),import('../../../../../src/features/uno/UnoCinematicOverlay.tsx'),
    import('../../../../../src/features/babanuki/BabanukiTable.tsx'),import('../../../../../src/features/babanuki/BabanukiShufflePanel.tsx'),
  ]);
  // Re-append review-only styling after the imported production styles.
  const previewStyle = document.createElement('link'); previewStyle.rel = 'stylesheet'; previewStyle.href = new URL('./preview.css',import.meta.url).href; document.head.append(previewStyle);
  const h = React.createElement;
  const noop = () => {};
  const viewer = 'design-viewer';
  const silver = 'design-silver';
  const state = { game:params.get('game') === 'babanuki' ? 'babanuki':'uno',version:params.get('version') ?? 'proposed',phase:params.get('phase') ?? 'cutin',reduced:params.get('reduced') === '1',playing:false,sequence:0 };
  const root = createRoot(ROOT);
  const unoPlayers = [{id:viewer,name:'あなた',isCpu:false,isEliminated:false},{id:silver,name:'白銀ドラゴン',isCpu:true,cpuLevel:'normal',isEliminated:false},{id:'design-baby',name:'ベビードラゴン',isCpu:true,cpuLevel:'very-easy',isEliminated:false}];
  const template = [{kind:'number',color:'red',value:2},{kind:'action',color:'blue',symbol:'draw2'},{kind:'number',color:'green',value:1},{kind:'action',color:'green',symbol:'skip'},{kind:'wild',symbol:'wild'},{kind:'wild',symbol:'wild-draw4'},{kind:'number',color:'blue',value:3}];
  const hand = owner => template.map((card,i) => ({...card,id:`${owner}-${i}`}));
  const topCard = {id:'design-top',kind:'action',color:'red',symbol:'draw2'};
  const uno = {gameId:'design-fixture',variant:'hard',status:'playing',players:unoPlayers,hands:Object.fromEntries(unoPlayers.map(p=>[p.id,hand(p.id)])),deck:hand('deck'),discardPile:[topCard],currentPlayerId:silver,starterDraws:[],direction:'clockwise',activeColor:'red',pendingDrawCount:4,lastDrawCardValue:2,pendingAction:null,winnerPlayerId:null,finalScores:null,eliminatedScores:{},turnCount:12,unoDeclaredIds:[]};
  const babaCards = (owner,count) => Array.from({length:count},(_,i)=>({id:`${owner}-${i}`,suit:['spade','heart','club','diamond'][i%4],rank:i+1}));
  const babaPlayers = [{id:viewer,name:'あなた',isCpu:false,cpuLevel:'normal',hand:babaCards(viewer,7)},{id:'design-baby',name:'ベビードラゴン',isCpu:true,cpuLevel:'very-easy',hand:babaCards('baby',5)},{id:silver,name:'白銀ドラゴン',isCpu:true,cpuLevel:'normal',hand:babaCards(silver,6)},{id:'design-king',name:'ドラゴンキング',isCpu:true,cpuLevel:'hard',hand:babaCards('king',4)}].map(p=>({...p,spotlightCardId:null,finishedRank:null,shuffleRight:true}));
  const baba = {players:babaPlayers,seatOrder:babaPlayers.map(p=>p.id),currentPlayerId:silver,phase:'rolling',shuffleUsedThisTurn:true,pendingShuffle:{declarerId:silver,dice:3},discardPile:babaCards('discard',12),finishOrder:[],loserId:null,events:[],eventSeq:1};
  function reaction() {
    const proposed = state.version === 'proposed';
    const after = state.phase === 'after';
    const speech = proposed ? state.game === 'uno' ? after ? 'お返しだ！':'まだ返せる！' : after ? '混ざったね！':'流れを変える！' : after ? 'ふふ、余裕さ。':'まだ平気さ。';
    const emotion = proposed ? after ? 'smug':state.game === 'uno' ? 'scared':'angry' : 'joy';
    return {key:`design-${state.sequence}-${state.phase}`,matchId:'design-fixture',sequence:state.sequence,kind:state.game === 'uno'?'uno-draw-counter':'babanuki-shuffle',cpu:{id:silver,name:'白銀ドラゴン',level:3},outcome:'neutral',factLabel:state.game === 'uno'?'ドロー2で返した！':'シャッフルタイム',acting:'sincere',emotion,speech,stages:[{emotion,speech}],priority:3};
  }
  function lockSceneImage(container, expectedSrc) {
    const sceneImage = container?.querySelector('.uno-cinematic-image');
    if (!sceneImage) return noop;
    let disposed = false;
    const report = ok => {
      if (disposed) return;
      sceneImage.dataset.previewReady = String(ok);
      parent.postMessage({type:'dragon-design-asset-status',ok},location.origin);
    };
    const ensureSource = () => {
      if (sceneImage.src !== expectedSrc) {
        sceneImage.dataset.previewReady = 'false';
        sceneImage.src = expectedSrc;
      }
      sceneImage.dataset.previewImage = state.version;
      sceneImage.dataset.previewSrc = expectedSrc;
      if (sceneImage.complete && sceneImage.src === expectedSrc) report(sceneImage.naturalWidth > 0);
    };
    const loaded = () => { if (sceneImage.src === expectedSrc) report(sceneImage.naturalWidth > 0); };
    const failed = () => report(false);
    sceneImage.addEventListener('load',loaded);
    sceneImage.addEventListener('error',failed);
    const observer = new MutationObserver(ensureSource);
    observer.observe(sceneImage,{attributes:true,attributeFilter:['src']});
    ensureSource();
    return () => {disposed = true; observer.disconnect(); sceneImage.removeEventListener('load',loaded); sceneImage.removeEventListener('error',failed);};
  }
  function PreviewUnoScene() {
    const container = React.useRef(null);
    const expectedSrc = images.uno[state.version] ?? images.uno.current;
    React.useLayoutEffect(() => lockSceneImage(container.current,expectedSrc),[expectedSrc,state.sequence]);
    return h('div',{ref:container},h(UnoCinematicOverlay,{event:{key:`design-scene-${state.sequence}`,kind:'draw-counter',playerId:silver,playerName:'白銀ドラゴン',cardName:'ドロー2',addedCount:2,totalCount:4,reversed:false},players:unoPlayers}));
  }
  function ProposedBabaScene() {
    const container = React.useRef(null);
    React.useLayoutEffect(() => lockSceneImage(container.current,images.babanuki.proposed),[state.sequence]);
    return h('div',{ref:container,className:'uno-cinematic-overlay is-babanuki-shuffle',style:{'--uno-cinematic-duration':'2500ms'}},h('div',{className:'uno-cinematic-side-lines','aria-hidden':true}),h('div',{className:'uno-cinematic-panel'},h('img',{className:'uno-cinematic-image',src:images.babanuki.proposed,alt:''}),h('div',{className:'uno-cinematic-shade','aria-hidden':true}),h('div',{className:'uno-cinematic-copy is-top'},h('span',null,'白銀ドラゴン')),h('div',{className:'uno-cinematic-copy is-bottom'},h('strong',null,'シャッフルタイム！'),h('span',null,'出目3 · 全手札を混ぜる'))));
  }
  function render() {
    document.body.className = `demo-embed demo-${state.version}${state.reduced?' demo-reduced':''}${!state.playing?' demo-static':''}`;
    const reacting = state.phase !== 'cutin';
    const active = reacting ? reaction():null;
    const table = state.game === 'uno'
      ? h(UnoTableView,{state:uno,currentPlayer:unoPlayers[1],nextPlayerId:'design-baby',topCard,currentHand:uno.hands[viewer],handPlayer:unoPlayers[0],playableIds:new Set(),canAct:false,isCpuThinking:false,message:'白銀ドラゴンがドロー2で返しました。',viewPlayerId:viewer,dragonReaction:active,dragonPreference:'lively',onPlay:noop,onDraw:noop,onAcceptDraw:noop})
      : h(BabanukiTable,{state:baba,viewerId:viewer,drawTargetId:null,canDraw:false,selectedIndex:null,onDrawCard:noop,onSelectOwnCard:noop,flights:[],hidden:[],pairFlashPlayerId:null,leavingPlayerId:null,shuffleState:'ready',canShuffle:false,onShuffle:noop,shuffleDice:state.phase !== 'wipe'?3:null,dragonReaction:active,dragonPreference:'lively'});
    const scene = state.phase === 'cutin' ? state.game === 'uno' ? h(PreviewUnoScene) : state.version === 'proposed' ? h(ProposedBabaScene):null : null;
    root.render(h(React.Fragment,null,h('main',{className:`demo-game${state.game === 'babanuki'?' babanuki-game-screen':''}`},h('h1',{className:'demo-game-title'},state.game === 'uno'?'ハード UNO':'最弱王ババ抜き'),h('div',{className:'demo-banner'},state.game === 'uno'?'白銀ドラゴン · ドロー2で返した！':'白銀ドラゴン · シャッフルタイム！'),table,state.game === 'babanuki' && !(state.version === 'proposed' && state.phase === 'cutin') ? h(DiceResultPanel,{dice:3,declarerName:'白銀ドラゴン',stage:state.phase !== 'wipe'?'moving':'dice'}):null),scene));
    document.body.dataset.previewPhase = state.phase;
    document.body.dataset.previewVersion = state.version;
    if (!scene) parent.postMessage({type:'dragon-design-asset-status',ok:true},location.origin);
  }
  addEventListener('message',event=>{
    if(event.origin !== location.origin || event.data?.type !== 'dragon-design-preview') return;
    const data = event.data;
    state.game = data.game === 'babanuki'?'babanuki':'uno'; state.version = ['old','current','proposed'].includes(data.version)?data.version:'proposed'; state.phase = ['wipe','cutin','after'].includes(data.phase)?data.phase:'cutin'; state.reduced = Boolean(data.reduced); state.playing = Boolean(data.playing); state.sequence += 1; render();
  });
  render();
}
