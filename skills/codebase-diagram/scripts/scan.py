#!/usr/bin/env python3
"""Fail if a generated diagram HTML looks like it contains secrets."""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys


# Prefixes and PEM markers. These are values, not documentation words.
PREFIX_PATTERNS = (
    r"ghp_[A-Za-z0-9_]{20,}",
    r"gho_[A-Za-z0-9_]{20,}",
    r"github_pat_[A-Za-z0-9_]{20,}",
    r"sk_live_[A-Za-z0-9]{16,}",
    r"sk_test_[A-Za-z0-9]{16,}",
    r"pk_live_[A-Za-z0-9]{16,}",
    r"xox[baprs]-[A-Za-z0-9-]{10,}",
    r"AKIA[0-9A-Z]{16}",
    r"ASIA[0-9A-Z]{16}",
    r"AGE-SECRET-KEY-[A-Z0-9-]+",
    r"-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----",
    r"herenow_[a-z]+_[A-Za-z0-9_-]{16,}",
    r"hn_live_[A-Za-z0-9_-]{12,}",
    r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
)

# Assignment of a long high-entropy value to a secret-looking name.
ASSIGNMENT = re.compile(
    r"(?i)\b(api[_-]?key|secret|password|passwd|token|private[_-]?key|claim[_-]?token"
    r"|authorization|bearer|connection[_-]?string)\b[^.\n]{0,24}"
    r"""(['\"])([A-Za-z0-9/+._=-]{16,})\2"""
)

PLACEHOLDER = re.compile(
    r"(?i)^(redacted|placeholder|example|changeme|your[_-]?secret|xxx+|<\w+>)$"
)


def looks_like_secret_value(value: str) -> bool:
    if PLACEHOLDER.match(value):
        return False
    if re.fullmatch(r"[A-Za-z0-9/+._=-]{16,}", value) is None:
        return False
    classes = sum(
        bool(re.search(pattern, value))
        for pattern in (r"[a-z]", r"[A-Z]", r"[0-9]", r"[/+_=-]")
    )
    return classes >= 3


def walk(node: object, path: str, hits: list[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            walk(value, f"{path}.{key}", hits)
        return
    if isinstance(node, list):
        for index, value in enumerate(node):
            walk(value, f"{path}[{index}]", hits)
        return
    if not isinstance(node, str):
        return
    for pattern in PREFIX_PATTERNS:
        match = re.search(pattern, node)
        if match:
            hits.append(f"{path}: matches {pattern}")
    assignment = ASSIGNMENT.search(node)
    if assignment and looks_like_secret_value(assignment.group(3)):
        hits.append(f"{path}: secret-looking assignment")


def extract_model(html: str) -> object:
    match = re.search(
        r'<script type="application/json" id="diagram-model">(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        print("scan: missing #diagram-model", file=sys.stderr)
        raise SystemExit(2)
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as error:
        print(f"scan: model is not JSON: {error}", file=sys.stderr)
        raise SystemExit(2)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=pathlib.Path)
    args = parser.parse_args()
    html = args.html.read_text()
    hits: list[str] = []
    walk(extract_model(html), "model", hits)
    for pattern in PREFIX_PATTERNS:
        if re.search(pattern, html):
            hits.append(f"html: matches {pattern}")
    # Unique, stable order
    unique = list(dict.fromkeys(hits))
    if unique:
        print("scan: possible secrets", file=sys.stderr)
        for hit in unique:
            print(f"  {hit}", file=sys.stderr)
        raise SystemExit(1)
    print("scan: clean")


if __name__ == "__main__":
    main()
