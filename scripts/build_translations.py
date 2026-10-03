#!/usr/bin/env python3
"""Build translations.json from the translated scenario folders."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVENT_ROOT = ROOT / "event"
CATALOG_PATH = ROOT / "translations.json"


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def main() -> None:
    old_catalog = read_json(CATALOG_PATH)
    old_events = old_catalog.get("events", {})
    if not isinstance(old_events, dict):
        old_events = {}

    events: dict[str, dict] = {}
    if EVENT_ROOT.is_dir():
        event_dirs = sorted(
            (path for path in EVENT_ROOT.iterdir() if path.is_dir() and path.name.isdigit()),
            key=lambda path: int(path.name),
            reverse=True,
        )
        for event_dir in event_dirs:
            numbered_files = {
                int(path.stem): path
                for path in event_dir.glob("*.json")
                if path.stem.isdigit() and int(path.stem) > 0
            }
            chapter_count = 0
            while chapter_count + 1 in numbered_files:
                chapter_count += 1
            if chapter_count == 0:
                continue

            previous = old_events.get(event_dir.name, {})
            if not isinstance(previous, dict):
                previous = {}
            entry: dict[str, object] = {"chapters": chapter_count}

            title = previous.get("title")
            if isinstance(title, str) and title.strip():
                entry["title"] = title.strip()

            previous_titles = previous.get("chapterTitles", [])
            if not isinstance(previous_titles, list):
                previous_titles = []
            chapter_titles: list[str] = []
            for number in range(1, chapter_count + 1):
                previous_title = previous_titles[number - 1] if number <= len(previous_titles) else ""
                if isinstance(previous_title, str) and previous_title.strip():
                    chapter_titles.append(previous_title.strip())
                    continue
                chapter = read_json(numbered_files[number])
                file_name = chapter.get("FileName", "")
                chapter_titles.append(file_name.strip() if isinstance(file_name, str) else "")
            if any(chapter_titles):
                entry["chapterTitles"] = chapter_titles

            events[event_dir.name] = entry

    catalog = {"version": 1, "events": events}
    rendered = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    CATALOG_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Updated {CATALOG_PATH.name}: {len(events)} event(s)")


if __name__ == "__main__":
    main()
