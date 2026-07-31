#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""半自动填写书目分类元数据：查 Google Books / Open Library → 写回 Halo 分类。

用法见同目录 README.md。不需要部署到服务器，在你自己的电脑上运行即可。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

AUTHOR_KEY = "tc.xybkwd.top/book-author"
ISBN_KEY = "tc.xybkwd.top/book-isbn"
UA = "TimeCapsuleBookFill/1.0 (Halo theme helper; +https://blog.xybkwd.top)"


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


def http_json(url: str, *, method: str = "GET", token: str | None = None, body: dict | None = None) -> Any:
    data = None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {url}\n{detail}") from e


def halo_list_categories(base: str, token: str) -> list[dict]:
    url = f"{base.rstrip('/')}/apis/content.halo.run/v1alpha1/categories?page=0&size=0"
    data = http_json(url, token=token)
    return data.get("items") or []


def halo_get_category(base: str, token: str, name: str) -> dict:
    url = f"{base.rstrip('/')}/apis/content.halo.run/v1alpha1/categories/{urllib.parse.quote(name)}"
    return http_json(url, token=token)


def halo_put_category(base: str, token: str, cat: dict) -> dict:
    name = cat["metadata"]["name"]
    url = f"{base.rstrip('/')}/apis/content.halo.run/v1alpha1/categories/{urllib.parse.quote(name)}"
    return http_json(url, method="PUT", token=token, body=cat)


def find_books_under_root(cats: list[dict], root_slug: str) -> list[dict]:
    by_name = {c["metadata"]["name"]: c for c in cats}
    root = None
    for c in cats:
        slug = (c.get("spec") or {}).get("slug") or ""
        display = (c.get("spec") or {}).get("displayName") or ""
        if slug == root_slug or display == root_slug:
            root = c
            break
    if not root:
        raise SystemExit(f"找不到阅读根分类（slug/名 = {root_slug}）。请检查主题设置 book_category_slug。")

    books = []
    for child_name in root.get("spec", {}).get("children") or []:
        child = by_name.get(child_name)
        if not child:
            continue
        # 叶子才是书
        if child.get("spec", {}).get("children"):
            continue
        books.append(child)
    return books


def google_books_search(query: str = "", isbn: str = "") -> list[dict]:
    if isbn:
        q = f"isbn:{re.sub(r'[^0-9Xx]', '', isbn)}"
    else:
        q = query.strip()
    if not q:
        return []
    url = "https://www.googleapis.com/books/v1/volumes?" + urllib.parse.urlencode(
        {"q": q, "maxResults": 5, "printType": "books"}
    )
    data = http_json(url)
    out = []
    for item in data.get("items") or []:
        info = item.get("volumeInfo") or {}
        image = (info.get("imageLinks") or {})
        cover = image.get("large") or image.get("medium") or image.get("thumbnail") or image.get("smallThumbnail")
        if cover:
            cover = cover.replace("http://", "https://")
        industry = info.get("industryIdentifiers") or []
        found_isbn = ""
        for ident in industry:
            if ident.get("type") in ("ISBN_13", "ISBN_10"):
                found_isbn = ident.get("identifier") or ""
                if ident.get("type") == "ISBN_13":
                    break
        out.append(
            {
                "source": "google",
                "title": info.get("title") or "",
                "authors": info.get("authors") or [],
                "description": (info.get("description") or "").strip(),
                "cover": cover or "",
                "isbn": found_isbn,
                "info_link": info.get("infoLink") or "",
            }
        )
    return out


def openlibrary_by_isbn(isbn: str) -> list[dict]:
    clean = re.sub(r"[^0-9Xx]", "", isbn)
    if not clean:
        return []
    url = f"https://openlibrary.org/isbn/{clean}.json"
    try:
        data = http_json(url)
    except SystemExit:
        return []
    title = data.get("title") or ""
    desc = data.get("description")
    if isinstance(desc, dict):
        desc = desc.get("value") or ""
    desc = (desc or "").strip()
    authors = []
    for a in data.get("authors") or []:
        key = a.get("key")
        if not key:
            continue
        try:
            ad = http_json(f"https://openlibrary.org{key}.json")
            if ad.get("name"):
                authors.append(ad["name"])
        except SystemExit:
            pass
    cover = f"https://covers.openlibrary.org/b/isbn/{clean}-L.jpg"
    return [
        {
            "source": "openlibrary",
            "title": title,
            "authors": authors,
            "description": desc,
            "cover": cover,
            "isbn": clean,
            "info_link": f"https://openlibrary.org/isbn/{clean}",
        }
    ]


def pick_result(results: list[dict]) -> dict:
    if not results:
        raise SystemExit("没有搜到结果。可换 ISBN，或用更完整的书名+作者再试。")
    print("\n候选：")
    for i, r in enumerate(results, 1):
        authors = " / ".join(r.get("authors") or []) or "（无作者）"
        print(f"  [{i}] {r.get('title')} — {authors}  ({r.get('source')})")
    if len(results) == 1:
        return results[0]
    while True:
        raw = input(f"选哪一本？1-{len(results)}（回车=1）: ").strip()
        if not raw:
            return results[0]
        if raw.isdigit() and 1 <= int(raw) <= len(results):
            return results[int(raw) - 1]
        print("输入无效")


def pick_book_category(books: list[dict], slug: str | None, name: str | None) -> dict:
    if name:
        for b in books:
            if b["metadata"]["name"] == name:
                return b
        raise SystemExit(f"找不到 metadata.name = {name}")
    if slug:
        for b in books:
            if (b.get("spec") or {}).get("slug") == slug:
                return b
        raise SystemExit(f"找不到 slug = {slug}")

    print("\n阅读下的书目分类：")
    for i, b in enumerate(books, 1):
        title = (b.get("spec") or {}).get("displayName") or b["metadata"]["name"]
        s = (b.get("spec") or {}).get("slug") or ""
        print(f"  [{i}] {title}  (slug={s}, name={b['metadata']['name']})")
    if not books:
        raise SystemExit("阅读下还没有叶子书目分类。请先在后台建好书。")
    while True:
        raw = input(f"填哪一本书？1-{len(books)}: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(books):
            return books[int(raw) - 1]
        print("输入无效")


def apply_meta(cat: dict, meta: dict, *, overwrite: bool) -> dict:
    spec = cat.setdefault("spec", {})
    ann = cat.setdefault("metadata", {}).setdefault("annotations", {})
    if not isinstance(ann, dict):
        ann = {}
        cat["metadata"]["annotations"] = ann

    author = " / ".join(meta.get("authors") or [])
    desc = (meta.get("description") or "").strip()
    cover = (meta.get("cover") or "").strip()
    isbn = (meta.get("isbn") or "").strip()

    changed = []
    if cover and (overwrite or not spec.get("cover")):
        spec["cover"] = cover
        changed.append("cover")
    if desc and (overwrite or not spec.get("description")):
        # Halo 分类简介不宜过长
        if len(desc) > 800:
            desc = desc[:797] + "…"
        spec["description"] = desc
        changed.append("description")
    if author and (overwrite or not ann.get(AUTHOR_KEY)):
        ann[AUTHOR_KEY] = author
        changed.append("author")
    if isbn and (overwrite or not ann.get(ISBN_KEY)):
        ann[ISBN_KEY] = isbn
        changed.append("isbn")
    return changed


def main() -> None:
    here = Path(__file__).resolve().parent
    load_dotenv(here / ".env")

    p = argparse.ArgumentParser(description="半自动填写 Halo 书目分类的封面/作者/简介")
    p.add_argument("--halo", default=os.environ.get("HALO_BASE_URL", "https://blog.xybkwd.top"), help="站点根 URL")
    p.add_argument("--token", default=os.environ.get("HALO_PAT", ""), help="个人令牌 PAT")
    p.add_argument("--root-slug", default=os.environ.get("BOOK_ROOT_SLUG", "yue-du"), help="阅读根分类 slug")
    p.add_argument("--slug", help="目标书目分类 slug")
    p.add_argument("--name", help="目标书目分类 metadata.name")
    p.add_argument("--isbn", help="ISBN")
    p.add_argument("--query", help="书名关键词（可带作者）")
    p.add_argument("--overwrite", action="store_true", help="覆盖已有封面/简介/作者")
    p.add_argument("--dry-run", action="store_true", help="只预览，不写回 Halo")
    args = p.parse_args()

    if not args.token:
        raise SystemExit("缺少 HALO_PAT。请复制 tools/book-fill/.env.example 为 .env 并填入令牌。")

    cats = halo_list_categories(args.halo, args.token)
    books = find_books_under_root(cats, args.root_slug)
    target = pick_book_category(books, args.slug, args.name)
    title_hint = (target.get("spec") or {}).get("displayName") or ""

    query = args.query or re.sub(r"[《》]", "", title_hint)
    results: list[dict] = []
    if args.isbn:
        results = google_books_search(isbn=args.isbn)
        if not results:
            results = openlibrary_by_isbn(args.isbn)
    if not results and query:
        results = google_books_search(query=query)
    meta = pick_result(results)

    print("\n将写入：")
    print(f"  书名分类: {(target.get('spec') or {}).get('displayName')}")
    print(f"  匹配书名: {meta.get('title')}")
    print(f"  作者: {' / '.join(meta.get('authors') or []) or '（无）'}")
    print(f"  ISBN: {meta.get('isbn') or '（无）'}")
    print(f"  封面: {meta.get('cover') or '（无）'}")
    desc = meta.get("description") or ""
    print(f"  简介: {(desc[:120] + '…') if len(desc) > 120 else (desc or '（无）')}")

    # 重新 GET 最新版本，避免乐观锁冲突
    fresh = halo_get_category(args.halo, args.token, target["metadata"]["name"])
    changed = apply_meta(fresh, meta, overwrite=args.overwrite)
    if not changed:
        print("\n没有可写字段（可能已有内容）。加 --overwrite 可强制覆盖。")
        return
    print(f"\n变更字段: {', '.join(changed)}")
    if args.dry_run:
        print("dry-run：未写回。")
        return
    confirm = input("确认写回 Halo？[y/N] ").strip().lower()
    if confirm not in ("y", "yes"):
        print("已取消。")
        return
    halo_put_category(args.halo, args.token, fresh)
    print("完成。刷新书单页即可看到封面/作者/简介。")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
