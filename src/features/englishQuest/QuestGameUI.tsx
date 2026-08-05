import { DragonSprite, GuideSprite } from './EnglishQuestSprites';

export function QuestGameHeader({
  title,
  instruction,
  step,
  total,
  onExit,
  guideIndex,
}: {
  title: string;
  instruction: string;
  step: number;
  total: number;
  onExit: () => void;
  guideIndex: number;
}) {
  return (
    <header className="eq-game-header">
      <button className="eq-round-button" type="button" onClick={onExit} aria-label="地図へもどる">←</button>
      <GuideSprite index={guideIndex} label="冒険の案内役" className="eq-game-header-guide" />
      <div><h1>{title}</h1><p>{instruction}</p></div>
      <span>{Math.min(step + 1, total)} / {total}</span>
    </header>
  );
}

export function QuestComplete({
  title,
  message,
  reward,
  onDone,
}: {
  title: string;
  message: string;
  reward: string;
  onDone: () => void;
}) {
  return (
    <main className="eq-shell eq-complete-screen">
      <div className="eq-complete-rays" aria-hidden="true" />
      <DragonSprite pose={3} className="eq-complete-dragon" />
      <h1>{title}</h1>
      <p>{message}</p>
      <div className="eq-result-orb"><strong>★</strong><span>{reward}</span></div>
      <button className="eq-primary-button" type="button" onClick={onDone}>地図へ もどる</button>
    </main>
  );
}
