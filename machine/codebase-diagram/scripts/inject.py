#!/usr/bin/env python3
"""Replace the diagram-model JSON block in the HTML template."""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys


SCRIPT_RE = re.compile(
    r'(<script type="application/json" id="diagram-model">)(.*?)(</script>)',
    re.DOTALL,
)

REQUIRED_ROOT = ("title", "stats", "startView", "views")
REQUIRED_VIEW = ("id", "title", "summary", "howBuilt", "groups", "nodes", "edges")
REQUIRED_NODE = ("id", "code", "label", "x", "y", "height", "summary", "howBuilt")
REQUIRED_EDGE = ("from", "to", "packets")
REQUIRED_PACKET = ("label", "detail")


def die(message: str) -> None:
    print(f"inject: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_fields(obj: object, fields: tuple[str, ...], where: str) -> dict:
    if not isinstance(obj, dict):
        die(f"{where} must be an object")
    missing = [name for name in fields if name not in obj]
    if missing:
        die(f"{where} missing {', '.join(missing)}")
    return obj


def validate(model: object) -> None:
    root = require_fields(model, REQUIRED_ROOT, "root")
    views = root["views"]
    if not isinstance(views, dict) or not views:
        die("views must be a non-empty object")
    start = root["startView"]
    if start not in views:
        die(f"startView {start!r} is not in views")
    if not isinstance(root["stats"], list) or not root["stats"]:
        die("stats must be a non-empty array")

    for view_id, raw_view in views.items():
        view = require_fields(raw_view, REQUIRED_VIEW, f"views.{view_id}")
        if view["id"] != view_id:
            die(f"views.{view_id} id must equal its key")
        parent = view.get("parent")
        if parent is not None and parent not in views:
            die(f"views.{view_id} parent {parent!r} is not in views")
        nodes = view["nodes"]
        if not isinstance(nodes, list) or not nodes:
            die(f"views.{view_id} nodes must be a non-empty array")
        node_ids: set[str] = set()
        codes: set[str] = set()
        group_ids = {
            group["id"]
            for group in view["groups"]
            if isinstance(group, dict) and "id" in group
        }
        for index, raw_node in enumerate(nodes):
            node = require_fields(raw_node, REQUIRED_NODE, f"views.{view_id}.nodes[{index}]")
            node_id = node["id"]
            if node_id in node_ids:
                die(f"views.{view_id} duplicate node id {node_id!r}")
            node_ids.add(node_id)
            code = node["code"]
            if code in codes:
                die(f"views.{view_id} duplicate code {code!r}")
            codes.add(code)
            group = node.get("group")
            if group is not None and group not in group_ids:
                die(f"views.{view_id} node {node_id!r} group {group!r} is missing")
            inside = node.get("inside")
            if inside is not None and inside not in views:
                die(f"views.{view_id} node {node_id!r} inside {inside!r} is not in views")
            height = node["height"]
            if not isinstance(height, int) or height < 1 or height > 5:
                die(f"views.{view_id} node {node_id!r} height must be an integer 1..5")

        for index, raw_edge in enumerate(view["edges"]):
            edge = require_fields(raw_edge, REQUIRED_EDGE, f"views.{view_id}.edges[{index}]")
            for end in ("from", "to"):
                if edge[end] not in node_ids:
                    die(f"views.{view_id}.edges[{index}] {end} {edge[end]!r} is not a node")
            packets = edge["packets"]
            if not isinstance(packets, list) or not packets:
                die(f"views.{view_id}.edges[{index}] packets must be a non-empty array")
            for packet_index, raw_packet in enumerate(packets):
                require_fields(
                    raw_packet,
                    REQUIRED_PACKET,
                    f"views.{view_id}.edges[{index}].packets[{packet_index}]",
                )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", type=pathlib.Path)
    parser.add_argument("model", type=pathlib.Path)
    parser.add_argument("-o", "--output", type=pathlib.Path, required=True)
    args = parser.parse_args()

    try:
        model = json.loads(args.model.read_text())
    except json.JSONDecodeError as error:
        die(f"model is not JSON: {error}")

    validate(model)
    html = args.template.read_text()
    blob = json.dumps(model, ensure_ascii=False, indent=2).replace("<", "\\u003c")

    def splice(match: re.Match[str]) -> str:
        return f"{match.group(1)}\n{blob}\n{match.group(3)}"

    html, count = SCRIPT_RE.subn(splice, html, count=1)
    if count != 1:
        die("template is missing the #diagram-model script block")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html)
    print(args.output)


if __name__ == "__main__":
    main()
