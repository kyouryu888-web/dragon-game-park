/**
 * シャッフルタイムのUI（宣言受付ウィンドウとサイコロ結果）。
 * ローカル対局・オンライン対局のどちらからも使う。
 */

import { describeDice } from './babanukiShuffleDescription';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/**
 * シャッフルタイムの宣言ボタン。
 * 制限時間はなく、ジョーカーを持っている人が「次の1枚が引かれるまで」いつでも押せる。
 */
export function ShuffleDeclareButton({ onDeclare }: { onDeclare: () => void }) {
  return (
    <div
      className="babanuki-window"
      style={{
        marginTop: 8, padding: '10px 12px', borderRadius: 10,
        background: 'rgba(46,28,62,.72)',
        border: '1px solid rgba(160,100,210,.45)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: '#d8c79a', marginBottom: 7 }}>
        あなたはジョーカーを持っている。次の1枚が引かれるまで宣言できる
      </div>
      <button
        type="button"
        className="btn"
        onClick={onDeclare}
        style={{
          padding: '10px 22px', borderRadius: 8,
          border: '1px solid rgba(200,140,240,.7)',
          background: 'linear-gradient(180deg,#5a3478,#3a2050)',
          color: '#f0dcff', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
        }}
      >
        🎲 シャッフルタイム！
      </button>
    </div>
  );
}

export function DiceResultPanel({
  dice,
  declarerName,
  stage = 'dice',
}: {
  dice: number;
  declarerName: string;
  stage?: 'dice' | 'moving';
}) {
  const { label, detail, route, symbol, note } = describeDice(dice);
  return (
    <div
      className={`babanuki-shuffle-showcase is-${stage} is-dice-${dice}`}
      role="status"
      aria-live="polite"
    >
      <div className="babanuki-shuffle-eyebrow">SHUFFLE TIME</div>
      <div className="babanuki-shuffle-declarer">{declarerName} がシャッフルタイムを宣言！</div>

      <div className="babanuki-shuffle-steps" aria-hidden="true">
        <span className={stage === 'dice' ? 'is-active' : 'is-done'}>1　サイコロ判定</span>
        <span>→</span>
        <span className={stage === 'moving' ? 'is-active' : ''}>2　手札を移動</span>
      </div>

      {stage === 'dice' ? (
        <div key={dice} className="babanuki-dice">{DICE_FACES[dice] ?? ''}</div>
      ) : (
        <div key={`route-${dice}`} className="babanuki-shuffle-route" aria-hidden="true">
          {dice === 4 ? (
            <span className="babanuki-shuffle-skull">💀</span>
          ) : (
            <>
              <span className="babanuki-route-card">🂠</span>
              <span className="babanuki-route-symbol">{symbol}</span>
              <span className="babanuki-route-card">🂠</span>
            </>
          )}
        </div>
      )}

      <div className="babanuki-shuffle-label">出目 {dice}　{label}</div>
      <div className="babanuki-shuffle-route-text">{route}</div>
      <div className="babanuki-shuffle-detail">{detail}</div>
      <div className="babanuki-shuffle-note">{note}</div>
    </div>
  );
}
