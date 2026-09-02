import { Button } from '../../components/Button';

export function BakuretsuReversiWaitingScreen({
  roomCode,
  copied,
  onCopy,
  onCancel,
}: {
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  onCancel: () => void;
}) {
  return (
    <main className="reversi-online-lobby bakuretsu-online-lobby">
      <header className="reversi-online-lobby-topbar">
        <button type="button" onClick={onCancel}>← 爆裂設定に戻る</button>
        <span>BAKURETSU REVERSI ONLINE</span>
      </header>
      <section className="reversi-online-lobby-card" aria-label="爆裂リバーシオンライン対戦の待機室">
        <span className="reversi-online-lobby-kicker">ROOM CODE</span>
        <h1>{roomCode}</h1>
        <Button onClick={onCopy}>{copied ? 'コピーしました ✓' : 'コードをコピー'}</Button>
        <div className="reversi-online-waiting-orbit" aria-hidden="true">
          <span className="reversi-mini-disc is-black" />
          <i />
          <span className="reversi-mini-disc is-white" />
        </div>
        <h2>爆裂対戦の相手を待っています</h2>
        <p>この6桁コードを相手へ伝えてください。参加すると同じ特殊コマと連鎖イベントで盤が開きます。</p>
        <Button variant="ghost" onClick={onCancel}>ルームを閉じる</Button>
      </section>
    </main>
  );
}
