import {
  GameSetupShell,
  SetupModeCard,
  SetupStep,
  SetupSummary,
} from '../../components/GameSetupFlow';

export function ReversiVariantSelectScreen({
  onSelectNormal,
  onSelectBakuretsu,
  onBackToHome,
}: {
  onSelectNormal: () => void;
  onSelectBakuretsu: () => void;
  onBackToHome: () => void;
}) {
  return (
    <GameSetupShell
      theme="reversi"
      icon="◐"
      title="リバーシ"
      englishTitle="REVERSI"
      description="黒炎と白銀、二頭の竜が盤上で陣を奪い合う。遊ぶルールを選んで盤へ進んでください。"
      onBack={onBackToHome}
    >
      <SetupStep numeral="I" title="遊戯の型を選ぶ" description="通常の竜陣か、特殊コマが連鎖する爆裂の竜陣を選びます。">
        <div className="game-setup-mode-grid">
          <SetupModeCard
            selected={false}
            icon="◐"
            title="通常リバーシ"
            code="CLASSIC"
            description="これまでどおりのルールで遊ぶ"
            onClick={onSelectNormal}
          />
          <SetupModeCard
            selected={false}
            icon="爆"
            title="爆裂リバーシ"
            code="BAKURETSU"
            description="爆弾・感染・盾・中立が連鎖する"
            onClick={onSelectBakuretsu}
          />
        </div>
      </SetupStep>

      <SetupStep numeral="II" title="通常リバーシ">
        <SetupSummary>
          現在公開中の対戦ルール、CPU5段階、同じ盤での対戦、オンライン対戦をそのまま利用します。
        </SetupSummary>
      </SetupStep>

      <SetupStep numeral="III" title="爆裂リバーシ">
        <SetupSummary>
          特殊コマはすべて公開。裏返しを終えてから爆発し、連鎖の順番を盤上で段階再生します。
        </SetupSummary>
      </SetupStep>
    </GameSetupShell>
  );
}
