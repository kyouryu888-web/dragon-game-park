import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCheckerIds } from './useCheckerIds';
import { useEffect, useRef } from 'react';
import type { GameState, PlayerId } from './backgammonTypes';
import { BG, Brand, ChevronLeft, DragonIcon } from './BackgammonUi';
import { GameEndActions } from '../../components/GameEndActions';

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// 盤の並び（デザインと同一）: white のホームは右下、black のホームは右上
const TOP_L = [12, 13, 14, 15, 16, 17];
const TOP_R = [18, 19, 20, 21, 22, 23];
const BOT_L = [11, 10, 9, 8, 7, 6];
const BOT_R = [5, 4, 3, 2, 1, 0];

// 駒の配色: white=金 / black=緋
const CHECKER_BG: Record<PlayerId, string> = {
  white: 'radial-gradient(circle at 35% 30%, #f6e8bd, #c9a24b 62%, #7d6233)',
  black: 'radial-gradient(circle at 35% 30%, #e88d68, #a8441f 62%, #5c2410)',
};
const CHECKER_BD: Record<PlayerId, string> = { white: '#e6c877', black: '#e0733a' };
const CHECKER_TC: Record<PlayerId, string> = { white: '#3a2c17', black: '#f6e0d0' };

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

type PlayerPlaqueInfo = {
  name: string;
  sub: string;
  avatar: 'dragon' | 'initial';
  initial: string;
  active: boolean;
};

export type BackgammonPlayScreenProps = {
  state: GameState;
  selectedFrom: 'bar' | number | null;
  destinations: Set<number>;
  /** サイコロ2個分を一度に動かす到達点（緋色マーカーで表示） */
  chainDestinations: Set<number>;
  /** ベアオフ自動化ボタン（条件を満たすときだけ渡す） */
  autoButton: { label: string; onClick: () => void; active: boolean } | null;
  /** 「上がり」ボタンを光らせる側（オフ移動が可能なとき） */
  offDestFor: PlayerId | null;
  /** 選択前にタップ候補の駒を脈動させる移動元（'bar' or index文字列） */
  pickableFroms: Set<string>;
  centerMsg: string;
  movesLeftTxt: string;
  showRollBtn: boolean;
  rollLabel: string;
  topPlayer: PlayerPlaqueInfo;
  botPlayer: PlayerPlaqueInfo;
  onRoll: () => void;
  onTapPoint: (i: number) => void;
  onTapBar: () => void;
  onTapOffTop: () => void;
  onTapOffBot: () => void;
  onQuit: () => void;
  over: { en: string; title: string; sub: string; showRematch: boolean; rematchLabel?: string; } | null;
  onRematch: () => void;
  onBackToSettings: () => void;
  onBackToHome: () => void;
  pips: Record<PlayerId, number>;
  canDouble: boolean;
  onDouble: () => void;
  isDoubleWait: boolean;
  isDoubleOffer: boolean;
  onAcceptDouble: () => void;
  onDeclineDouble: () => void;
};

function Checker({
  owner, size, label, ring, pulse, hitFlash, layoutId
}: { owner: PlayerId; size: number | string; label?: string; ring?: boolean; pulse?: boolean; hitFlash?: boolean; layoutId?: string }) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: CHECKER_BG[owner], border: `1.5px solid ${CHECKER_BD[owner]}`,
        boxShadow: ring
          ? '0 0 0 2.5px #f0dfae, 0 2px 5px rgba(0,0,0,.55)'
          : '0 2px 4px rgba(0,0,0,.5)',
        animation: hitFlash ? 'bg-checker-hit 0.6s ease-out' : pulse ? 'pickPulse 1.6s ease-in-out infinite' : 'none',
        boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'clamp(10px, 1.2vw, 13px)', fontWeight: 700, color: CHECKER_TC[owner], flex: 'none',
        position: hitFlash ? 'relative' : 'static',
        zIndex: hitFlash ? 10 : 1,
      }}
    >
      {label ?? ''}
    </motion.div>
  );
}

export function BackgammonPlayScreen(props: BackgammonPlayScreenProps) {
  const { state } = props;
  const prevState = usePrevious(state);
  const checkerIds = useCheckerIds(state);

  const [cutin, setCutin] = useState<'offer' | 'accept' | 'drop' | null>(null);

  useEffect(() => {
    if (!prevState) return;
    if (prevState.phase !== 'double-offered' && state.phase === 'double-offered') {
      setCutin('offer');
      const timer = setTimeout(() => setCutin(null), 2500);
      return () => clearTimeout(timer);
    }
    if (prevState.phase === 'double-offered' && state.phase !== 'double-offered') {
      if (state.phase === 'rolling') {
        setCutin('accept');
      } else if (state.phase === 'finished') {
        setCutin('drop');
      } else {
        setCutin(null);
        return;
      }
      const timer = setTimeout(() => setCutin(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.phase, prevState?.phase]);

  // 相手の駒をヒットした（バーに送られた）かどうかを検知
  const hitFlashBlack = prevState && state.bar.black > prevState.bar.black;
  const hitFlashWhite = prevState && state.bar.white > prevState.bar.white;

  const renderPoint = (i: number, row: 'top' | 'bottom') => {
    const pt = state.points[i];
    const count = pt?.count ?? 0;
    const show = Math.min(count, 5);
    const isDest = props.destinations.has(i);
    const isChainDest = !isDest && props.chainDestinations.has(i);
    const isSel = props.selectedFrom === i;
    const pickable = props.pickableFroms.has(String(i));
    const tri = i % 2 ? '#5a4128' : '#392a1c';
    const clip = row === 'top' ? 'polygon(0 0,100% 0,50% 92%)' : 'polygon(0 100%,100% 100%,50% 8%)';
    const triPos = row === 'top' ? { top: 0, bottom: 4 } : { top: 4, bottom: 0 };

    // 直前に置かれた駒かどうか（簡易的に、数が前のターンより増えていたら一番上を光らせる）
    const prevPtCount = prevState?.points[i]?.count ?? 0;
    const isRecentPlaced = prevState && prevState.currentPlayer !== state.currentPlayer && count > prevPtCount;

    const idsAtPoint = checkerIds.get(i) || [];

    const checkers = [];
    for (let k = 0; k < show; k++) {
      const last = k === show - 1;
      checkers.push(
        <Checker
          key={k}
          owner={pt!.owner}
          size="var(--backgammon-checker-size)"
          label={last && count > 5 ? String(count) : ''}
          ring={last && isSel}
          pulse={last && pickable}
          hitFlash={last && isRecentPlaced && !hitFlashBlack && !hitFlashWhite}
          layoutId={idsAtPoint[k]?.id}
        />,
      );
    }

    return (
      <div key={i} onClick={() => props.onTapPoint(i)} style={{ flex: 1, position: 'relative', cursor: 'pointer', minWidth: 0 }}>
        <div style={{ position: 'absolute', left: 2, right: 2, ...triPos, clipPath: clip, background: tri }} />
        {isDest && (
          <>
            <div style={{
              position: 'absolute', left: 2, right: 2, ...triPos, clipPath: clip,
              background: 'rgba(230,200,119,.3)', boxShadow: 'inset 0 0 14px rgba(230,200,119,.9)',
            }} />
            <div style={{
              position: 'absolute', left: '50%', [row === 'top' ? 'bottom' : 'top']: 10,
              width: 13, height: 13, marginLeft: -6.5, border: `2px solid ${BG.goldBright}`,
              borderRadius: '50%', background: 'rgba(230,200,119,.3)', animation: 'dotPulse 1.1s infinite',
            }} />
          </>
        )}
        {isChainDest && (
          <>
            <div style={{
              position: 'absolute', left: 2, right: 2, ...triPos, clipPath: clip,
              background: 'rgba(224,115,58,.22)', boxShadow: 'inset 0 0 14px rgba(224,115,58,.7)',
            }} />
            <div style={{
              position: 'absolute', left: '50%', [row === 'top' ? 'bottom' : 'top']: 10,
              width: 13, height: 13, marginLeft: -6.5, border: `2px solid ${BG.ember}`,
              borderRadius: '50%', background: 'rgba(224,115,58,.25)', animation: 'dotPulse 1.1s infinite',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: '#f6e0d0',
            }}>
              2
            </div>
          </>
        )}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          ...(row === 'top' ? { top: 2 } : { bottom: 2 }),
          display: 'flex',
          flexDirection: row === 'top' ? 'column' : 'column-reverse',
          alignItems: 'center', gap: 1,
        }}>
          {checkers}
        </div>
      </div>
    );
  };

  const renderBar = (side: PlayerId, row: 'top' | 'bottom') => {
    const n = state.bar[side];
    const show = Math.min(n, 4);
    const barHL = props.selectedFrom === 'bar' && state.currentPlayer === side;
    
    const isHit = side === 'black' ? hitFlashBlack : hitFlashWhite;

    const idsAtBar = checkerIds.get('bar')?.filter(c => c.owner === side) || [];

    const checkers = [];
    for (let k = 0; k < show; k++) {
      const last = k === show - 1;
      checkers.push(
        <Checker key={k} owner={side} size="var(--backgammon-bar-checker-size)" label={last && n > 4 ? String(n) : ''} hitFlash={last && isHit} layoutId={idsAtBar[k]?.id} />,
      );
    }
    return (
      <div
        onClick={props.onTapBar}
        style={{
          width: 'var(--backgammon-bar-width)', flex: 'none', position: 'relative', margin: '0 1px', borderRadius: 3,
          background: row === 'top'
            ? 'linear-gradient(180deg,#3f2d18,#241a0e)'
            : 'linear-gradient(180deg,#241a0e,#3f2d18)',
          boxShadow: 'inset 0 0 8px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: row === 'top' ? 'column' : 'column-reverse',
          alignItems: 'center', gap: 2,
          ...(row === 'top' ? { paddingTop: 4 } : { paddingBottom: 4 }),
          cursor: 'pointer',
        }}
      >
        {barHL && (
          <div style={{
            position: 'absolute', inset: 0, border: `2px solid ${BG.goldBright}`, borderRadius: 3,
            boxShadow: '0 0 12px rgba(230,200,119,.5)', pointerEvents: 'none', animation: 'dotPulse 1.1s infinite',
          }} />
        )}
        {checkers}
      </div>
    );
  };

  const DiceBlock = ({ val, used, owner, anim, layoutId }: { val: number; used?: boolean; owner: PlayerId; anim?: string; layoutId?: string }) => (
    <motion.div
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        width: 'clamp(32px, 9vw, 46px)', height: 'clamp(32px, 9vw, 46px)', borderRadius: 9, background: '#efe4c9',
        border: `2px solid ${owner === 'white' ? BG.gold : BG.ember}`,
        boxSizing: 'border-box', position: 'relative', flex: 'none',
        boxShadow: '0 3px 8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.4)',
        opacity: used ? 0.3 : 1, animation: anim || 'none',
      }}
    >
      {PIPS[val].map(([x, y], p) => (
        <span key={p} style={{
          position: 'absolute', left: `${x}%`, top: `${y}%`, width: '20%', height: '20%',
          marginLeft: '-10%', marginTop: '-10%', borderRadius: '50%', background: '#241a10',
        }} />
      ))}
    </motion.div>
  );

  // サイコロ表示（振った目、使用済みは減光）
  const diceView = (() => {
    if (!state.rolled) return null;
    const rem = [...state.dice];
    const dice = (state.rolled[0] === state.rolled[1]
      ? [state.rolled[0], state.rolled[0], state.rolled[0], state.rolled[0]]
      : [state.rolled[0], state.rolled[1]]
    ).map((val, idx) => {
      const i = rem.indexOf(val);
      const used = i < 0;
      if (i >= 0) rem.splice(i, 1);
      return <DiceBlock key={idx} val={val} used={used} owner={state.currentPlayer} layoutId={idx < 2 ? `dice-${idx}` : undefined} anim="bg-dice-roll 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards" />;
    });
    return dice;
  })();

  const plaque = (info: PlayerPlaqueInfo, side: PlayerId, onTapOff: () => void, offHot: boolean) => {
    const accent = side === 'white' ? BG.gold : BG.ember;
    const offColor = side === 'white' ? BG.goldBright : BG.ember;
    return (
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
        margin: side === 'black' ? '8px 2px 6px' : '6px 2px 0',
        border: '1px solid rgba(201,162,75,.25)', borderRadius: 6, background: BG.panelBg,
      }}>
        {info.active && (
          <div style={{
            position: 'absolute', inset: -1, border: `1.5px solid ${accent}`, borderRadius: 6,
            boxShadow: `0 0 14px ${side === 'white' ? 'rgba(201,162,75,.3)' : 'rgba(224,115,58,.3)'}`,
            pointerEvents: 'none',
          }} />
        )}
        <div style={{
          flex: 'none', width: 38, height: 38, borderRadius: '50%',
          border: `1px solid ${side === 'white' ? 'rgba(201,162,75,.5)' : 'rgba(224,115,58,.5)'}`,
          background: 'radial-gradient(circle at 50% 38%, #2a1e2b, #191320 75%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {info.avatar === 'dragon'
            ? <DragonIcon size={26} variant="crimson" />
            : <span style={{ fontFamily: BG.serifEn, fontSize: 16, color: side === 'white' ? BG.goldBright : BG.ember }}>{info.initial}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, letterSpacing: '.06em', color: BG.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', justifyContent: 'space-between'
          }}>
            <span>{info.name}</span>
            <span style={{ fontSize: 13, color: '#f5deb3' }}>Pip: {props.pips[side]}</span>
          </div>
          <div style={{ fontSize: 11, color: BG.muted, marginTop: 1, display: 'flex', justifyContent: 'space-between' }}>
            <span>{info.sub}</span>
            {state.matchLength > 1 && (
              <span style={{ color: '#d3c0a5' }}>★ {state.score[side]} / {state.matchLength}</span>
            )}
          </div>
        </div>
        <button
          onClick={onTapOff}
          style={{
            flex: 'none', minHeight: 44, padding: '4px 12px', borderRadius: 5, cursor: 'pointer',
            textAlign: 'center', fontFamily: BG.serifJa, background: 'rgba(13,11,16,.6)',
            border: `1.5px solid ${offHot ? CHECKER_BD[side] : 'rgba(201,162,75,.2)'}`,
            color: '#d8cbb0',
            animation: offHot ? 'dotPulse 1.1s infinite' : 'none',
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: BG.dim }}>上がり</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: offColor }}>
            {state.borneOff[side]}
            <span style={{ fontSize: 10, color: BG.dim }}> /15</span>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="backgammon-play-screen" style={{
      position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
      minHeight: '100vh', padding: '0 8px 14px',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 4px 6px', borderBottom: '1px solid rgba(201,162,75,.22)',
        position: 'relative',
      }}>
        <button
          onClick={props.onQuit}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 10px 0 6px',
            color: BG.gold, border: '1px solid rgba(201,162,75,.35)', borderRadius: 4,
            background: 'rgba(201,162,75,.06)', fontSize: 12.5, letterSpacing: '.05em',
            cursor: 'pointer', fontFamily: BG.serifJa, zIndex: 10, flexShrink: 0,
          }}
        >
          <ChevronLeft />
          <span>盤を離れる</span>
        </button>
        <div style={{ 
            fontFamily: BG.serifEn, fontSize: 'clamp(11px, 3vw, 13px)', letterSpacing: '.2em', color: BG.goldBright,
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 5, pointerEvents: 'none'
          }}>BACKGAMMON</div>
        <button
          onClick={props.onBackToHome}
          style={{
            display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 10px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: BG.dim, fontFamily: BG.serifEn, fontSize: 11, letterSpacing: '.14em', zIndex: 10, flexShrink: 0,
          }}
        >
          ゲーム選択に戻る
        </button>
      </div>

      {/* 相手プレート（緋 / black） */}
      {plaque(props.topPlayer, 'black', props.onTapOffTop, props.offDestFor === 'black')}

      {/* board */}
      <div style={{
        borderRadius: 10, padding: 6, background: 'linear-gradient(180deg,#4a3320,#2c1e10)',
        border: '1.5px solid rgba(201,162,75,.55)',
        boxShadow: '0 8px 30px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,235,180,.15)',
      }}>
        <div style={{
          position: 'relative', borderRadius: 5,
          background: 'radial-gradient(ellipse 120% 100% at 50% 50%, #2a1d2c 0%, #211624 70%, #1a1120 100%)',
          boxShadow: 'inset 0 0 24px rgba(0,0,0,.7)', padding: '4px 3px',
        }}>
          {/* top row */}
          <div style={{ display: 'flex', height: 'var(--backgammon-point-row-height)' }}>
            {TOP_L.map((i) => renderPoint(i, 'top'))}
            {renderBar('black', 'top')}
            {TOP_R.map((i) => renderPoint(i, 'top'))}
          </div>

          {/* middle strip */}
          <div style={{ height: 'var(--backgammon-middle-height)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '0 clamp(110px, 20vw, 150px)' }}>
            <div style={{
              position: 'absolute', left: 6, right: 6, top: '50%', height: 1,
              background: 'linear-gradient(90deg,transparent,rgba(201,162,75,.25),transparent)',
            }} />
            
            {/* キューブ表示（左側）*/}
            <div style={{ position: 'absolute', left: 'clamp(4px, 2vw, 20px)', zIndex: 10, display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 4, background: '#222', border: `1px solid ${BG.goldDim}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold',
                boxShadow: state.cube.owner === 'white' ? '0 2px 0 #a8441f' : state.cube.owner === 'black' ? '0 -2px 0 #a8441f' : 'none',
              }}>
                {state.cube.value}
              </div>
              {props.canDouble && (
                <button
                  onClick={props.onDouble}
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(201,162,75,.2)', border: `1px solid ${BG.goldDim}`, color: BG.goldPale, cursor: 'pointer'
                  }}
                >
                  ダブル提案
                </button>
              )}
              {props.isDoubleWait && (
                <span style={{ fontSize: 11, color: BG.goldDim }}>返答待ち...</span>
              )}
            </div>

            {state.phase === 'opening-roll' && state.openingRoll ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transform: 'translateY(-30px)' }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>相手</span>
                  <DiceBlock val={state.openingRoll[1]} owner="black" anim="bg-dice-roll 0.6s ease-out forwards" layoutId="dice-1" />
                </div>
                {state.openingRoll[0] === state.openingRoll[1] ? (
                  <span style={{ color: '#e6c877', fontSize: 'clamp(12px, 3vw, 15px)', fontWeight: 'bold', animation: 'dotPulse 1s infinite', textAlign: 'center' }}>同じ目！<br/>振り直し</span>
                ) : (
                  <span style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>VS</span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transform: 'translateY(30px)' }}>
                  <DiceBlock val={state.openingRoll[0]} owner="white" anim="bg-dice-roll 0.6s ease-out forwards" layoutId="dice-0" />
                  <span style={{ fontSize: 11, color: '#aaa' }}>あなた</span>
                </div>
              </div>
            ) : props.showRollBtn ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'clamp(6px, 2vw, 12px)' }}>
                <span style={{ fontSize: 'clamp(10px, 3vw, 12.5px)', letterSpacing: '.05em', color: BG.textMid, textAlign: 'center' }}>{props.centerMsg}</span>
                <button
                  onClick={props.onRoll}
                  style={{
                    minHeight: 48, padding: '0 clamp(12px, 3vw, 22px)', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${BG.gold}`,
                    background: 'linear-gradient(180deg,#3a2c17 0%,#2a1f12 100%)',
                    color: BG.goldPale, fontFamily: BG.serifJa, fontSize: 'clamp(12px, 3vw, 15px)', fontWeight: 700,
                    letterSpacing: '.14em', boxShadow: '0 0 18px rgba(224,115,58,.3)', flex: 'none',
                  }}
                >
                  {props.rollLabel}
                </button>
              </div>
            ) : state.rolled && state.phase === 'moving' ? (
              <div key={`${state.turnCount}-${state.rolled.join('')}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {diceView}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 110 }}>
                  <span style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', letterSpacing: '.06em', color: BG.goldBright, lineHeight: 1.4 }}>{props.centerMsg}</span>
                  <span style={{ fontSize: 11, color: BG.dim }}>{props.movesLeftTxt}</span>
                </div>
              </div>
            ) : (
              <span style={{ position: 'relative', fontSize: 'clamp(10px, 3vw, 12.5px)', letterSpacing: '.08em', color: BG.textMid, textAlign: 'center' }}>{props.centerMsg}</span>
            )}
          </div>

          {/* bottom row */}
          <div style={{ display: 'flex', height: 'var(--backgammon-point-row-height)' }}>
            {BOT_L.map((i) => renderPoint(i, 'bottom'))}
            {renderBar('white', 'bottom')}
            {BOT_R.map((i) => renderPoint(i, 'bottom'))}
          </div>
        </div>
      </div>

      {/* ベアオフ自動化 */}
      {props.autoButton && (
        <button
          onClick={props.autoButton.onClick}
          style={{
            margin: '6px 2px 0', minHeight: 44, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${props.autoButton.active ? BG.ember : 'rgba(201,162,75,.4)'}`,
            background: props.autoButton.active ? 'rgba(224,115,58,.14)' : 'rgba(201,162,75,.07)',
            color: props.autoButton.active ? '#f0c8a8' : '#d8c79a',
            fontFamily: BG.serifJa, fontSize: 13.5, fontWeight: 700, letterSpacing: '.1em',
            animation: props.autoButton.active ? 'dotPulse 1.4s infinite' : 'none',
          }}
        >
          {props.autoButton.label}
        </button>
      )}

      {/* 自分プレート（金 / white） */}
      {plaque(props.botPlayer, 'white', props.onTapOffBot, props.offDestFor === 'white')}

      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        <Brand />
      </div>

      {/* win overlay */}
      {props.over && !cutin && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,7,12,.9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', padding: '24px 16px', overflowY: 'auto',
        }}>
          <div style={{
            margin: 'auto 0', width: '100%', maxWidth: 360,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%', border: '1.5px solid rgba(201,162,75,.5)',
              background: 'radial-gradient(circle at 50% 38%, #2a1e2b, #191320 75%)',
              boxShadow: '0 0 30px rgba(224,115,58,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'dragonBob 3.4s ease-in-out infinite',
            }}>
              <DragonIcon size={64} />
            </div>
            <div style={{ fontFamily: BG.serifEn, fontSize: 13, letterSpacing: '.3em', color: BG.goldDim, marginTop: 8 }}>
              {props.over.en}
            </div>
            <div style={{
              fontSize: 26, fontWeight: 700, letterSpacing: '.14em', color: BG.goldBright,
              textShadow: '0 0 20px rgba(224,115,58,.4)',
            }}>
              {props.over.title}
            </div>
            <div style={{ fontSize: 13.5, color: BG.textMid, lineHeight: 1.8 }}>{props.over.sub}</div>

            <GameEndActions
              onRematch={props.over.showRematch ? props.onRematch : undefined}
              onBackToSetup={props.onBackToSettings}
              onBackToHome={props.onBackToHome}
              rematchLabel={props.over.rematchLabel}
            />
          </div>
        </div>
      )}

      {/* ダブル受諾モーダル */}
      {props.isDoubleOffer && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 25, background: 'rgba(10,7,12,.8)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#201826', padding: '24px 32px', borderRadius: 12,
            border: `2px solid ${BG.gold}`, textAlign: 'center', maxWidth: 360, width: '90%',
          }}>
            <h3 style={{ margin: '0 0 16px', color: BG.goldBright, fontSize: 20 }}>ダブル提案！</h3>
            <p style={{ margin: '0 0 24px', color: BG.textMid, fontSize: 14, lineHeight: 1.6 }}>
              相手から勝負を倍（{state.cube.value * 2}点）にする提案がありました。
              <br />
              受けるか、降りるか選んでください。
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={props.onDeclineDouble}
                style={{ padding: '10px 20px', borderRadius: 6, background: '#3a2c17', border: '1px solid #7d6233', color: '#f5deb3', cursor: 'pointer', flex: '1 1 auto', minWidth: 120 }}
              >
                降りる (Drop)
              </button>
              <button
                onClick={props.onAcceptDouble}
                style={{ padding: '10px 20px', borderRadius: 6, background: '#a8441f', border: '1px solid #e0733a', color: '#fff', fontWeight: 'bold', cursor: 'pointer', flex: '1 1 auto', minWidth: 120 }}
              >
                受ける (Take)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cinematic Cutins */}
      <AnimatePresence>
        {cutin && (
          <motion.div
            key="cutin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none',
              background: 'radial-gradient(circle at center, rgba(10,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}
          >
            <motion.div
              initial={{ scale: 0.8, x: -100, rotate: -5, opacity: 0 }}
              animate={{ scale: 1, x: 0, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.1, x: 100, rotate: 5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 150 }}
              style={{
                background: 'linear-gradient(135deg, rgba(200,150,50,0.9), rgba(100,20,10,0.9))',
                border: '2px solid #f0dfae',
                borderRadius: 16,
                padding: '24px 48px',
                boxShadow: '0 0 40px rgba(224,115,58,0.6)',
                textAlign: 'center',
                transformStyle: 'preserve-3d',
              }}
            >
              <h2 style={{ 
                fontSize: 'clamp(24px, 6vw, 36px)', 
                margin: 0, 
                color: '#fff', 
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                letterSpacing: '0.1em'
              }}>
                {cutin === 'offer' ? 'DOUBLE OFFERED!' : cutin === 'accept' ? 'DOUBLE ACCEPTED!!' : 'DOUBLE DROPPED...'}
              </h2>
              <p style={{ 
                fontSize: 'clamp(12px, 3vw, 16px)', 
                color: '#f0dfae', 
                marginTop: 8,
                marginBottom: 0,
                fontWeight: 'bold' 
              }}>
                {cutin === 'offer' ? '倍付の勝負が提案された！' : cutin === 'accept' ? '勝負は倍付へ！' : '勝負から降りた…'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}