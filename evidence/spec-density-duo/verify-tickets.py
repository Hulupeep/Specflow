"""Read-only raw readback/structure evidence for the ticket review, not product tests."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
failed = False
for number in range(162, 168):
    saved = json.loads((root / f"issue-{number}.json").read_text())
    result = subprocess.run(
        ["gh", "issue", "view", str(number), "--repo", "Hulupeep/Specflow",
         "--json", "number,title,state,body,comments,labels,updatedAt,url"],
        capture_output=True, text=True, check=True,
    )
    current = json.loads(result.stdout)
    matches = all(saved[key] == current[key] for key in ("title", "body", "comments", "labels", "state"))
    readable = (root / f"issue-{number}.md").read_text()
    expected_readable = f"# {current['title']}\n\nSource: {current['url']}\n\n" + current["body"]
    ids = re.findall(r"^- \[ \] (AC-\d+-\d+):", current["body"], re.M)
    structure = len(ids) == len(set(ids)) and 3 <= len(ids) <= 8 and len(current["body"]) < 20000
    passed = matches and readable == expected_readable and structure and current["state"] == "OPEN"
    failed |= not passed
    print(json.dumps({
        "issue": number, "url": current["url"], "updatedAt": current["updatedAt"],
        "expectedBodySha256": hashlib.sha256(saved["body"].encode()).hexdigest(),
        "actualBodySha256": hashlib.sha256(current["body"].encode()).hexdigest(),
        "remoteMatchesFrozenInput": matches, "readableCopyMatches": readable == expected_readable,
        "bodyCharacters": len(current["body"]), "acceptanceIds": ids,
        "state": current["state"], "passed": passed,
    }), flush=True)
print(json.dumps({"scope": "remote readback and document structure only", "passed": not failed,
                  "productTestsExecuted": False, "semanticPeerReviewRequired": True}), flush=True)
sys.exit(1 if failed else 0)
