#!/usr/bin/env python3
"""
og_index.py — Petits fichiers JSON pour les aperçus de liens (Open Graph).

Quand une fiche est partagée (messagerie, réseau social), le robot qui fabrique l'aperçu ne
lance pas le JavaScript : il lit seulement le HTML. Une fonction Cloudflare
(functions/_og.ts) insère alors le titre, l'auteur et l'image de la fiche dans le HTML, en
lisant ces fichiers.

Chaque famille (histoires, numéros, publications, auteurs, personnages) est répartie en
paquets par empreinte du code, pour que la fonction n'ait qu'un petit fichier à lire.

Le même passage écrit aussi sitemap.xml à côté (histoires les plus publiées, auteurs,
personnages, publications), pour que les moteurs de recherche trouvent les fiches.

Usage :
    python scripts/og_index.py data/inducks.sqlite dist/og
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from urllib.parse import quote
from xml.sax.saxutils import escape

#: Nombre de paquets par famille (≈ 10 à 20 Ko chacun).
SHARDS = {"s": 2048, "p": 32, "a": 64, "h": 64}


def shard(key: str, n: int) -> int:
    """FNV-1a 32 bits sur l'UTF-8 du code, identique à functions/_og.ts."""
    h = 0x811C9DC5
    for b in key.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h % n


def write(out: str, kind: str, rows: dict[str, list]) -> int:
    n = SHARDS[kind]
    buckets: list[dict[str, list]] = [{} for _ in range(n)]
    for key, value in rows.items():
        buckets[shard(key, n)][key] = value
    os.makedirs(os.path.join(out, kind), exist_ok=True)
    size = 0
    for i, bucket in enumerate(buckets):
        data = json.dumps(bucket, ensure_ascii=False, separators=(",", ":"))
        size += len(data.encode())
        with open(os.path.join(out, kind, f"{i}.json"), "w", encoding="utf-8") as f:
            f.write(data)
    return size


SITE = os.environ.get("SITE_URL", "https://inducksbutbetter-demo.pages.dev").rstrip("/")


def enc(code: str) -> str:
    """Comme enc() de src/lib/routes.ts : encodeURIComponent, espaces en « + »."""
    return quote(code, safe="-_.!~*'()").replace("%20", "+")


def sitemap(db: sqlite3.Connection, path: str) -> int:
    urls = [f"{SITE}/", f"{SITE}/search", f"{SITE}/countries", f"{SITE}/creators", f"{SITE}/characters"]
    urls += [f"{SITE}/stories/{enc(c)}" for (c,) in db.execute(
        "SELECT storycode FROM story WHERE kind = 'n' AND pubs >= 10 ORDER BY pubs DESC")]
    urls += [f"{SITE}/creators/{enc(c)}" for (c,) in db.execute(
        "SELECT code FROM person WHERE stories >= 5 AND code NOT IN ('?', '-') ORDER BY stories DESC")]
    urls += [f"{SITE}/characters/{enc(c)}" for (c,) in db.execute(
        "SELECT code FROM character WHERE stories >= 20 AND code <> '--' ORDER BY stories DESC")]
    for (code,) in db.execute("SELECT code FROM publication ORDER BY issues DESC"):
        country, _, pub = code.partition("/")
        urls.append(f"{SITE}/publications/{enc(country)}/{enc(pub)}")
    urls = urls[:50_000]
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write(f"<url><loc>{escape(u)}</loc></url>\n")
        f.write("</urlset>\n")
    return len(urls)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
    out = sys.argv[2]
    people = {code: name for code, name in db.execute("SELECT code, name FROM person_label")}

    # Histoires : titre original, année, deux premiers auteurs, image.
    stories: dict[str, list] = {}
    for code, title, date, creators, img, fr in db.execute(
        """SELECT s.storycode, s.title, s.date, s.creators, s.img,
                  (SELECT t.title FROM story_title t WHERE t.sid = s.sid AND t.lang = 'fr')
           FROM story s"""
    ):
        names: list[str] = []
        for part in (creators or "").split(";"):
            pc = part.split(":", 1)[-1]
            if pc and pc not in ("?", "-") and people.get(pc) and people[pc] not in names:
                names.append(people[pc])
        year = date[:4] if date and date[:4].isdigit() else ""
        stories[code] = [title or code, year, ", ".join(names[:2]), img or "", fr or ""]

    pubs = {code: [title, cc] for code, title, cc in db.execute(
        "SELECT code, title, countrycode FROM publication_label")}
    creators = {code: [name] for code, name in people.items()}
    chars = {code: [name] for code, name in db.execute(
        "SELECT code, name FROM character_label WHERE lang = 'en'")}
    for code, name in db.execute("SELECT code, name FROM character_label WHERE lang = ''"):
        chars.setdefault(code, [name])

    total = write(out, "s", stories) + write(out, "p", pubs) + write(out, "a", creators) + write(out, "h", chars)
    n = sitemap(db, os.path.join(os.path.dirname(os.path.abspath(out)), "sitemap.xml"))
    print(f"[og] sitemap.xml : {n:,} adresses")
    print(f"[og] {len(stories):,} histoires, {len(pubs):,} publications, {len(creators):,} auteurs, "
          f"{len(chars):,} personnages, {total / 1e6:.1f} Mo en {sum(SHARDS.values())} fichiers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
