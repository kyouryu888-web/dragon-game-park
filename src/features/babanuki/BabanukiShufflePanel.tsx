/**
 * シャッフルタイムのUI（宣言受付ウィンドウとサイコロ結果）。
 * ローカル対局・オンライン対局のどちらからも使う。
 */

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function describeDice(dice: number): { label: string; detail: string } {
  switch (dice) {
    case 1:
      return { label: '右回り', detail: '全員の手札がそのまま左隣へ渡る' };
    case 2:
      return { label: '左回り', detail: '全員の手札がそのまま右隣へ渡る' };
    case 3:
      return { label: 'シャッフル交換', detail: '全員の手札をランダムに配り直す。誰と入れ替わったかは分からない' };
    case 4:
      return { label: 'ドクロ', detail: '何も起きない。権利だけが消える' };
    case 5:
      return { label: '右2回り', detail: '全員の手札が2つ左隣へ渡る' };
    case 6:
      return { label: '左2回り', detail: '全員の手札が2つ右隣へ渡る' };
    default:
      return { label: '', detail: '' };
  }
}

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

export function DiceResultPanel({ dice, declarerName }: { dice: number; declarerName: string }) {
  const { label, detail } = describeDice(dice);
  return (
    <div
      style={{
        marginTop: 8, padding: '12px', borderRadius: 10,
        background: 'rgba(46,28,62,.85)',
        border: '1px solid rgba(160,100,210,.55)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 11, color: '#b8a6cf', marginBottom: 4 }}>{declarerName} がシャッフルタイムを宣言！</div>
      <div key={dice} className="babanuki-dice" style={{ fontSize: 46, lineHeight: 1, color: '#f0dcff' }}>
        {DICE_FACES[dice] ?? ''}
      </div>
      <div style={{ fontSize: 15, fontWeight: 'bold', color: '#e6c877', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#c9b48f', marginTop: 2 }}>{detail}</div>
    </div>
  );
}
