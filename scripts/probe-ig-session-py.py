#!/usr/bin/env python3
"""Probe Instagram session cookies without Node/server-only."""
from pathlib import Path
import urllib.error
import urllib.request


def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    p = Path(path)
    if not p.exists():
        return env
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        env[key.strip()] = value
    return env


def main() -> None:
    env: dict[str, str] = {}
    env.update(load_env("/var/www/anya-secrets/instagram.env"))
    env.update(load_env(".env.local"))
    sid = env.get("INSTAGRAM_SESSION_ID", "")
    csrf = env.get("INSTAGRAM_CSRF_TOKEN", "0")
    print("session_present", bool(sid), "len", len(sid))
    print("username_set", bool(env.get("INSTAGRAM_USERNAME")))
    print("password_set", bool(env.get("INSTAGRAM_PASSWORD")))
    parts = [f"sessionid={sid}", f"csrftoken={csrf}"]
    for key, cookie in (
        ("INSTAGRAM_DS_USER_ID", "ds_user_id"),
        ("INSTAGRAM_MID", "mid"),
        ("INSTAGRAM_IG_DID", "ig_did"),
        ("INSTAGRAM_DATR", "datr"),
    ):
        if env.get(key):
            parts.append(f"{cookie}={env[key]}")
    req = urllib.request.Request(
        "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Cookie": "; ".join(parts),
            "X-CSRFToken": csrf,
            "X-IG-App-ID": "936619743392459",
            "Accept": "*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read(400).decode("utf-8", "replace")
            print("status", resp.status)
            print("alive", True)
            print("body", body[:200].replace("\n", " "))
    except urllib.error.HTTPError as err:
        body = err.read(400).decode("utf-8", "replace")
        dead = err.code in (401, 403) or "login" in body.lower()
        print("status", err.code)
        print("alive", not dead)
        print("body", body[:200].replace("\n", " "))
    except Exception as exc:  # noqa: BLE001
        print("error", type(exc).__name__, str(exc)[:200])
        print("alive", False)


if __name__ == "__main__":
    main()
