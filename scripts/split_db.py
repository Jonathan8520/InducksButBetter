#!/usr/bin/env python3
"""
split_db.py — Découpe la base en tranches compressées, prêtes à servir en statique.

Sortie :
    <out>/manifest.json            quelques centaines d'octets, revalidé à chaque visite
    <out>/<version>/00000.bin      tranches de taille fixe, compressées (deflate brut)

Le dossier `<version>` est l'empreinte du fichier : une reconstruction produit un nouveau
dossier, si bien qu'aucune tranche publiée ne change jamais de contenu. Elles peuvent donc
être mises en cache « pour toujours » par le navigateur et le CDN, et un visiteur ne mélange
jamais deux versions de la base.

Chaque tranche est compressée individuellement pour rester lisible seule. Le navigateur
la décompresse (fflate) après réception.

Usage :
    python scripts/split_db.py data/inducks.sqlite dist/db --chunk-kib 256
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import zlib


def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("db")
    ap.add_argument("out")
    ap.add_argument("--chunk-kib", type=int, default=256)
    ap.add_argument("--level", type=int, default=6, help="niveau de compression zlib")
    ap.add_argument("--no-compress", action="store_true")
    args = ap.parse_args()

    chunk = args.chunk_kib * 1024
    size = os.path.getsize(args.db)

    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    page_size = con.execute("PRAGMA page_size").fetchone()[0]
    meta = dict(con.execute("SELECT key, value FROM meta").fetchall())
    con.close()
    if chunk % page_size:
        raise SystemExit(f"la tranche ({chunk}) doit être un multiple de la page ({page_size})")

    h = hashlib.sha256()
    with open(args.db, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    version = h.hexdigest()[:12]

    if os.path.isdir(args.out):
        shutil.rmtree(args.out)
    target = os.path.join(args.out, version)
    os.makedirs(target)

    count = 0
    written = 0
    with open(args.db, "rb") as fh:
        while True:
            data = fh.read(chunk)
            if not data:
                break
            if args.no_compress:
                payload = data
            else:
                c = zlib.compressobj(args.level, zlib.DEFLATED, -15)
                payload = c.compress(data) + c.flush()
            with open(os.path.join(target, f"{count:05d}.bin"), "wb") as out:
                out.write(payload)
            written += len(payload)
            count += 1

    manifest = {
        "format": "sqlite-chunked-v2",
        "version": version,
        "path": f"{version}/",
        "totalBytes": size,
        "chunkBytes": chunk,
        "chunkCount": count,
        "pageSize": page_size,
        "compression": "none" if args.no_compress else "deflate-raw",
        "built": meta.get("built"),
        "dump": meta.get("dump"),
    }
    with open(os.path.join(args.out, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)

    print(f"[split] {count} tranches de {args.chunk_kib} Kio — base {human(size)}, "
          f"publié {human(written)} ({100 * written / max(size, 1):.0f} %)")
    print(f"[split] version {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
