# Dragon English Odyssey audio

Production audio is generated locally with
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), licensed under Apache-2.0.
The model itself is not distributed with this web application.

- Generator version: `kokoro==0.9.4`
- Voice: `af_heart` (US English)
- Sample rate: 24 kHz, mono
- App format: 64 kbps MP3
- Generator: `scripts/generate-english-quest-audio.mjs`
- Runtime fallback: the browser's local `SpeechSynthesis` voice

Install the build-only Python packages, then run:

```powershell
$env:ENGLISH_QUEST_PYTHON = "C:\path\to\python.exe"
node scripts/generate-english-quest-audio.mjs
```

Every generated file is recorded in `manifest.json` with its transcript,
voice, duration, sample rate, and SHA-256 hash. Listen to all files before publishing.
