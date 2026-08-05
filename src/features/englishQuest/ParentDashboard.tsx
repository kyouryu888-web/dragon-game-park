import { useEffect, useRef, useState } from 'react';
import { playLearningItem, stopEnglishAudio } from './englishQuestAudio';
import { ENGLISH_QUEST_ITEMS, ENGLISH_QUEST_SPIRITS } from './englishQuestContent';
import { dueCount, isMastered, masteryPercent } from './englishQuestEngine';
import { parseImportedProgress, serializeProgress } from './englishQuestStorage';
import { SpiritSprite } from './EnglishQuestSprites';
import type { PlayerProgress, SkillTag } from './englishQuestTypes';

const SKILLS: Array<{ tag: SkillTag; label: string }> = [
  { tag: 'listening', label: '聞く力' },
  { tag: 'phonics', label: '音と文字' },
  { tag: 'vocabulary', label: 'ことば' },
  { tag: 'conversation', label: '会話' },
  { tag: 'reading', label: '読む力' },
  { tag: 'inference', label: '推理する力' },
];

function skillPercent(progress: PlayerProgress, tag: SkillTag): number {
  const items = ENGLISH_QUEST_ITEMS.filter((item) => item.skillTags.includes(tag));
  if (!items.length) return 0;
  const points = items.reduce((sum, item) => sum + Math.min(5, progress.mastery[item.id]?.stage ?? 0), 0);
  return Math.round((points / (items.length * 5)) * 100);
}
export function ParentDashboard({
  progress,
  onChange,
  onClose,
  onReset,
}: {
  progress: PlayerProgress;
  onChange: (progress: PlayerProgress) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [pastedJson, setPastedJson] = useState('');
  const [audioIndex, setAudioIndex] = useState(0);
  const mastered = Object.values(progress.mastery).filter(isMastered).length;
  const captured = Object.values(progress.spirits).filter((state) => state !== 'locked').length;
  const audioItem = ENGLISH_QUEST_ITEMS[audioIndex];
  const approvedAudio = new Set(progress.audioReview.approvedItemIds);
  const flaggedAudio = new Set(progress.audioReview.flaggedItemIds);
  const reviewedAudioCount = approvedAudio.size + flaggedAudio.size;

  useEffect(() => stopEnglishAudio, []);

  const download = () => {
    const blob = new Blob([serializeProgress(progress)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dragon-english-progress-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('学習データを書き出しました。');
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const imported = parseImportedProgress(await file.text());
    if (!imported) {
      setMessage('このファイルは読み込めませんでした。');
      return;
    }
    onChange(imported);
    setMessage('学習データを復元しました。');
  };
  const importPastedJson = () => {
    const imported = parseImportedProgress(pastedJson);
    if (!imported) {
      setMessage('貼り付けたデータを読み込めませんでした。');
      return;
    }
    onChange(imported);
    setPastedJson('');
    setMessage('貼り付けた学習データを復元しました。');
  };
  const markAudio = (status: 'approved' | 'flagged') => {
    const approvedItemIds = progress.audioReview.approvedItemIds.filter((id) => id !== audioItem.id);
    const flaggedItemIds = progress.audioReview.flaggedItemIds.filter((id) => id !== audioItem.id);
    if (status === 'approved') approvedItemIds.push(audioItem.id);
    else flaggedItemIds.push(audioItem.id);
    onChange({ ...progress, audioReview: { approvedItemIds, flaggedItemIds } });
    if (audioIndex < ENGLISH_QUEST_ITEMS.length - 1) setAudioIndex((value) => value + 1);
  };

  return (
    <main className="eq-shell eq-parent-shell">
      <header className="eq-session-header">
        <button className="eq-round-button" type="button" onClick={onClose} aria-label="地図へ戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <div><h1>保護者メニュー</h1><p>点数予測ではなく、長期定着を確認します</p></div>
      </header>

      <section className="eq-parent-summary">
        <label>
          冒険者のニックネーム
          <input
            value={progress.profileName}
            maxLength={16}
            onChange={(event) => onChange({ ...progress, profileName: event.target.value })}
          />
        </label>
        <div className="eq-parent-metrics">
          <div><strong>{masteryPercent(progress)}%</strong><span>第1島の習熟度</span></div>
          <div><strong>{mastered}/100</strong><span>長期定着した項目</span></div>
          <div><strong>{dueCount(progress)}</strong><span>今日の復習項目</span></div>
          <div><strong>{captured}/8</strong><span>仲間になった精霊</span></div>
        </div>
      </section>

      <section className="eq-skill-section">
        <h2>力の育ち方</h2>
        {SKILLS.map((skill) => {
          const percent = skillPercent(progress, skill.tag);
          return (
            <div className="eq-skill-row" key={skill.tag}>
              <span>{skill.label}</span>
              <div><i style={{ width: `${percent}%` }} /></div>
              <strong>{percent}%</strong>
            </div>
          );
        })}
      </section>

      <section className="eq-parent-spirits">
        <h2>精霊図鑑</h2>
        <div>
          {ENGLISH_QUEST_SPIRITS.map((spirit) => (
            <figure key={spirit.id}>
              <SpiritSprite
                index={spirit.spriteIndex}
                label={spirit.name}
                muted={progress.spirits[spirit.id] === 'locked'}
              />
              <figcaption>{progress.spirits[spirit.id] === 'evolved' ? spirit.evolvedName : spirit.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="eq-data-tools">
        <h2>この端末のデータ</h2>
        <p>ログインやクラウド送信はありません。機種変更に備える場合だけ書き出してください。</p>
        <div>
          <button type="button" onClick={download}>データを書き出す</button>
          <button type="button" onClick={() => fileRef.current?.click()}>データを復元する</button>
          <button className="eq-danger-button" type="button" onClick={onReset}>最初からやり直す</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
        <details className="eq-paste-restore">
          <summary>JSONを貼り付けて復元する</summary>
          <label>
            書き出したJSON
            <textarea value={pastedJson} onChange={(event) => setPastedJson(event.target.value)} rows={5} />
          </label>
          <button type="button" disabled={!pastedJson.trim()} onClick={importPastedJson}>貼り付けたデータを復元</button>
        </details>
        {message && <p className="eq-data-message" role="status">{message}</p>}
      </section>

      <section className="eq-audio-review">
        <details>
          <summary>🔊 英語の音声見本を確認する（{reviewedAudioCount}/100件）</summary>
          <div className="eq-audio-review-card">
            <span aria-hidden="true">{audioItem.emoji}</span>
            <div>
              <small>{audioIndex + 1} / {ENGLISH_QUEST_ITEMS.length}・{audioItem.type}</small>
              <strong>{audioItem.display}</strong>
              <p>{audioItem.audioText}</p>
            </div>
            <button type="button" onClick={() => playLearningItem(audioItem, true)}>▶ 音声を聞く</button>
          </div>
          <div className="eq-audio-review-checks" aria-label="現在の音声の確認結果">
            <button className={approvedAudio.has(audioItem.id) ? 'is-selected' : ''} type="button" onClick={() => markAudio('approved')}>✓ 聞き取りOK</button>
            <button className={flaggedAudio.has(audioItem.id) ? 'is-selected is-flagged' : ''} type="button" onClick={() => markAudio('flagged')}>⚑ 要再確認</button>
          </div>
          <div className="eq-audio-review-nav">
            <button type="button" disabled={audioIndex === 0} onClick={() => setAudioIndex((value) => Math.max(0, value - 1))}>← 前の音声</button>
            <button type="button" disabled={audioIndex === ENGLISH_QUEST_ITEMS.length - 1} onClick={() => setAudioIndex((value) => Math.min(ENGLISH_QUEST_ITEMS.length - 1, value + 1))}>次の音声 →</button>
          </div>
          <p>確認結果もこの端末だけに保存します。録音・送信・自動採点はしません。</p>
        </details>
      </section>
    </main>
  );
}
