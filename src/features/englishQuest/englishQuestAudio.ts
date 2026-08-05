import type { LearningItem } from './englishQuestTypes';

let activeAudio: HTMLAudioElement | null = null;
let playbackToken = 0;
let audioAssetsPromise: Promise<Set<string>> | null = null;

function audioAssets(): Promise<Set<string>> {
  audioAssetsPromise ??= fetch('/audio/englishQuest/manifest.json')
    .then(async (response) => {
      if (!response.ok) return new Set<string>();
      const manifest: unknown = await response.json();
      if (!Array.isArray(manifest)) return new Set<string>();
      return new Set(
        manifest
          .map((entry) => (entry && typeof entry === 'object' ? (entry as { asset?: unknown }).asset : null))
          .filter((asset): asset is string => typeof asset === 'string'),
      );
    })
    .catch(() => new Set<string>());
  return audioAssetsPromise;
}

export function stopEnglishAudio(): void {
  playbackToken += 1;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakFallback(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.78;
  utterance.pitch = 1.04;
  window.speechSynthesis.speak(utterance);
}

export function speakJapanese(text: string, enabled = true): void {
  if (!enabled || !('speechSynthesis' in window)) return;
  stopEnglishAudio();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.88;
  utterance.pitch = 1.06;
  window.speechSynthesis.speak(utterance);
}

export function playEnglishText(text: string, asset?: string, enabled = true): void {
  if (!enabled) return;
  stopEnglishAudio();
  const token = playbackToken;
  if (!asset) {
    speakFallback(text);
    return;
  }

  void audioAssets().then((assets) => {
    if (token !== playbackToken) return;
    if (!assets.has(asset)) {
      speakFallback(text);
      return;
    }

    const audio = new Audio(asset);
    activeAudio = audio;
    audio.playbackRate = 0.92;
    let finished = false;
    const fallback = () => {
      if (finished) return;
      finished = true;
      if (activeAudio === audio) activeAudio = null;
      if (token === playbackToken) speakFallback(text);
    };
    audio.addEventListener('ended', () => {
      finished = true;
      if (activeAudio === audio) activeAudio = null;
    }, { once: true });
    audio.addEventListener('error', fallback, { once: true });
    void audio.play().catch(fallback);
  });
}

export function playLearningItem(item: LearningItem, enabled = true): void {
  playEnglishText(item.audioText, item.audioAsset, enabled);
}
