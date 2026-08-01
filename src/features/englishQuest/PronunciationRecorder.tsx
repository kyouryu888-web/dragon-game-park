import { useEffect, useRef, useState } from 'react';
import { playEnglishText } from './englishQuestAudio';
import { DragonSprite } from './EnglishQuestSprites';

const EXAMPLE_TEXT = 'Hello! My name is Mio.';
const EXAMPLE_AUDIO = '/audio/englishQuest/chunk-hello.mp3';

export function PronunciationRecorder({ soundOn, onClose }: { soundOn: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'ready' | 'denied'>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const closingRef = useRef(false);

  const release = () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      recorderRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  };

  useEffect(() => () => {
    closingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const start = async () => {
    try {
      closingRef.current = false;
      if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
        setStatus('denied');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (closingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const nextUrl = URL.createObjectURL(blob);
        audioUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setStatus('ready');
      };
      recorder.start();
      setStatus('recording');
    } catch {
      setStatus('denied');
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  return (
    <main className="eq-shell eq-recorder-shell">
      <header className="eq-session-header">
        <button className="eq-round-button" type="button" onClick={() => { closingRef.current = true; release(); onClose(); }} aria-label="地図へ戻る">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <div><h1>まねして話そう</h1><p>声はこの画面だけ。保存も送信もしません</p></div>
      </header>

      <section className="eq-recorder-card">
        <DragonSprite pose={2} className="eq-recorder-dragon" />
        <p>ドラゴンの声をよく聞いて、同じように言ってみよう。</p>
        <button className="eq-example-phrase" type="button" onClick={() => playEnglishText(EXAMPLE_TEXT, EXAMPLE_AUDIO, soundOn)}>
          <span aria-hidden="true">🔊</span>
          <strong>{EXAMPLE_TEXT}</strong>
          <small>お手本を聞く</small>
        </button>

        <div className={`eq-mic-visual eq-mic-visual--${status}`} aria-hidden="true">
          <span>🎙</span><i /><i /><i /><i /><i />
        </div>

        {status === 'idle' && <button className="eq-primary-button" type="button" onClick={start}>録音をはじめる</button>}
        {status === 'recording' && <button className="eq-stop-button" type="button" onClick={stop}>録音をとめる</button>}
        {status === 'ready' && audioUrl && (
          <div className="eq-recording-result">
            <audio controls src={audioUrl}>録音した声を再生できません。</audio>
            <button type="button" onClick={start}>もういちど録る</button>
          </div>
        )}
        {status === 'denied' && (
          <div className="eq-mic-message" role="status">
            <p>マイクを使えなくても大丈夫。お手本を聞いて、声に出すだけでも進めるよ。</p>
            <button type="button" onClick={start}>マイクをもういちど試す</button>
          </div>
        )}
      </section>
    </main>
  );
}
