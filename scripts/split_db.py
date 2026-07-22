#!/usr/bin/env python3
"""
split_db.py — Découpe la base SQLite en tranches déployables sur un hébergeur statique.

Pourquoi découper : Cloudflare Pages refuse tout fichier de plus de 25 Mio (et git refuse
au-delà de 100 Mo). La base fait environ 1 Go. Le VFS HTTP côté navigateur traduit
« lire l'octet N » en une requête Range sur la tranche qui le contient.

Taille de tranche par défaut : 20 Mio — sous la limite de 25 Mio avec de la marge, et assez
grosse pour que le nombre de fichiers reste modeste (~50 pour 1 Go, plafond : 20 000).

Usage:
    python scripts/split_db.py data/inducks.sqlite public/db
    python scripts/split_db.py data/inducks.sqlite public/db --chunk-size 20
"""
from __future__ import annotations

import os
import sys
import json
import shutil
import hashlib
import argparse

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

MIB = 1024 * 1024


def human(n: float) -> str:
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} To"


def sqlite_page_size(path: str) -> int:
    """Lit la taille de page dans l'en-tête SQLite (octets 16-17, big-endian).

    La valeur 1 y code 65536 (cf. format de fichier SQLite).
    """
    with open(path, "rb") as fh:
        head = fh.read(100)
    if head[:16] != b"SQLite format 3\x00":
        raise SystemExit(f"{path} n'est pas une base SQLite")
    raw = int.from_bytes(head[16:18], "big")
    return 65536 if raw == 1 else raw


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("db")
    ap.add_argument("out_dir")
    ap.add_argument("--chunk-size", type=int, default=20, help="taille de tranche en Mio")
    ap.add_argument("--keep", action="store_true", help="ne pas vider le dossier de sortie")
    args = ap.parse_args()

    if not os.path.exists(args.db):
        print(f"Introuvable : {args.db}", file=sys.stderr)
        return 1

    chunk_bytes = args.chunk_size * MIB
    if chunk_bytes > 25 * MIB:
        print(f"[!] {args.chunk_size} Mio dépasse la limite de 25 Mio de Cloudflare Pages")

    total = os.path.getsize(args.db)
    page_size = sqlite_page_size(args.db)
    n_chunks = (total + chunk_bytes - 1) // chunk_bytes

    if os.path.isdir(args.out_dir) and not args.keep:
        shutil.rmtree(args.out_dir)
    os.makedirs(args.out_dir, exist_ok=True)

    print(f"[split] base       : {args.db} — {human(total)}")
    print(f"[split] page SQLite: {page_size} octets")
    print(f"[split] tranches   : {n_chunks} x {args.chunk_size} Mio -> {args.out_dir}\n")

    # Empreinte du fichier complet : elle nomme le dossier des tranches.
    #
    # SANS CELA, une reconstruction produit des tranches au MÊME nom avec un contenu
    # DIFFÉRENT. Le navigateur d'un visiteur déjà venu en garde d'anciennes en cache et les
    # mélange aux nouvelles : SQLite renvoie alors « database disk image is malformed »
    # alors que le fichier publié est parfaitement sain. Observé en conditions réelles.
    # Une URL versionnée rend la collision impossible.
    full = hashlib.sha256()
    with open(args.db, "rb") as src:
        while True:
            blk = src.read(1 << 22)
            if not blk:
                break
            full.update(blk)
    version = full.hexdigest()[:12]
    version_dir = os.path.join(args.out_dir, version)
    os.makedirs(version_dir, exist_ok=True)
    print(f"[split] version   : {version}\n")

    chunks = []
    digest = hashlib.sha256()
    with open(args.db, "rb") as src:
        for i in range(n_chunks):
            name = f"db-{i:04d}.bin"
            path = os.path.join(version_dir, name)
            written = 0
            h = hashlib.sha256()
            with open(path, "wb") as out:
                while written < chunk_bytes:
                    block = src.read(min(1 << 20, chunk_bytes - written))
                    if not block:
                        break
                    out.write(block)
                    h.update(block)
                    digest.update(block)
                    written += len(block)
            chunks.append({"name": name, "bytes": written, "sha256": h.hexdigest()[:16]})
            print(f"  {name}  {human(written):>10}")

    manifest = {
        "format": "sqlite-chunked-v1",
        # Chemin relatif au manifeste. Change à chaque reconstruction, ce qui garantit
        # qu'aucune tranche mise en cache ne peut être réutilisée pour une autre version.
        "basePath": version + "/",
        "version": version,
        "totalBytes": total,
        "chunkBytes": chunk_bytes,
        "chunkCount": len(chunks),
        "pageSize": page_size,
        "sha256": digest.hexdigest(),
        "chunks": chunks,
    }
    mpath = os.path.join(args.out_dir, "manifest.json")
    with open(mpath, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)

    produced = sum(c["bytes"] for c in chunks)
    print(f"\n[split] {len(chunks)} tranches — {human(produced)}")
    if produced != total:
        print(f"[!] incohérence : {produced} octets produits pour {total} attendus")
        return 1
    print(f"[split] manifeste : {mpath}")

    # Les en-têtes de cache accompagnent les tranches : le manifeste ne doit JAMAIS être
    # mis en cache (c'est lui qui annonce la nouvelle version), les tranches peuvent l'être
    # éternellement puisque leur URL contient l'empreinte du fichier.
    headers = os.path.join(args.out_dir, "_headers")
    with open(headers, "w", encoding="utf-8") as fh:
        fh.write(
            "/db/manifest.json\n"
            "  Cache-Control: no-cache, must-revalidate\n"
            f"/db/{version}/*\n"
            "  Cache-Control: public, max-age=31536000, immutable\n"
        )
    print(f"[split] en-têtes  : {headers}")

    over = [c for c in chunks if c["bytes"] > 25 * MIB]
    if over:
        print(f"[!] {len(over)} tranche(s) au-dessus de 25 Mio")
        return 1
    print("[split] toutes les tranches sont sous la limite de 25 Mio ✓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
