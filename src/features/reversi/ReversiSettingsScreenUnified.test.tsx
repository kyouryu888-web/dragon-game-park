import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BAKURETSU_REVERSI_CONFIG } from './bakuretsuUi';
import { ReversiUnifiedSettingsScreen } from './ReversiUnifiedSettingsScreen';
import type { ReversiConfig } from './reversiTypes';

const DUMMY_NORMAL_CONFIG: ReversiConfig = {
  mode: 'online',
  name: 'テスト挑戦者',
  name2: '',
  cpuLevel: 'normal',
  humanSide: 'black',
};

describe('ReversiUnifiedSettingsScreen user experience contract', () => {
  it('hides CPU strength and variant selection when joining via code, showing only clean join UI', () => {
    const html = renderToStaticMarkup(
      <ReversiUnifiedSettingsScreen
        variant="normal"
        onVariantChange={() => undefined}
        normalConfig={DUMMY_NORMAL_CONFIG}
        onNormalChange={() => undefined}
        bakuretsuConfig={DEFAULT_BAKURETSU_REVERSI_CONFIG}
        onBakuretsuChange={() => undefined}
        onlineTab="join"
        onOnlineTabChange={() => undefined}
        joinCode="QWERT5"
        onJoinCodeChange={() => undefined}
        onStart={() => undefined}
        onBackToHome={() => undefined}
      />,
    );

    // 参加画面では、通常版/爆裂版の事前選択を強制せず、自動判別を案内
    expect(html).toContain('リバーシ オンライン');
    expect(html).toContain('コードで参加する');
    expect(html).toContain('通常版・爆裂版のどちらのコードでも自動判別して即座に参加します。');
    expect(html).toContain('このコードで参加する');

    // 迷わせる無駄な項目が一切表示されないこと
    expect(html).not.toContain('対戦相手を決める');
    expect(html).not.toContain('CPUの強さ');
    expect(html).not.toContain('ルールの選択');
  });

  it('shows rule selection and side selection when creating an online room, but no CPU options', () => {
    const html = renderToStaticMarkup(
      <ReversiUnifiedSettingsScreen
        variant="normal"
        onVariantChange={() => undefined}
        normalConfig={DUMMY_NORMAL_CONFIG}
        onNormalChange={() => undefined}
        bakuretsuConfig={DEFAULT_BAKURETSU_REVERSI_CONFIG}
        onBakuretsuChange={() => undefined}
        onlineTab="create"
        onOnlineTabChange={() => undefined}
        joinCode=""
        onJoinCodeChange={() => undefined}
        onStart={() => undefined}
        onBackToHome={() => undefined}
      />,
    );

    expect(html).toContain('ルールと手番を決める');
    expect(html).toContain('通常版');
    expect(html).toContain('爆裂版');
    expect(html).toContain('あなたの手番');
    expect(html).toContain('黒・先手');
    expect(html).toContain('ルームを作成する');

    // ルーム作成時にCPU設定は出ないこと
    expect(html).not.toContain('CPUの強さ');
  });

  it('shows CPU level options and rule selection in CPU mode', () => {
    const html = renderToStaticMarkup(
      <ReversiUnifiedSettingsScreen
        variant="bakuretsu"
        onVariantChange={() => undefined}
        normalConfig={{ ...DUMMY_NORMAL_CONFIG, mode: 'cpu' }}
        onNormalChange={() => undefined}
        bakuretsuConfig={{ ...DEFAULT_BAKURETSU_REVERSI_CONFIG, mode: 'cpu' }}
        onBakuretsuChange={() => undefined}
        onlineTab="create"
        onOnlineTabChange={() => undefined}
        joinCode=""
        onJoinCodeChange={() => undefined}
        onStart={() => undefined}
        onBackToHome={() => undefined}
      />,
    );

    expect(html).toContain('ルールと対戦相手を決める');
    expect(html).toContain('CPUの強さ');
    expect(html).toContain('Lv1・ベビードラゴン');
    expect(html).toContain('この設定で対戦する');
  });
});
