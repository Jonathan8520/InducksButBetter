#!/usr/bin/env python3
"""
fetch_isv.py — Récupère les fichiers ISV d'Inducks, depuis la source officielle ou la
sauvegarde MEGA de repli.

Deux sources :

  --base URL   Source officielle, `{base}/{table}.isv`, régénérée quotidiennement.
               Indisponible tant qu'inducks.org renvoie 503.

  --mega       Sauvegarde publique du 05/07/2026 mise à disposition par l'auteur amont
               (Florian / Wizyx) pendant la panne. Nécessite `pycryptodome`.

Usage:
    python scripts/fetch_isv.py data/isv --base https://inducks.org/inducks/isv
    python scripts/fetch_isv.py data/isv --mega
    python scripts/fetch_isv.py data/isv --mega --only inducks_issue inducks_story
"""
from __future__ import annotations

import os
import sys
import json
import time
import base64
import argparse
import urllib.error
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

UA = {"User-Agent": "Mozilla/5.0 (InducksButBetter build pipeline)"}

# Sauvegarde publique du 05/07/2026 (73 fichiers, 745,8 Mo).
MEGA_FOLDER_ID = "lSZ3BSIa"
MEGA_FOLDER_KEY = "5ygCpsBRQrd8JCxvfmMaFg"
MEGA_API = "https://g.api.mega.co.nz/cs"

#: Tables du schéma Inducks, telles que présentes dans le dump de référence.
TABLES = [
    "inducks_appearance", "inducks_character", "inducks_characteralias",
    "inducks_characterdetail", "inducks_charactername", "inducks_characterreference",
    "inducks_characterurl", "inducks_country", "inducks_countryname", "inducks_currency",
    "inducks_currencyname", "inducks_entry", "inducks_entrycharactername",
    "inducks_entryjob", "inducks_entryurl", "inducks_equiv", "inducks_herocharacter",
    "inducks_inputfile", "inducks_issue", "inducks_issuecollecting", "inducks_issuedate",
    "inducks_issuejob", "inducks_issueprice", "inducks_issuerange", "inducks_issueurl",
    "inducks_language", "inducks_languagename", "inducks_log", "inducks_logdata",
    "inducks_logocharacter", "inducks_movie", "inducks_moviecharacter", "inducks_moviejob",
    "inducks_moviereference", "inducks_person", "inducks_personalias", "inducks_personurl",
    "inducks_publication", "inducks_publicationcategory", "inducks_publicationname",
    "inducks_publicationurl", "inducks_publisher", "inducks_publishingjob",
    "inducks_referencereason", "inducks_referencereasonname", "inducks_site",
    "inducks_statcharactercharacter", "inducks_statcharactercountry",
    "inducks_statcharacterstory", "inducks_statpersoncharacter", "inducks_statpersoncountry",
    "inducks_statpersonperson", "inducks_statpersonstory", "inducks_story",
    "inducks_storycodes", "inducks_storycreationdate", "inducks_storydescription",
    "inducks_storyheader", "inducks_storyjob", "inducks_storyreference",
    "inducks_storysubseries", "inducks_storyurl", "inducks_storyversion", "inducks_studio",
    "inducks_studiowork", "inducks_subseries", "inducks_subseriesname", "inducks_substory",
    "inducks_team", "inducks_teammember", "inducks_ucrelation", "inducks_universe",
    "inducks_universename",
]


def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


# --------------------------------------------------------------------------------------
# Source officielle
# --------------------------------------------------------------------------------------

def fetch_http(dest: str, base: str, only: list[str] | None) -> int:
    names = only or TABLES
    total = 0
    for name in names:
        url = f"{base.rstrip('/')}/{name}.isv"
        path = os.path.join(dest, f"{name}.isv")
        for attempt in range(5):
            try:
                req = urllib.request.Request(url, headers=UA)
                with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as out:
                    size = 0
                    while True:
                        block = r.read(1 << 20)
                        if not block:
                            break
                        out.write(block)
                        size += len(block)
                total += size
                print(f"  ok {name:<36} {human(size):>10}")
                break
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                if attempt == 4:
                    print(f"  !! {name:<36} échec : {exc}")
                else:
                    time.sleep(5 * (attempt + 1))
    return total


# --------------------------------------------------------------------------------------
# Sauvegarde MEGA
# --------------------------------------------------------------------------------------

def _b64d(s: str) -> bytes:
    s = s.replace("-", "+").replace("_", "/")
    return base64.b64decode(s + "=" * ((4 - len(s) % 4) % 4))


def _mega_api(payload):
    req = urllib.request.Request(
        f"{MEGA_API}?id=0&n={MEGA_FOLDER_ID}",
        data=json.dumps(payload).encode(),
        headers={**UA, "Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode())


def fetch_mega(dest: str, only: list[str] | None) -> int:
    try:
        from Crypto.Cipher import AES
        from Crypto.Util import Counter
    except ImportError:
        print("pycryptodome est requis pour --mega : pip install pycryptodome", file=sys.stderr)
        raise SystemExit(2)

    master = _b64d(MEGA_FOLDER_KEY)
    ecb = AES.new(master, AES.MODE_ECB)

    def decrypt_attr(attr_b64: str, key: bytes) -> dict:
        raw = AES.new(key, AES.MODE_CBC, b"\0" * 16).decrypt(_b64d(attr_b64)).rstrip(b"\0")
        if not raw.startswith(b"MEGA"):
            return {}
        try:
            return json.loads(raw[4:].decode("utf-8", "replace"))
        except ValueError:
            return {}

    nodes = _mega_api([{"a": "f", "c": 1, "r": 1, "ca": 1}])[0]["f"]
    files = []
    for n in nodes:
        if n["t"] != 0:
            continue
        nk = ecb.decrypt(_b64d(n["k"].split(":")[-1]))
        key = bytes(a ^ b for a, b in zip(nk[:16], nk[16:32]))
        name = decrypt_attr(n["a"], key).get("n", "")
        if not name:
            continue
        if only and name[:-4] not in only:
            continue
        files.append({"h": n["h"], "name": name, "size": n.get("s", 0),
                      "key": key, "nonce": nk[16:24]})

    total = 0
    for f in sorted(files, key=lambda x: x["size"]):
        path = os.path.join(dest, f["name"])
        if os.path.exists(path) and os.path.getsize(path) == f["size"]:
            print(f"  = {f['name']:<36} déjà présent")
            total += f["size"]
            continue
        url = _mega_api([{"a": "g", "g": 1, "n": f["h"]}])[0]["g"]
        ctr = Counter.new(128, initial_value=int.from_bytes(f["nonce"] + b"\0" * 8, "big"))
        cipher = AES.new(f["key"], AES.MODE_CTR, counter=ctr)
        tmp = path + ".part"
        with urllib.request.urlopen(url, timeout=180) as r, open(tmp, "wb") as out:
            while True:
                block = r.read(1 << 20)  # multiple de 16 : le flux CTR reste aligné
                if not block:
                    break
                out.write(cipher.decrypt(block))
        os.replace(tmp, path)
        total += f["size"]
        print(f"  ok {f['name']:<36} {human(f['size']):>10}")
    return total


# --------------------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dest")
    ap.add_argument("--base", help="URL de base des ISV officiels")
    ap.add_argument("--mega", action="store_true", help="utiliser la sauvegarde MEGA")
    ap.add_argument("--only", nargs="*", help="ne récupérer que ces tables")
    args = ap.parse_args()

    if not args.base and not args.mega:
        print("Préciser --base URL ou --mega", file=sys.stderr)
        return 2

    os.makedirs(args.dest, exist_ok=True)
    only = [o.replace(".isv", "") for o in args.only] if args.only else None

    t0 = time.time()
    if args.mega:
        print(f"[fetch] sauvegarde MEGA du 05/07/2026 -> {args.dest}\n")
        total = fetch_mega(args.dest, only)
    else:
        print(f"[fetch] {args.base} -> {args.dest}\n")
        total = fetch_http(args.dest, args.base, only)

    got = len([f for f in os.listdir(args.dest) if f.endswith(".isv")])
    print(f"\n[fetch] {got} fichiers — {human(total)} en {time.time()-t0:.1f}s")
    return 0 if got else 1


if __name__ == "__main__":
    raise SystemExit(main())
