#!/usr/bin/env python3
"""
Mirato Reusable Hymnal Audio Pipeline (CLI / Harness Module)
------------------------------------------------------------
High-throughput, 100% resumable YouTube channel/playlist audio pipeline:
- In-process `yt_dlp.YoutubeDL` with per-thread persistent instances (zero subprocess startup overhead)
- Native YouTube Opus remux (`format 249/250` -> `ffmpeg -c:a copy`, ~20ms/track, zero re-encoding)
  with optional `--loudnorm` EBU R128 (-16 LUFS) encoding fallback
- Fast 11025 Hz STFT BPM + active music duration analyzer (first 90s window)
- Incremental JSON persistence + ready-to-install `.zip` pack output

Example usage:
  python3 scripts/hymnal-audio-pipeline.py \\
    --url "https://www.youtube.com/channel/UC.../videos" \\
    --out-dir "./audio-packs/my-hymnal__plus" \\
    --bpm-json "./bpm.json" \\
    --zip-out "./audio-packs/my-hymnal__plus.zip" \\
    --workers 10 \\
    --max-num 3300
"""
import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import zipfile

import numpy as np
from scipy.signal import stft
import yt_dlp

_tls = threading.local()


def get_thread_ydl(outtmpl: str, format_spec: str) -> yt_dlp.YoutubeDL:
    ydl = getattr(_tls, "ydl", None)
    if ydl is None:
        ydl = yt_dlp.YoutubeDL({
            "format": format_spec,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "noplaylist": True,
            "retries": 2,
            "socket_timeout": 20,
            "outtmpl": outtmpl,
        })
        _tls.ydl = ydl
    else:
        ydl.params["outtmpl"] = {"default": outtmpl}
    return ydl


def index_youtube_source(url: str, max_num: int, index_cache: str | None = None) -> dict[str, dict]:
    if index_cache and os.path.exists(index_cache) and os.path.getsize(index_cache) > 100:
        return json.load(open(index_cache, "r", encoding="utf-8"))

    with yt_dlp.YoutubeDL({"extract_flat": True, "quiet": True, "no_warnings": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    entries = (info or {}).get("entries") or []

    by_num: dict[str, dict] = {}
    for e in entries:
        title = e.get("title") or ""
        vid = e.get("id")
        if not vid:
            continue
        m = re.search(r"(?:№|#)\s*0*(\d{1,4})\b", title) or re.match(r"^\s*0*(\d{1,4})\b", title)
        if not m:
            continue
        num = int(m.group(1))
        if not (1 <= num <= max_num):
            continue
        key = str(num)
        if key not in by_num:
            by_num[key] = {"num": num, "url": f"https://www.youtube.com/watch?v={vid}", "title": title}

    if index_cache:
        os.makedirs(os.path.dirname(os.path.abspath(index_cache)), exist_ok=True)
        with open(index_cache, "w", encoding="utf-8") as f:
            json.dump(by_num, f, ensure_ascii=False, indent=2)
    return by_num


def analyze_ogg_bpm(ogg_path: str) -> dict:
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-threads", "1", "-i", ogg_path,
        "-ac", "1", "-ar", "11025", "-f", "f32le", "pipe:1",
    ])
    y = np.frombuffer(raw, dtype=np.float32)
    sr = 11025
    hop = 256
    duration = len(y) / sr
    n_frames = len(y) // hop
    frames = y[:n_frames * hop].reshape(n_frames, hop)
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    thresh = np.max(rms) * 0.04
    active = np.where(rms > thresh)[0]
    music_sec = ((active[-1] - active[0]) * hop / sr) if len(active) > 10 else duration

    y_stft = y[:sr * 90]
    _, _, Z = stft(y_stft, fs=sr, nperseg=1024, noverlap=1024 - hop)
    mag = np.log1p(10.0 * np.abs(Z))
    flux = np.sum(np.maximum(0.0, np.diff(mag[4:220, :], axis=1)), axis=0)
    flux = flux - np.mean(flux)
    fps = sr / hop
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    min_lag = int(round(fps * 60.0 / 155.0))
    max_lag = int(round(fps * 60.0 / 50.0))
    lags = np.arange(min_lag, max_lag + 1)
    bpms = 60.0 * fps / lags
    prior = np.exp(-0.5 * ((np.log2(bpms / 92.0)) / 0.55) ** 2)
    bpm = float(bpms[int(np.argmax(ac[min_lag:max_lag + 1] * prior))])
    return {
        "duration_sec": round(duration, 1),
        "music_sec": round(music_sec, 1),
        "bpm_stft": round(bpm, 1),
    }


def convert_to_ogg(src_path: str, out_ogg: str, bitrate: str, loudnorm: bool) -> None:
    # Fast native remux path: YouTube format 249/250 is already Opus in WebM (~20ms, zero re-encode)
    if not loudnorm and (src_path.endswith(".webm") or src_path.endswith(".opus")):
        try:
            subprocess.check_call([
                "ffmpeg", "-y", "-v", "error", "-i", src_path,
                "-vn", "-c:a", "copy", "-f", "ogg", out_ogg,
            ], stderr=subprocess.DEVNULL)
            if os.path.exists(out_ogg) and os.path.getsize(out_ogg) > 6_000:
                return
        except Exception:
            pass

    cmd = ["ffmpeg", "-y", "-v", "error", "-threads", "1", "-i", src_path, "-vn", "-f", "ogg"]
    if loudnorm:
        cmd += ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"]
    cmd += ["-c:a", "libopus", "-b:a", bitrate, "-vbr", "on", "-compression_level", "5", "-application", "audio", out_ogg]
    subprocess.check_call(cmd, stderr=subprocess.DEVNULL)


def run_pipeline(args: argparse.Namespace) -> None:
    os.makedirs(args.out_dir, exist_ok=True)
    index = index_youtube_source(args.url, args.max_num, args.index_cache)
    bpm_map: dict[str, dict] = {}
    if args.bpm_json and os.path.exists(args.bpm_json):
        try:
            bpm_map = json.load(open(args.bpm_json, "r", encoding="utf-8"))
        except Exception:
            bpm_map = {}

    tasks = [(int(k), v["url"], bpm_map.get(k)) for k, v in sorted(index.items(), key=lambda kv: int(kv[0]))]
    total = len(tasks)
    print(f"[hymnal-audio-pipeline] {total} tracks, workers={args.workers}, loudnorm={args.loudnorm}", flush=True)

    def worker(item: tuple[int, str, dict | None]) -> tuple[int, dict | None, bool]:
        num, url, existing_bpm = item
        out_ogg = os.path.join(args.out_dir, f"{str(num).zfill(3)}.ogg")
        if os.path.exists(out_ogg) and os.path.getsize(out_ogg) > 6_000:
            if existing_bpm:
                return num, existing_bpm, False
            try:
                return num, analyze_ogg_bpm(out_ogg), False
            except Exception:
                return num, None, False

        for attempt in range(2):
            try:
                with tempfile.TemporaryDirectory() as td:
                    ydl = get_thread_ydl(os.path.join(td, "src.%(ext)s"), args.format)
                    ydl.download([url])
                    srcs = [os.path.join(td, fn) for fn in os.listdir(td) if fn.startswith("src.")]
                    if not srcs:
                        raise RuntimeError("No audio downloaded")
                    tmp_ogg = os.path.join(td, "out.ogg")
                    convert_to_ogg(srcs[0], tmp_ogg, args.bitrate, args.loudnorm)
                    shutil.move(tmp_ogg, out_ogg)
                return num, analyze_ogg_bpm(out_ogg), True
            except Exception:
                if attempt == 0:
                    time.sleep(1.0)
        return num, None, True

    lock = threading.Lock()
    done = ok = net_done = 0
    net_t0: float | None = None

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for num, stats, was_net in ex.map(worker, tasks):
            with lock:
                done += 1
                if was_net:
                    if net_t0 is None:
                        net_t0 = time.time()
                    net_done += 1
                if stats:
                    bpm_map[str(num)] = stats
                    ok += 1
                if done % 50 == 0 or done == total:
                    if args.bpm_json:
                        os.makedirs(os.path.dirname(os.path.abspath(args.bpm_json)), exist_ok=True)
                        with open(args.bpm_json, "w", encoding="utf-8") as f:
                            json.dump(bpm_map, f, ensure_ascii=False, indent=2)
                    if net_t0 and net_done > 0:
                        rate = net_done / max(0.01, (time.time() - net_t0) / 60.0)
                        eta = (total - done) / max(0.1, rate)
                        print(f"  Progress: {done}/{total} (ok={ok}, {rate:.1f} tr/min, ETA ~{eta:.1f} min)", flush=True)
                    else:
                        print(f"  Progress: {done}/{total} (ok={ok}, cached)", flush=True)

    if args.zip_out:
        oggs = sorted(fn for fn in os.listdir(args.out_dir) if fn.endswith(".ogg"))
        os.makedirs(os.path.dirname(os.path.abspath(args.zip_out)), exist_ok=True)
        with zipfile.ZipFile(args.zip_out, "w", compression=zipfile.ZIP_STORED) as zf:
            for fn in oggs:
                zf.write(os.path.join(args.out_dir, fn), arcname=fn)
        print(f"[hymnal-audio-pipeline] Packed {len(oggs)} tracks -> {args.zip_out} ({os.path.getsize(args.zip_out)/1024/1024:.1f} MB)", flush=True)


def main() -> None:
    p = argparse.ArgumentParser(description="Fast resumable YouTube Opus audio + STFT BPM pipeline")
    p.add_argument("--url", required=True, help="YouTube channel /videos or playlist URL")
    p.add_argument("--out-dir", required=True, help="Directory for output 001.ogg ... files")
    p.add_argument("--bpm-json", help="Path to save incremental STFT BPM JSON")
    p.add_argument("--index-cache", help="Optional path to cache indexed YouTube video list")
    p.add_argument("--zip-out", help="Optional path to pack final .zip audio pack")
    p.add_argument("--workers", type=int, default=10, help="Parallel worker threads (default: 10)")
    p.add_argument("--bitrate", default="48k", help="Fallback Opus bitrate (default: 48k)")
    p.add_argument("--format", default="249/250/bestaudio[acodec=opus]/bestaudio/best", help="yt-dlp format selector")
    p.add_argument("--loudnorm", action="store_true", help="Enable EBU R128 -16 LUFS re-encoding (slower than native copy)")
    p.add_argument("--max-num", type=int, default=3300, help="Maximum hymn catalog number (default: 3300)")
    run_pipeline(p.parse_args())


if __name__ == "__main__":
    main()
