import type { GameState, PlayerId } from './backgammonTypes';
import { BG, Brand, ChevronLeft, DragonIcon, GoldButton } from './BackgammonUi';

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
  over: { en: string; title: string; sub: string; showRematch: boolean } | null;
  onRematch: () => void;
  onBackToSettings: () => void;
  onBackToHome: () => void;
};

function Checker({
  owner, size, label, ring, pulse,
}: { owner: PlayerId; size: number; label?: string; ring?: boolean; pulse?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: CHECKER_BG[owner], border: `1.5px solid ${CHECKER_BD[owner]}`,
      boxShadow: ring
        ? '0 0 0 2.5px #f0dfae, 0 2px 5px rgba(0,0,0,.55)'
        : '0 2px 4px rgba(0,0,0,.5)',
      animation: pulse ? 'pickPulse 1.6s ease-in-out infinite' : 'none',
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size < 24 ? 10 : 11, fontWeight: 700, color: CHECKER_TC[owner], flex: 'none',
    }}>
      {label ?? ''}
    </div>
  );
}

export function BackgammonPlayScreen(props: BackgammonPlayScreenProps) {
  const { state } = props;

  const renderPoint = (i: number, row: 'top' | 'bottom') => {
    const pt = state.points[i];
    const count = pt?.count ?? 0;
    const show = Math.min(count, 5);
    const isDest = props.destinations.has(i);
    const isSel = props.selectedFrom === i;
    const pickable = props.pickableFroms.has(String(i));
    const tri = i % 2 ? '#5a4128' : '#392a1c';
    const clip = row === 'top' ? 'polygon(0 0,100% 0,50% 92%)' : 'polygon(0 100%,100% 100%,50% 8%)';
    const triPos = row === 'top' ? { top: 0, bottom: 4 } : { top: 4, bottom: 0 };

    const checkers = [];
    for (let k = 0; k < show; k++) {
      const last = k === show - 1;
      checkers.push(
        <Checker
          key={k}
          owner={pt!.owner}
          size={24}
          label={last && count > 5 ? String(count) : ''}
          ring={last && isSel}
          pulse={last && pickable}
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
    const checkers = [];
    for (let k = 0; k < show; k++) {
      checkers.push(
        <Checker key={k} owner={side} size={22} label={k === show - 1 && n > 4 ? String(n) : ''} />,
      );
    }
    return (
      <div
        onClick={props.onTapBar}
        style={{
          width: 26, flex: 'none', position: 'relative', margin: '0 1px', borderRadius: 3,
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
      return (
        <div
          key={idx}
          style={{
            width: 46, height: 46, borderRadius: 9, background: '#efe4c9',
            border: `2px solid ${state.currentPlayer === 'white' ? BG.gold : BG.ember}`,
            boxSizing: 'border-box', position: 'relative',
            boxShadow: '0 3px 8px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.4)',
            opacity: used ? 0.3 : 1, animation: 'diceIn .5s ease-out',
          }}
        >
          {PIPS[val].map(([x, y], p) => (
            <span key={p} style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`, width: '20%', height: '20%',
              marginLeft: '-10%', marginTop: '-10%', borderRadius: '50%', background: '#241a10',
            }} />
          ))}
        </div>
      );
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
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {info.name}
          </div>
          <div style={{ fontSize: 11, color: BG.muted, marginTop: 1 }}>{info.sub}</div>
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
    <div style={{
      position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column',
      minHeight: '100vh', padding: '0 8px 14px',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 4px 6px', borderBottom: '1px solid rgba(201,162,75,.22)',
      }}>
        <button
          onClick={props.onQuit}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 10px 0 6px',
            color: BG.gold, border: '1px solid rgba(201,162,75,.35)', borderRadius: 4,
            background: 'rgba(201,162,75,.06)', fontSize: 12.5, letterSpacing: '.05em',
            cursor: 'pointer', fontFamily: BG.serifJa,
          }}
        >
          <ChevronLeft />
          <span>盤を離れる</span>
        </button>
        <div style={{ fontFamily: BG.serifEn, fontSize: 13, letterSpacing: '.2em', color: BG.goldBright }}>BACKGAMMON</div>
        <button
          onClick={props.onBackToHome}
          style={{
            display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 10px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: BG.dim, fontFamily: BG.serifEn, fontSize: 11, letterSpacing: '.14em',
          }}
        >
          TOP
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
          <div style={{ display: 'flex', height: 126 }}>
            {TOP_L.map((i) => renderPoint(i, 'top'))}
            {renderBar('black', 'top')}
            {TOP_R.map((i) => renderPoint(i, 'top'))}
          </div>

          {/* middle strip */}
          <div style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 6, right: 6, top: '50%', height: 1,
              background: 'linear-gradient(90deg,transparent,rgba(201,162,75,.25),transparent)',
            }} />
            {props.showRollBtn ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12.5, letterSpacing: '.08em', color: BG.textMid }}>{props.centerMsg}</span>
                <button
                  onClick={props.onRoll}
                  style={{
                    minHeight: 48, padding: '0 22px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${BG.gold}`,
                    background: 'linear-gradient(180deg,#3a2c17 0%,#2a1f12 100%)',
                    color: BG.goldPale, fontFamily: BG.serifJa, fontSize: 15, fontWeight: 700,
                    letterSpacing: '.14em', boxShadow: '0 0 18px rgba(224,115,58,.3)',
                  }}
                >
                  {props.rollLabel}
                </button>
              </div>
            ) : state.rolled && state.phase === 'moving' ? (
              <div key={`${state.turnCount}-${state.rolled.join('')}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                {diceView}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 110 }}>
                  <span style={{ fontSize: 12, letterSpacing: '.06em', color: BG.goldBright, lineHeight: 1.4 }}>{props.centerMsg}</span>
                  <span style={{ fontSize: 11, color: BG.dim }}>{props.movesLeftTxt}</span>
                </div>
              </div>
            ) : (
              <span style={{ position: 'relative', fontSize: 12.5, letterSpacing: '.08em', color: BG.textMid }}>{props.centerMsg}</span>
            )}
          </div>

          {/* bottom row */}
          <div style={{ display: 'flex', height: 126 }}>
            {BOT_L.map((i) => renderPoint(i, 'bottom'))}
            {renderBar('white', 'bottom')}
            {BOT_R.map((i) => renderPoint(i, 'bottom'))}
          </div>
        </div>
      </div>

      {/* 自分プレート（金 / white） */}
      {plaque(props.botPlayer, 'white', props.onTapOffBot, props.offDestFor === 'white')}

      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        <Brand />
      </div>

      {/* win overlay */}
      {props.over && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(10,7,12,.9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, textAlign: 'center', padding: 24,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, marginTop: 16 }}>
            {props.over.showRematch && (
              <GoldButton onClick={props.onRematch} minHeight={52} fontSize={15} letterSpacing=".16em">
                もう一度戦う
              </GoldButton>
            )}
            <button
              onClick={props.onBackToSettings}
              style={{
                minHeight: 48, borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(201,162,75,.4)', background: 'rgba(201,162,75,.07)',
                color: '#d8c79a', fontFamily: BG.serifJa, fontSize: 14, letterSpacing: '.12em',
              }}
            >
              設定に戻る
            </button>
            <button
              onClick={props.onBackToHome}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
                background: 'none', border: 'none', cursor: 'pointer',
                color: BG.dim, fontSize: 12.5, letterSpacing: '.1em', fontFamily: BG.serifJa,
              }}
            >
              dragon-game-park のTOPへ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
