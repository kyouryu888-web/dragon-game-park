import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReversiSettingsScreen } from './ReversiSettingsScreen';
import type { ReversiConfig } from './reversiTypes';

function renderSettings(config: ReversiConfig, onlineTab: 'create' | 'join', joinCode = ''): string {
  return renderToStaticMarkup(
    <ReversiSettingsScreen
      config={config}
      onChange={vi.fn()}
      onlineTab={onlineTab}
      onOnlineTabChange={vi.fn()}
      joinCode={joinCode}
      onJoinCodeChange={vi.fn()}
      onStart={vi.fn()}
      onBackToHome={vi.fn()}
    />,
  );
}

describe('ReversiSettingsScreen', () => {
  it('オンライン作成と6桁コード参加の導線を表示する', () => {
    const html = renderSettings({
      mode: 'online',
      name: '',
      name2: '',
      cpuLevel: 'normal',
      humanSide: 'black',
    }, 'join');

    expect(html).toContain('遠方の者と対戦');
    expect(html).toContain('ルームを作成');
    expect(html).toContain('コードで参加');
    expect(html).toContain('placeholder="コードを入力"');
    expect(html).toContain('このコードで参加する</button>');
    expect(html).toContain('disabled=""');
  });

  it('CPU対戦では既存ゲームと同じ5段階を維持する', () => {
    const html = renderSettings({
      mode: 'cpu',
      name: '',
      name2: '',
      cpuLevel: 'normal',
      humanSide: 'black',
    }, 'create');

    for (const label of ['ベビードラゴン', 'ドラゴン', 'スーパードラゴン', 'ドラゴンキング', 'ゴッドドラゴン']) {
      expect(html).toContain(label);
    }
  });
});
