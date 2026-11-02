"""Keeps videos.json in sync with the YouTube channel (newest first, nothing is ever dropped)."""
import json, subprocess, sys, urllib.request
import xml.etree.ElementTree as ET

CHANNEL_ID = "UCQOlCKlhhIMSF4le-VQ8D7Q"
VIDEOS_URL = "https://www.youtube.com/@mezmurdebterzetewahedo/videos"
OUT = "videos.json"


def from_ytdlp():
    r = subprocess.run(["yt-dlp", "--flat-playlist", "--print", "%(id)s\t%(title)s\t%(duration_string)s", VIDEOS_URL],
                       capture_output=True, text=True, encoding="utf-8", check=True)
    vids = []
    for line in r.stdout.splitlines():
        p = line.split("\t")
        if len(p) >= 2 and p[0]:
            dur = p[2] if len(p) > 2 and p[2] not in ("NA", "None") else ""
            vids.append({"id": p[0], "title": p[1], "dur": dur})
    return vids


def from_rss():
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
    ns = {"a": "http://www.w3.org/2005/Atom", "y": "http://www.youtube.com/xml/schemas/2015"}
    root = ET.fromstring(urllib.request.urlopen(url, timeout=30).read())
    return [{"id": e.find("y:videoId", ns).text, "title": e.find("a:title", ns).text, "dur": ""}
            for e in root.findall("a:entry", ns)]


def fetch():
    for name, fn in (("yt-dlp", from_ytdlp), ("rss", from_rss)):
        try:
            vids = fn()
            if vids:
                print(f"{name}: {len(vids)} videos")
                return vids
        except Exception as e:
            print(f"{name} failed: {e}", file=sys.stderr)
    return []


def merge(old, fresh):
    old_by = {v["id"]: v for v in old}
    out, seen = [], set()
    for v in fresh:
        o = old_by.get(v["id"], {})
        out.append({"id": v["id"], "title": v["title"] or o.get("title", ""), "dur": v["dur"] or o.get("dur", "")})
        seen.add(v["id"])
    out += [v for v in old if v["id"] not in seen]  # keep anything YouTube no longer lists
    return out


def main():
    fresh = fetch()
    if not fresh:
        print("Nothing fetched; leaving videos.json unchanged.")
        return
    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except FileNotFoundError:
        old = []
    new = merge(old, fresh)
    text = "[\n" + ",\n".join(json.dumps(v, ensure_ascii=False) for v in new) + "\n]\n"
    open(OUT, "w", encoding="utf-8").write(text)
    print(f"videos.json now has {len(new)} videos ({len(new) - len(old)} new)")


if __name__ == "__main__":
    main()
