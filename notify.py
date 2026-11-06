#!/usr/bin/env python3
"""Sends one push notification through OneSignal when update_videos.py found new hymns."""
import json, os, pathlib, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILE = ROOT / "new_videos.json"
APP_URL = os.environ.get("APP_URL", "https://mezmurdebterapp.gazariyas1.workers.dev/")


def main_title(t):
    return t.split("||")[0].strip() or t


def build(app_id, fresh):
    if len(fresh) == 1:
        heading, body, url = "New hymn", main_title(fresh[0]["title"]), APP_URL + "#/play/v" + fresh[0]["id"]
    else:
        names = ", ".join(main_title(v["title"]) for v in fresh[:3]) + ("…" if len(fresh) > 3 else "")
        heading, body, url = f"{len(fresh)} new hymns", names, APP_URL
    return {"app_id": app_id, "target_channel": "push", "included_segments": ["Subscribed Users"],
            "headings": {"en": heading}, "contents": {"en": body}, "url": url}


def send(payload, key):
    req = urllib.request.Request("https://api.onesignal.com/notifications", data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json", "Authorization": "Key " + key}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def main():
    if not FILE.exists():
        print("No new hymns, nothing to send.")
        return
    app_id, key = os.environ.get("ONESIGNAL_APP_ID"), os.environ.get("ONESIGNAL_API_KEY")
    if not (app_id and key):
        print("OneSignal keys are not set, skipping notifications.")
        return
    fresh = json.loads(FILE.read_text("utf-8"))
    time.sleep(int(os.environ.get("WAIT_SECONDS", "180")))      # give the website time to publish the new list first
    try:
        print("Sent:", send(build(app_id, fresh), key))
    except Exception as e:
        print("Notification failed:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
