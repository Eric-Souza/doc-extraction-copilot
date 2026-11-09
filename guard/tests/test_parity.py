# The guard must flag the same fields as the app's checks (src/lib/review.ts) on every document in
# tests/fixtures.json, which `npx tsx scripts/guard-fixtures.ts` writes from the eval set.

import json
from pathlib import Path

import pytest

from doc_guard.guards import make_guards
from doc_guard.issues import failed_checks

DATA = json.loads((Path(__file__).parent / "fixtures.json").read_text(encoding="utf-8"))
GUARDS = make_guards()


@pytest.mark.parametrize("fixture", DATA["fixtures"], ids=lambda f: f["id"])
def test_flags_the_same_fields_as_the_app(fixture):
    outcome = GUARDS[fixture["type"]].parse(json.dumps(fixture["data"]), num_reasks=0, metadata={"today": DATA["today"]})
    flagged = sorted({path for paths, _ in failed_checks(outcome) for path in paths})
    assert flagged == fixture["failed"]
