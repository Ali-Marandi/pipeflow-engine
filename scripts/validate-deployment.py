#!/usr/bin/env python3
from pathlib import Path
import sys
import yaml

root = Path(__file__).resolve().parents[1]
paths = [root / "docker-compose.yml", root / "deploy" / "kubernetes" / "pipeflow.yaml"]

for path in paths:
    try:
        with path.open("r", encoding="utf-8") as handle:
            documents = list(yaml.safe_load_all(handle))
    except Exception as error:
        print(f"Invalid YAML: {path}: {error}", file=sys.stderr)
        raise SystemExit(1)
    if not all(isinstance(document, dict) for document in documents if document is not None):
        print(f"Unexpected YAML document in {path}", file=sys.stderr)
        raise SystemExit(1)
    print(f"Valid YAML: {path.relative_to(root)} ({len([item for item in documents if item is not None])} document(s))")
