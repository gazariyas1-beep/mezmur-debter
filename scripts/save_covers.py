#!/usr/bin/env python3
"""Saves a full-size copy of the cover picture of every new hymn into the b/ folder,
so the app shows it from your own site, as sharp as the older hymns.
Only videos that are not already built into data.js are saved."""
import json, pathlib, re, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_PER_RUN = 40


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if len(data) > 5000 else None          # YouTube's tiny "no picture" placeholder is smaller


def best_cover(vid):
    for name in ("maxresdefault", "sddefault"):         # biggest first
        try:
            data = fetch(f"https://i.ytimg.com/vi/{vid}/{name}.jpg")
            if data:
                return data
        except Exception:
            pass
    return None


def main():
    videos = json.loads((ROOT / "videos.json").read_text("utf-8")) if (ROOT / "videos.json").exists() else []
    known = set(re.findall(r'"v":"([A-Za-z0-9_-]{11})"', (ROOT / "data.js").read_text("utf-8")))
    out = ROOT / "b"; out.mkdir(exist_ok=True)
    saved = 0
    for v in videos:                                    # newest first
        if v["id"] in known or (out / f"{v['id']}.jpg").exists():
            continue
        if saved >= MAX_PER_RUN:
            break
        data = best_cover(v["id"])
        if data:
            (out / f"{v['id']}.jpg").write_bytes(data); saved += 1
    print(f"Saved {saved} cover picture(s).")


if __name__ == "__main__":
    main()
