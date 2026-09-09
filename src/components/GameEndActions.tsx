import { Button } from './Button';

export function GameEndActions({
  onRematch,
  onChangeSettings,
  onBackToSetup,
  onBackToHome,
  canRematch = true,
  rematchLabel = '再戦する',
}: {
  onRematch?: () => void;
  onChangeSettings?: () => void;
  onBackToSetup: () => void;
  onBackToHome: () => void;
  canRematch?: boolean;
  rematchLabel?: string;
}) {
  const showChangeSettings = Boolean(onChangeSettings && onChangeSettings !== onBackToSetup);

  return (
    <div className="game-end-actions" aria-label="ゲーム終了後の操作">
      <Button fullWidth onClick={onRematch} disabled={!canRematch || !onRematch}>
        {rematchLabel}
      </Button>
      {showChangeSettings ? (
        <Button fullWidth variant="secondary" onClick={onChangeSettings}>
          設定を変更して再戦する
        </Button>
      ) : null}
      <Button fullWidth variant="secondary" onClick={onBackToSetup}>
        ゲーム設定に戻る
      </Button>
      <Button fullWidth variant="ghost" onClick={onBackToHome}>
        ゲーム選択に戻る
      </Button>
    </div>
  );
}
