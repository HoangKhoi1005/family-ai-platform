"""Validate documentation assets only; no application or LLM claims. Stdlib only."""
from pathlib import Path
import json
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


def read_json(relative):
    try:
        return json.loads((ROOT / relative).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        errors.append(f"{relative}: {exc}")
        return None


markdown = sorted(ROOT.glob("*.md"))
for directory in ("docs", "specs", "templates", "tests", "evals"):
    markdown.extend(sorted((ROOT / directory).rglob("*.md")))

for path in markdown:
    body = path.read_text(encoding="utf-8")
    check("\ufffd" not in body, f"{path.relative_to(ROOT)}: replacement character")
    # Standard inline links used in this documentation; no remote network requests.
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", body):
        target = target.strip().strip("<>")
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
            continue
        local = unquote(target.split("#", 1)[0])
        check((path.parent / local).exists(), f"{path.relative_to(ROOT)}: missing {target}")

context = read_json("docs/context.json")
tokens = read_json("design/tokens.json")
fixture = read_json("evals/fixtures.json")
cases = read_json("evals/cases.json")

if context:
    check(context["pilot_people"] == 15, "Pilot differs from confirmed 15-person scope")
    version = context["context_version"]
    for relative in ("README.md", "CURRENT_STATE.md", "docs/INDEX.md"):
        check(version in (ROOT / relative).read_text(encoding="utf-8"), f"{relative}: version missing")

if tokens:
    check(tokens["interaction"]["minimumTargetPx"] >= 44, "Touch target baseline below 44")

if fixture and cases:
    check(fixture.get("synthetic") is True, "Fixture must be labeled synthetic")
    users = {u["id"]: u for u in fixture["users"]}
    families = set(fixture["families"])
    members = {m["id"]: m for m in fixture["members"]}
    entities = [e for group in ("members", "contacts", "relationships", "events", "documents") for e in fixture[group]]
    sources = {e["source"]: e for e in entities}
    check(len(sources) == len(entities), "Duplicate fixture source IDs")
    for entity in entities:
        check(entity["family_id"] in families, f"Unknown family on {entity['id']}")
    for relationship in fixture["relationships"]:
        for field in ("parent", "child"):
            member = members.get(relationship[field])
            check(member is not None and member["family_id"] == relationship["family_id"], f"Bad relationship {relationship['id']}")
    for contact in fixture["contacts"]:
        member = members.get(contact["member_id"])
        check(member is not None and member["family_id"] == contact["family_id"], f"Bad contact {contact['id']}")
    for user in users.values():
        for family, member_id in user["member_links"].items():
            member = members.get(member_id)
            check(family in user["memberships"] and member is not None and member["family_id"] == family, f"Bad account link {user['id']}")
    seen = set()
    statuses = {"answered", "needs_clarification", "insufficient_data", "access_denied", "unavailable"}
    for case in cases:
        key = case["id"]
        check(key not in seen, f"Duplicate case {key}")
        seen.add(key)
        check(case["actor"] in users, f"{key}: unknown actor")
        check(case["family_id"] in families, f"{key}: unknown family")
        check(case["expected_status"] in statuses, f"{key}: invalid status")
        role = users.get(case["actor"], {}).get("memberships", {}).get(case["family_id"])
        if role not in ("member", "admin"):
            check(case["expected_status"] == "access_denied", f"{key}: inactive membership must deny")
        for source in case.get("required_sources", []):
            check(source in sources, f"{key}: unknown source {source}")
            if source in sources:
                entity = sources[source]
                check(entity["family_id"] == case["family_id"], f"{key}: expected source crosses family")
                if entity.get("visibility") == "self":
                    owner = users.get(case["actor"], {}).get("member_links", {}).get(case["family_id"])
                    check(owner == entity["member_id"], f"{key}: expected source violates self visibility")
        for forbidden in case.get("forbidden_values", []):
            check(all(forbidden not in fact for fact in case.get("required_facts", [])), f"{key}: contradictory expected values")
    check(len(cases) == 24, "Seed documentation expects 24 cases; update docs when extending")

if errors:
    print("FAIL: Project Brain validation")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"PASS: {len(markdown)} Markdown files; local link targets; 4 JSON assets; context version; {len(cases)} seed cases.")
print("Not evaluated: application behavior, authorization implementation, lunar dates, LLM answers, device UX, or external links.")
