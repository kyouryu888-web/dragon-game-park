import { Button } from '../../components/Button';

type Props = {
  roomCode: string;
  copied: boolean;
  onCopy: () => void;
  onCancel: () => void;
};

export function ReversiWaitingScreen({ roomCode, copied, onCopy, onCancel }: Props) {
  return (
    <main className="reversi-online-lobby">
      <header className="reversi-online-lobby-topbar">
        <button type="button" onClick={onCancel}>← ゲーム設定に戻る</button>
        <span>REVERSI ONLINE</span>
      </header>
      <section className="reversi-online-lobby-card" aria-label="オンライン対戦の待機室">
        <span className="reversi-online-lobby-kicker">ROOM CODE</span>
        <h1>{roomCode}</h1>
        <Button onClick={onCopy}>{copied ? 'コピーしました ✓' : 'コードをコピー'}</Button>
        <div className="reversi-online-waiting-orbit" aria-hidden="true">
          <span className="reversi-mini-disc is-black" />
          <i />
          <span className="reversi-mini-disc is-white" />
        </div>
        <h2>対戦相手を待っています</h2>
        <p>この6桁コードを相手へ伝えてください。参加すると自動で盤が開きます。</p>
        <Button variant="ghost" onClick={onCancel}>ルームを閉じる</Button>
      </section>
    </main>
  );
}
