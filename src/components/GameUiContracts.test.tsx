import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GameEndActions } from './GameEndActions';
import { GameSetupShell, SetupChoiceTabs } from './GameSetupFlow';
import {
  DEFAULT_ONLINE_ENTRY_MODE,
  DEFAULT_SETUP_MODE,
  shouldAutoJoinOnlineRoom,
} from './gameSetupDefaults';

describe('4ゲーム共通UIの文言契約', () => {
  it('終了後に必須の4操作を表示する', () => {
    const html = renderToStaticMarkup(
      <GameEndActions
        onRematch={vi.fn()}
        onChangeSettings={vi.fn()}
        onBackToSetup={vi.fn()}
        onBackToHome={vi.fn()}
      />,
    );

    expect(html).toContain('再戦する');
    expect(html).toContain('設定を変更して再戦する');
    expect(html).toContain('ゲーム設定に戻る');
    expect(html).toContain('ゲーム選択に戻る');
  });

  it('設定画面の戻る文言とオンライン参加方法を統一する', () => {
    const html = renderToStaticMarkup(
      <GameSetupShell
        theme="uno"
        icon="🃏"
        title="UNO"
        englishTitle="UNO"
        description="カードの決闘"
        onBack={vi.fn()}
      >
        <SetupChoiceTabs value="join" onChange={vi.fn()} />
      </GameSetupShell>,
    );

    expect(html).toContain('ゲーム選択に戻る');
    expect(html).toContain('ルームを作成');
    expect(html).toContain('コードで参加');
  });

  it('全ゲームの初期選択をオンラインのコード参加に統一する', () => {
    expect(DEFAULT_SETUP_MODE).toBe('online');
    expect(DEFAULT_ONLINE_ENTRY_MODE).toBe('join');
    expect(shouldAutoJoinOnlineRoom('join', 'abc123')).toBe(true);
    expect(shouldAutoJoinOnlineRoom('create', 'ABC123')).toBe(false);
    expect(shouldAutoJoinOnlineRoom('join', 'ABC12')).toBe(false);
    expect(shouldAutoJoinOnlineRoom('join', 'ABC-12')).toBe(false);
  });
});
