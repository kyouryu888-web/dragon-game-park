import { useDragonReactionPreference } from './dragonReactions';

/** Compact device-local control; callers place it in an existing game header. */
export function DragonPresentationControl() {
  const { preference, setPreference } = useDragonReactionPreference();
  return (
    <select
      aria-label="ドラゴン演出"
      title="ドラゴン演出"
      value={preference}
      onChange={event => setPreference(event.target.value as typeof preference)}
      style={{
        position: 'absolute', right: 2, top: 0, width: 79, height: 27,
        border: '1px solid rgba(201,162,75,.5)', borderRadius: 7,
        color: 'var(--text-mid)', background: 'var(--panel-bg, #211c27)',
        fontSize: 10, padding: '2px 3px', zIndex: 15,
      }}
    >
      <option value="lively">🎭 にぎやか</option>
      <option value="subtle">🎭 控えめ</option>
      <option value="off">🎭 オフ</option>
    </select>
  );
}
