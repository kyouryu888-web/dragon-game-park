"""Generate checked-in English Quest MP3 files with local Kokoro-82M."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=0.88)
    return parser.parse_args()


def main() -> None:
    args = arguments()
    try:
        import lameenc
        import numpy as np
        from kokoro import KPipeline
    except ImportError as exc:
        raise SystemExit(
            "Missing build-only packages. Install with: "
            "python -m pip install 'kokoro==0.9.4' lameenc numpy"
        ) from exc

    entries = json.loads(args.source.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    pipeline = KPipeline(lang_code="a")
    manifest = []

    for index, entry in enumerate(entries, start=1):
        clips = [np.asarray(audio, dtype=np.float32) for _, _, audio in pipeline(
            entry["transcript"], voice=args.voice, speed=args.speed
        )]
        if not clips:
            raise RuntimeError(f"Kokoro returned no audio for {entry['itemId']}")
        samples = np.concatenate(clips)
        pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(64)
        encoder.set_in_sample_rate(24000)
        encoder.set_channels(1)
        encoder.set_quality(2)
        encoded = encoder.encode(pcm) + encoder.flush()
        output = args.output / f"{entry['itemId']}.mp3"
        output.write_bytes(encoded)
        manifest.append({
            **entry,
            "voice": args.voice,
            "sampleRate": 24000,
            "durationSeconds": round(len(samples) / 24000, 3),
            "sha256": hashlib.sha256(encoded).hexdigest(),
        })
        print(f"[{index:03}/{len(entries):03}] {output.name}")

    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
