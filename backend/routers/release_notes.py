"""
Release Notes router — serves parsed markdown release notes from release-notes/*.md
"""
from fastapi import APIRouter
import os
import re
from pathlib import Path

router = APIRouter(prefix="/api/release-notes", tags=["release-notes"])

RELEASE_NOTES_DIR = Path(__file__).parent.parent.parent / "release-notes"


def _parse_version_type(version: str) -> str:
    parts = version.split(".")
    if len(parts) < 3:
        return "patch"
    major, minor, patch = parts[0], parts[1], parts[2]
    if minor == "0" and patch == "0":
        return "major"
    if patch == "0":
        return "minor"
    return "patch"


def _parse_release_file(filepath: Path) -> dict | None:
    try:
        content = filepath.read_text(encoding="utf-8")
        version_match = re.match(r"v?(\d+\.\d+\.\d+)", filepath.stem)
        if not version_match:
            return None
        version = version_match.group(1)

        date_match = re.search(r"\*\*Released:\*\*\s*(.+)", content)
        date = date_match.group(1).strip() if date_match else ""

        title_match = re.search(r"^#\s+What's New in Version .+\n", content, re.MULTILINE)
        first_feature_match = re.search(r"^###\s+(.+)", content, re.MULTILINE)
        title = first_feature_match.group(1).strip() if first_feature_match else f"Version {version}"

        desc_match = re.search(r"^###\s+.+\n(.+?)(?:\n\n|\Z)", content, re.MULTILINE | re.DOTALL)
        description = ""
        if desc_match:
            description = desc_match.group(1).strip().replace("\n", " ")[:200]

        return {
            "version": version,
            "date": date,
            "type": _parse_version_type(version),
            "title": title,
            "description": description,
            "content": content,
        }
    except Exception:
        return None


@router.get("")
async def list_release_notes():
    """Return all release notes sorted newest first"""
    if not RELEASE_NOTES_DIR.exists():
        return []

    releases = []
    for f in sorted(RELEASE_NOTES_DIR.glob("v*.md"), reverse=True):
        parsed = _parse_release_file(f)
        if parsed:
            releases.append(parsed)

    return releases


@router.get("/latest")
async def get_latest_release():
    """Return the latest release note"""
    if not RELEASE_NOTES_DIR.exists():
        return None

    files = sorted(RELEASE_NOTES_DIR.glob("v*.md"), reverse=True)
    if not files:
        return None

    return _parse_release_file(files[0])
