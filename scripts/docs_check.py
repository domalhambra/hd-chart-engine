#!/usr/bin/env python3
"""docs_check.py: the documentation standard's mechanical checks.

Canonical copy: Plateworks OS 00-09 System/01 Docs/scripts/docs_check.py. Vendored
copies are registered in 00-09 System/00 Resources/VENDORED.md. The standard this
enforces is 00-09 System/00 Resources/documentation-standard.md.

Run:  python3 docs_check.py [ROOT] [--budget 2000] [--require docs/architecture.md ...]
Test: python3 "00-09 System/01 Docs/scripts/test_docs_check.py"

Findings, by kind:
  no-guide       CLAUDE.md is missing
  no-readme      README.md is missing
  boilerplate    README.md is a framework starter file
  no-index       docs/README.md is missing
  unindexed      a Markdown file under docs/ has no row in docs/README.md
  dead-path      a backtick-quoted repo path does not exist (checked in CLAUDE.md,
                 README.md, AGENTS.md, docs/README.md, every top-level docs/*.md,
                 and docs/runbooks/*.md; other nested docs are history and are
                 indexed but not path-checked)
  missing-route  CLAUDE.md does not quote a required document
  budget         CLAUDE.md is at or over its token budget (four characters per token)

Path extraction is deliberately narrow: only backtick-quoted tokens that look
like repo paths. Skipped on purpose: URLs and other scheme-prefixed tokens,
tokens with spaces or placeholder brackets or globs, `~` and `/` prefixes,
`dist...` build output, scoped npm packages (`@scope/name`), a bare extension
quoted as a word (`.ics`), a hostname with a path (`bit.ly/abc`), and anything
under `00_Resources/`, which is workspace canon quoted by convention and lives
outside every project repo. A quoted path is resolved from the quoting file's
own folder first and the repo root second. A bare filename with a known
extension passes when any file of that name exists anywhere in the tree.

Exit 0 when clean, 1 with findings, 2 on a usage error. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "DerivedData", ".astro", ".netlify",
    ".worktrees", ".superpowers", "__pycache__", ".venv", "venv", ".build", ".swiftpm",
}
EXTENSIONS = re.compile(
    r"\.(md|ts|tsx|js|mjs|cjs|astro|css|json|toml|ya?ml|html|svg|png|ico|txt|"
    r"woff2?|py|swift|sh|ics|plist|xcconfig|applescript)$",
    re.IGNORECASE,
)
PATH_SHAPE = re.compile(r"^[\w.@+-]+(/[\w.@+\[\]-]+)*/?$")
DOMAIN_FIRST = re.compile(r"^[\w-]+(\.[\w-]+)*\.[a-z]{2,6}$", re.IGNORECASE)
BOILERPLATE_MARKERS = (
    "Astro Starter Kit",
    "npm create astro@latest",
    "Seasoned astronaut",
    "create-next-app",
    "This template should help get you started",
)
DEFAULT_KNOWN_ABSENT = ("SESSION_LOG.md",)


@dataclass(frozen=True)
class Finding:
    kind: str
    file: str
    detail: str

    def __str__(self) -> str:
        return f"{self.kind:<14} {self.file}: {self.detail}"


def markdown_under(directory: Path) -> list[str]:
    """Every *.md under `directory`, as paths relative to it, sorted."""
    out: list[str] = []
    for dirpath, dirnames, filenames in os.walk(directory):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            if name.endswith(".md"):
                out.append(os.path.relpath(os.path.join(dirpath, name), directory))
    return out


def basenames(root: Path) -> set[str]:
    """Every file name in the tree, so a guide can quote `plates.ts` bare."""
    names: set[str] = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        names.update(filenames)
    return names


def _inside(root: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _inside_lexically(root: Path, candidate: Path) -> bool:
    """Containment by path text, without following symlinks.

    `_inside` resolves, so a symlink that points out of the tree
    (`.venv/bin/python`) reads as outside and the quote is lost. Ordering the
    two readings needs the lexical answer: the token is still the repo path it
    looks like, and `--known-absent .venv/` is what excuses it.
    """
    try:
        Path(os.path.normpath(candidate)).relative_to(os.path.normpath(root))
        return True
    except ValueError:
        return False


def quoted_paths(text: str, base_dir: str, root: Path) -> list[str]:
    """Backtick-quoted repo paths in `text`, resolved and returned root-relative."""
    found: dict[str, None] = {}
    for match in re.finditer(r"`([^`\n]+)`", text):
        token = match.group(1).strip()
        if re.match(r"^[a-z]+:", token, re.IGNORECASE):
            continue  # URLs, data: URIs, date:Date:start
        if re.search(r"[<>{}*|\"' ]", token):
            continue  # placeholders, globs, commands
        if token.startswith(("~", "/")):
            continue  # machine paths, routes
        if re.match(r"^dist(/|$)", token):
            continue  # build output
        if token.startswith("@"):
            continue  # scoped npm packages
        if token.startswith("00_Resources/"):
            continue  # workspace canon, outside every project repo
        if re.match(r"^\.\w+$", token):
            continue  # a bare extension quoted as a word (`.ics`); `.github/...` still counts
        has_slash = "/" in token
        if has_slash and DOMAIN_FIRST.match(token.split("/", 1)[0]):
            continue  # a hostname with a path (`bit.ly/abc`), not a repo path
        if not has_slash and not EXTENSIONS.search(token):
            continue  # identifiers, words
        if has_slash and not PATH_SHAPE.match(token):
            continue  # not a path shape
        trailing = "/" if token.endswith("/") else ""
        from_base = (root / base_dir / token)
        from_root = (root / token)
        if _inside(root, from_base) and from_base.exists():
            rel = os.path.relpath(from_base.resolve(), root.resolve())
        elif _inside_lexically(root, from_root):
            rel = os.path.relpath(os.path.normpath(from_root), root)
        elif _inside_lexically(root, from_base):
            # `../tests/x.ts` quoted from docs/: inside the repo but absent.
            # Report it instead of falling through to a root-relative path
            # that lands outside the repo and is skipped (found 2026-09-08).
            rel = os.path.relpath(os.path.normpath(from_base), root)
        else:
            continue  # outside the repo: not ours to verify
        found[rel + trailing] = None
    return list(found)


def dead_paths(paths: list[str], root: Path, names: set[str], known_absent: set[str]) -> list[str]:
    dead: list[str] = []
    for p in paths:
        clean = p.rstrip("/")
        if clean in known_absent or os.path.basename(clean) in known_absent:
            continue
        # An entry ending in "/" is a prefix: a gitignored folder whose
        # contents exist only at runtime (`cache/`, `out/`).
        if any(k.endswith("/") and (clean + "/").startswith(k) for k in known_absent):
            continue
        if (root / clean).exists():
            continue
        if "/" not in clean and clean in names:
            continue
        dead.append(clean)
    return dead


def check_repo(
    root: Path,
    guide: str = "CLAUDE.md",
    docs: str = "docs",
    budget: int = 2000,
    require: tuple[str, ...] | list[str] = (),
    known_absent: tuple[str, ...] | list[str] = DEFAULT_KNOWN_ABSENT,
    readme: str = "README.md",
) -> list[Finding]:
    root = Path(root)
    findings: list[Finding] = []
    names = basenames(root)
    absent = set(known_absent)
    index_rel = f"{docs}/README.md"

    def path_check(rel_file: str, base_dir: str) -> None:
        text = (root / rel_file).read_text(encoding="utf-8")
        for dead in dead_paths(quoted_paths(text, base_dir, root), root, names, absent):
            findings.append(Finding("dead-path", rel_file, dead))

    # README
    if not (root / readme).exists():
        findings.append(Finding("no-readme", readme, "missing"))
    else:
        text = (root / readme).read_text(encoding="utf-8")
        for marker in BOILERPLATE_MARKERS:
            if marker in text:
                findings.append(Finding("boilerplate", readme, f"contains '{marker}'"))
                break
        path_check(readme, ".")

    # The guide
    if not (root / guide).exists():
        findings.append(Finding("no-guide", guide, "missing"))
    else:
        text = (root / guide).read_text(encoding="utf-8")
        tokens = len(text) / 4
        if tokens >= budget:
            findings.append(Finding("budget", guide, f"about {tokens:,.0f} tokens, budget {budget:,}"))
        for req in [index_rel, *require]:
            if f"`{req}`" not in text:
                findings.append(Finding("missing-route", guide, req))
        path_check(guide, ".")

    # Other agents' pointer, when present
    if (root / "AGENTS.md").exists():
        path_check("AGENTS.md", ".")

    # The index and the docs
    docs_dir = root / docs
    if not (root / index_rel).exists():
        findings.append(Finding("no-index", index_rel, "missing"))
    else:
        index = (root / index_rel).read_text(encoding="utf-8")
        files = [f for f in markdown_under(docs_dir) if f != "README.md"]
        for f in files:
            if f"`{f}`" not in index and f"`{docs}/{f}`" not in index:
                findings.append(Finding("unindexed", index_rel, f))
        path_check(index_rel, docs)
        for f in files:
            if "/" not in f:
                path_check(f"{docs}/{f}", docs)
            elif f.startswith("runbooks/") and f.count("/") == 1:
                path_check(f"{docs}/{f}", f"{docs}/runbooks")

    return findings


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Check a repo against the documentation standard.")
    ap.add_argument("root", nargs="?", default=".", help="repo root (default: current directory)")
    ap.add_argument("--guide", default="CLAUDE.md")
    ap.add_argument("--readme", default="README.md")
    ap.add_argument("--docs", default="docs")
    ap.add_argument("--budget", type=int, default=2000, help="guide budget in tokens at four characters each")
    ap.add_argument("--require", action="append", default=[], metavar="PATH", help="a doc the guide must quote; repeatable")
    ap.add_argument("--known-absent", action="append", default=list(DEFAULT_KNOWN_ABSENT), metavar="NAME", help="a file allowed to be absent, or a folder prefix ending in / whose contents exist only at runtime; repeatable")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args(argv)

    root = Path(args.root)
    if not root.is_dir():
        print(f"docs_check: {root} is not a directory", file=sys.stderr)
        return 2
    findings = check_repo(
        root, guide=args.guide, docs=args.docs, budget=args.budget,
        require=tuple(args.require), known_absent=tuple(args.known_absent), readme=args.readme,
    )
    if args.json:
        print(json.dumps([asdict(f) for f in findings], indent=2))
    else:
        for f in findings:
            print(f)
        label = "finding" if len(findings) == 1 else "findings"
        print(f"docs_check: {len(findings)} {label} in {root.resolve().name}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
