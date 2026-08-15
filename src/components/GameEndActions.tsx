import { Button } from './Button';

export function GameEndActions({
  onRematch,
  onChangeSettings,
  onBackToSetup,
  onBackToHome,
  canRematch = true,
}: {
  onRematch?: () => void;
  onChangeSettings: () => void;
  onBackToSetup: () => void;
  onBackToHome: () => void;
  canRematch?: boolean;
}) {
  return (
    <div className="game-end-actions" aria-label="ゲーム終了後の操作">
      <Button fullWidth onClick={onRematch} disabled={!canRematch || !onRematch}>
        再戦する
      </Button>
      <Button fullWidth variant="secondary" onClick={onChangeSettings}>
        設定を変更して再戦する
      </Button>
      <Button fullWidth variant="secondary" onClick={onBackToSetup}>
        ゲーム設定に戻る
      </Button>
      <Button fullWidth variant="ghost" onClick={onBackToHome}>
        ゲーム選択に戻る
      </Button>
    </div>
  );
}
