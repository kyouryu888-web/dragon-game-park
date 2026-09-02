import type { ReactNode } from 'react';

type GameTheme = 'mancala' | 'uno' | 'backgammon' | 'babanuki' | 'reversi';

export function GameSetupShell({
  theme,
  icon,
  title,
  englishTitle,
  description,
  onBack,
  children,
}: {
  theme: GameTheme;
  icon: ReactNode;
  title: string;
  englishTitle: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <main className={`game-setup-shell game-setup-theme-${theme}`}>
      <header className="game-setup-topbar">
        <button type="button" className="game-selection-back" onClick={onBack}>
          <span aria-hidden="true">←</span>
          ゲーム選択に戻る
        </button>
        <span className="game-setup-brand">DRAGON-GAME-PARK</span>
      </header>

      <div className="game-setup-frame">
        <aside className="game-setup-identity">
          <div className="game-setup-icon" aria-hidden="true">{icon}</div>
          <p className="game-setup-english">{englishTitle}</p>
          <h1>{title}</h1>
          <p className="game-setup-description">{description}</p>
        </aside>
        <section className="game-setup-workflow" aria-label={`${title}の対戦設定`}>
          {children}
        </section>
      </div>
    </main>
  );
}

export function SetupStep({
  numeral,
  title,
  description,
  children,
}: {
  numeral: 'I' | 'II' | 'III' | 'IV';
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="game-setup-step">
      <div className="game-setup-step-heading">
        <span>{numeral}.</span>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="game-setup-step-body">{children}</div>
    </section>
  );
}

export function SetupModeCard({
  selected,
  disabled = false,
  icon,
  title,
  code,
  description,
  note,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  code: string;
  description: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`game-setup-mode${selected ? ' is-selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="game-setup-mode-icon" aria-hidden="true">{icon}</span>
      <span className="game-setup-mode-copy">
        <strong>{title} <small>{code}</small></strong>
        <span>{description}</span>
        {note ? <em>{note}</em> : null}
      </span>
      {selected ? <span className="game-setup-mode-check" aria-hidden="true">✓</span> : null}
    </button>
  );
}

export function SetupChoiceTabs({
  value,
  onChange,
}: {
  value: 'create' | 'join';
  onChange: (value: 'create' | 'join') => void;
}) {
  return (
    <div className="game-setup-tabs" role="group" aria-label="オンライン対戦の参加方法">
      <button type="button" className={value === 'create' ? 'is-selected' : ''} onClick={() => onChange('create')}>
        ルームを作成
      </button>
      <button type="button" className={value === 'join' ? 'is-selected' : ''} onClick={() => onChange('join')}>
        コードで参加
      </button>
    </div>
  );
}

export function SetupSummary({ children }: { children: ReactNode }) {
  return <div className="game-setup-summary">{children}</div>;
}

