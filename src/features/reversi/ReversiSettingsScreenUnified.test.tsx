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
  it('renders Step I variant selection, Step II name, Step III online mode, and Step IV clean join UI without redundant headings', () => {
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

    // Step I: 参加時はルールの事前選択不要・自動判別の案内
    expect(html).toContain('遊戯の掟を選ぶ');
    expect(html).toContain('ルールの事前選択は不要です');

    // Step II: 名を刻む
    expect(html).toContain('名を刻む');

    // Step III: 対戦方法を選ぶ
    expect(html).toContain('対戦方法を選ぶ');
    expect(html).toContain('コードで参加');

    // Step IV: 参加コードを入力（余分な「コードで参加する」重複タイトルがないこと）
    expect(html).toContain('参加コードを入力');
    expect(html).toContain('通常版・爆裂版のどちらのコードでも自動判別して即座に参加します。');
    expect(html).toContain('このコードで参加する');

    // 迷わせる無駄なCPU設定が表示されないこと
    expect(html).not.toContain('CPUの強さ');
  });

  it('shows side selection and single bottom CTA button when creating an online room, with no CPU options', () => {
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

    expect(html).toContain('遊戯の掟を選ぶ');
    expect(html).toContain('通常リバーシ');
    expect(html).toContain('爆裂リバーシー');
    expect(html).toContain('手番を決める');
    expect(html).toContain('黒・先手');
    expect(html).toContain('ルームを作成する');

    // ルーム作成時にCPU設定は出ないこと
    expect(html).not.toContain('CPUの強さ');
  });

  it('shows CPU level options and side selection in CPU mode', () => {
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

    expect(html).toContain('対戦相手と手番を決める');
    expect(html).toContain('CPUの強さ');
    expect(html).toContain('Lv1・ベビードラゴン');
    expect(html).toContain('この設定で対戦する');
  });
});

