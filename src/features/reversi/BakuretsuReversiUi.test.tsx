import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './bakuretsu/config.ts';
import { initGame, makeRng } from './bakuretsu/rules.ts';
import { BakuretsuReversiBoard } from './BakuretsuReversiBoard';
import { BakuretsuReversiGameScreen } from './BakuretsuReversiGameScreen';
import { BakuretsuReversiSettingsScreen } from './BakuretsuReversiSettingsScreen';
import { ReversiVariantSelectScreen } from './ReversiVariantSelectScreen';
import { DEFAULT_BAKURETSU_REVERSI_CONFIG } from './bakuretsuUi';

describe('Bakuretsu Reversi UI contract', () => {
  it('offers normal and bakuretsu without changing the established Reversi setup shell', () => {
    const html = renderToStaticMarkup(
      <ReversiVariantSelectScreen onSelectNormal={() => undefined} onSelectBakuretsu={() => undefined} onBackToHome={() => undefined} />,
    );
    expect(html).toContain('game-setup-shell game-setup-theme-reversi');
    expect(html).toContain('通常リバーシ');
    expect(html).toContain('爆裂リバーシ');
  });

  it('renders every mandatory always-visible battle indicator', () => {
    const html = renderToStaticMarkup(
      <BakuretsuReversiGameScreen
        config={DEFAULT_BAKURETSU_REVERSI_CONFIG}
        onBackToSetup={() => undefined}
        onBackToHome={() => undefined}
      />,
    );
    expect(html).toContain('爆破射程');
    expect(html).toContain('切替まであと20枚');
    expect(html).toContain('連鎖 待機');
    expect(html).toContain('TIME BANK');
    expect(html).toContain('20:00');
    expect(html).toContain('特殊コマ状況');
    expect(html).toContain('中立配置は反転0枚');
    expect(html).toContain('自軍は爆風でも無傷');
    expect(html).toContain('中立は挟む端になれない');
    expect(html).toContain('反転を止めて通常化');
    expect(html.match(/role="gridcell"/g)).toHaveLength(64);
  });

  it('offers CPU play with all five levels and side choices', () => {
    const html = renderToStaticMarkup(
      <BakuretsuReversiSettingsScreen
        config={{ ...DEFAULT_BAKURETSU_REVERSI_CONFIG, mode: 'cpu' }}
        onChange={() => undefined}
        onlineTab="create"
        onOnlineTabChange={() => undefined}
        joinCode=""
        onJoinCodeChange={() => undefined}
        onStart={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(html).toContain('VS CPU');
    expect(html).toContain('CPUの強さ');
    expect(html).toContain('Lv1・ベビードラゴン');
    expect(html).toContain('Lv5・ゴッドドラゴン');
    expect(html.match(/<option/g)).toHaveLength(5);
    expect(html).toContain('黒・先手');
    expect(html).toContain('白・後手');
    expect(html).toContain('おまかせ');
  });

  it('offers a six-character online room flow without changing local or CPU choices', () => {
    const html = renderToStaticMarkup(
      <BakuretsuReversiSettingsScreen
        config={{ ...DEFAULT_BAKURETSU_REVERSI_CONFIG, mode: 'online' }}
        onChange={() => undefined}
        onlineTab="join"
        onOnlineTabChange={() => undefined}
        joinCode="ABC234"
        onJoinCodeChange={() => undefined}
        onStart={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(html).toContain('VS CPU');
    expect(html).toContain('VS HUMAN');
    expect(html).toContain('ONLINE');
    expect(html).toContain('6桁コードを入力');
    expect(html).toContain('このコードで爆裂対戦へ参加する');
    expect(html).toContain('value="ABC234"');
  });

  it('keeps special identity and the neutral wall visible on the board', () => {
    const state = initGame(DEFAULT_CONFIG, makeRng(7));
    state.board[0] = { state: 'FACEUP', owner: 'BLACK', specialType: 'BOMB', durability: 0, isQueued: false, activated: false };
    state.board[1] = { state: 'FACEUP', owner: 'NONE', specialType: 'NEUTRAL', durability: 0, isQueued: false, activated: false };
    const html = renderToStaticMarkup(
      <BakuretsuReversiBoard
        viewer="BLACK"
        state={state}
        displayBoard={state.board}
        playback={null}
        choice="NORMAL"
        validMoves={[]}
        interactive={false}
        showHints
        onMove={() => undefined}
      />,
    );
    expect(html).toContain('data-special="BOMB"');
    expect(html).toContain('data-special="NEUTRAL"');
    expect(html).toContain('data-wall="true"');
    expect(html).toContain('bakuretsu-special-mark');
  });
});
