#!/usr/bin/env python3
"""Reads the channel's public video list and saves it to videos.json (newest first).
The app shows any video here that it does not already have."""
import json, pathlib, sys, urllib.request
import xml.etree.ElementTree as ET

CHANNEL = "https://www.youtube.com/@mezmurdebterzetewahedo/videos"
CHANNEL_ID = "UCQOlCKlhhIMSF4le-VQ8D7Q"
FEED = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUT = pathlib.Path(__file__).resolve().parent.parent / "videos.json"


def fmt(sec):
    sec = int(sec)
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def fetch():
    from yt_dlp import YoutubeDL
    opts = {"extract_flat": True, "quiet": True, "skip_download": True, "ignoreerrors": True}
    with YoutubeDL(opts) as y:
        info = y.extract_info(CHANNEL, download=False) or {}
    flat = []
    for e in info.get("entries") or []:
        if not e:
            continue
        if e.get("entries"):                       # tab nested inside the channel page
            flat.extend(x for x in e["entries"] if x)
        else:
            flat.append(e)
    out = []
    for e in flat:
        vid, title, dur = e.get("id"), (e.get("title") or "").strip(), e.get("duration")
        if not vid or len(vid) != 11 or not title or not dur:   # skips premieres and live streams
            continue
        out.append({"id": vid, "title": title, "dur": fmt(dur)})
    return out


def parse_feed(xml_text):
    ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
    out = []
    for e in ET.fromstring(xml_text).findall("a:entry", ns):
        vid = e.findtext("yt:videoId", namespaces=ns)
        title = (e.findtext("a:title", namespaces=ns) or "").strip()
        if vid and title:
            out.append({"id": vid, "title": title, "dur": ""})
    return out


def fetch_feed():
    """Backup source: the channel's public feed (latest 15 videos, no lengths)."""
    req = urllib.request.Request(FEED, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return parse_feed(r.read().decode("utf-8"))


def merge(old, new):
    old_by = {v["id"]: v for v in old}
    for v in new:                                            # keep a known length if the new copy has none
        if not v.get("dur") and old_by.get(v["id"], {}).get("dur"):
            v["dur"] = old_by[v["id"]]["dur"]
    seen = {v["id"] for v in new}
    return new + [v for v in old if v["id"] not in seen]    # a video never disappears from the file


NEW_FILE = OUT.parent / "new_videos.json"      # hymns found this run; read by notify.py, never saved to GitHub


def main():
    NEW_FILE.unlink(missing_ok=True)
    old = json.loads(OUT.read_text("utf-8")) if OUT.exists() else []
    new = []
    try:
        new = fetch()
        print(f"yt-dlp found {len(new)} videos.")
    except Exception as e:
        print("yt-dlp failed:", e)
    if not new:
        try:
            new = fetch_feed()
            print(f"Channel feed found {len(new)} videos.")
        except Exception as e:
            print("Channel feed failed:", e)
    if not new:
        print("No videos came back from YouTube; leaving videos.json unchanged.")
        sys.exit(1)
    merged = merge(old, new)
    old_ids = {v["id"] for v in old}
    fresh = [v for v in new if v["id"] not in old_ids]
    if old and fresh:                              # the very first run only fills the list, it announces nothing
        NEW_FILE.write_text(json.dumps(fresh, ensure_ascii=False), "utf-8")
    if merged == old:
        print(f"No changes ({len(old)} videos).")
        return
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n", "utf-8")
    print(f"Saved {len(merged)} videos ({len(merged) - len(old)} new).")


if __name__ == "__main__":
    main()
