"""Generate checked-in English Quest MP3 files with local Kokoro-82M."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

KOKORO_VERSION = "0.9.4"
MODEL_NAME = "hexgrad/Kokoro-82M"
TARGET_RMS_DBFS = -20.0
PEAK_LIMIT_DBFS = -1.0


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
    existing_manifest_file = args.output / "manifest.json"
    existing_entries = {}
    if existing_manifest_file.exists():
        try:
            existing_entries = {
                item["itemId"]: item
                for item in json.loads(existing_manifest_file.read_text(encoding="utf-8"))
                if isinstance(item, dict) and "itemId" in item
            }
        except (json.JSONDecodeError, KeyError, TypeError):
            existing_entries = {}
    pipeline = None
    manifest = []

    for index, entry in enumerate(entries, start=1):
        output = args.output / f"{entry['itemId']}.mp3"
        existing = existing_entries.get(entry["itemId"])
        expected_metadata = (
            existing
            and existing.get("transcript") == entry["transcript"]
            and existing.get("asset") == entry["asset"]
            and existing.get("voice") == args.voice
            and existing.get("model") == MODEL_NAME
            and existing.get("generatorVersion") == KOKORO_VERSION
            and existing.get("sampleRate") == 24000
            and existing.get("bitrateKbps") == 64
        )
        if expected_metadata and output.exists():
            file_hash = hashlib.sha256(output.read_bytes()).hexdigest()
            if file_hash == existing.get("sha256"):
                manifest.append(existing)
                print(f"[{index:03}/{len(entries):03}] reuse {output.name}")
                continue

        if pipeline is None:
            pipeline = KPipeline(lang_code="a", repo_id=MODEL_NAME)
        clips = [np.asarray(audio, dtype=np.float32) for _, _, audio in pipeline(
            entry["transcript"], voice=args.voice, speed=args.speed
        )]
        if not clips:
            raise RuntimeError(f"Kokoro returned no audio for {entry['itemId']}")
        samples = np.concatenate(clips).astype(np.float32)
        samples -= float(np.mean(samples))
        rms = float(np.sqrt(np.mean(np.square(samples))))
        peak = float(np.max(np.abs(samples)))
        if rms <= 1e-7 or peak <= 1e-7:
            raise RuntimeError(f"Kokoro returned silent audio for {entry['itemId']}")
        rms_gain = 10 ** (TARGET_RMS_DBFS / 20) / rms
        peak_gain = 10 ** (PEAK_LIMIT_DBFS / 20) / peak
        samples *= min(rms_gain, peak_gain)
        normalized_rms = float(np.sqrt(np.mean(np.square(samples))))
        normalized_peak = float(np.max(np.abs(samples)))
        pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(64)
        encoder.set_in_sample_rate(24000)
        encoder.set_channels(1)
        encoder.set_quality(2)
        encoded = encoder.encode(pcm) + encoder.flush()
        output.write_bytes(encoded)
        manifest.append({
            **entry,
            "voice": args.voice,
            "model": MODEL_NAME,
            "generatorVersion": KOKORO_VERSION,
            "sampleRate": 24000,
            "bitrateKbps": 64,
            "durationSeconds": round(len(samples) / 24000, 3),
            "rmsDbfs": round(20 * math.log10(normalized_rms), 2),
            "peakDbfs": round(20 * math.log10(normalized_peak), 2),
            "sha256": hashlib.sha256(encoded).hexdigest(),
        })
        print(f"[{index:03}/{len(entries):03}] {output.name}")

    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
