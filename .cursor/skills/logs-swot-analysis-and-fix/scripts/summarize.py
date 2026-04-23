#!/usr/bin/env python3
"""
Summarizes nanobrowser session logs into a text report the agent can reason over.

Usage: python scripts/summarize.py <sessions.json>

Output: human-readable statistics written to stdout.
"""
import json
import sys
from collections import Counter
from pathlib import Path


def load(path: str) -> list[dict]:
    with open(path) as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    return data


def fmt_ms(ms: float) -> str:
    s = ms / 1000
    if s < 60:
        return f"{s:.0f}s"
    return f"{s // 60:.0f}m {s % 60:.0f}s"


def summarize(sessions: list[dict]) -> None:
    total = len(sessions)
    if total == 0:
        print("No sessions found.")
        return

    outcomes = Counter(s["outcome"] for s in sessions)
    complete_rate = outcomes.get("complete", 0) / total * 100

    durations = [(s["completedAt"] - s["startedAt"]) for s in sessions]
    avg_duration = sum(durations) / len(durations)

    all_steps = [s["steps"] for s in sessions]
    avg_steps = sum(all_steps) / len(all_steps)

    all_errors: list[str] = []
    all_actions: list[str] = []
    all_goals: list[str] = []
    error_steps = 0
    total_step_count = 0
    total_tokens = 0

    for s in sessions:
        for step in s.get("stepSummaries", []):
            total_step_count += 1
            all_actions.extend(step.get("actionsChosen", []))
            errs = step.get("actionErrors", [])
            if errs:
                error_steps += 1
                all_errors.extend(errs)
            goal = step.get("navigatorGoal", "")
            if goal:
                all_goals.append(goal)
            total_tokens += step.get("inputTokens", 0)

    action_freq = Counter(all_actions).most_common(10)
    error_freq = Counter(all_errors).most_common(10)

    max_steps_pct = outcomes.get("max_steps", 0) / total * 100
    failed_pct = outcomes.get("failed", 0) / total * 100
    cancelled_pct = outcomes.get("cancelled", 0) / total * 100

    navigator_models = Counter(s.get("navigatorModel", "unknown") for s in sessions)
    planner_models = Counter(s.get("plannerModel", "unknown") for s in sessions)

    print("=" * 60)
    print("NANOBROWSER SESSION LOG SUMMARY")
    print("=" * 60)
    print(f"\nTotal sessions analyzed: {total}")
    print(f"  Complete:   {outcomes.get('complete', 0):3d}  ({complete_rate:.0f}%)")
    print(f"  Max steps:  {outcomes.get('max_steps', 0):3d}  ({max_steps_pct:.0f}%)")
    print(f"  Failed:     {outcomes.get('failed', 0):3d}  ({failed_pct:.0f}%)")
    print(f"  Cancelled:  {outcomes.get('cancelled', 0):3d}  ({cancelled_pct:.0f}%)")
    print(f"\nAverage steps per session: {avg_steps:.1f}")
    print(f"Average duration:          {fmt_ms(avg_duration)}")
    print(f"Total tokens (input):      {total_tokens:,}")
    if total_step_count:
        print(f"Steps with action errors:  {error_steps}/{total_step_count} ({error_steps/total_step_count*100:.0f}%)")

    print("\n--- Models ---")
    for model, count in navigator_models.most_common():
        print(f"  navigator: {model} ({count}x)")
    for model, count in planner_models.most_common():
        print(f"  planner:   {model} ({count}x)")

    print("\n--- Top 10 actions chosen ---")
    for action, count in action_freq:
        print(f"  {count:4d}x  {action}")

    if error_freq:
        print("\n--- Top 10 action errors ---")
        for err, count in error_freq:
            short = err[:120].replace("\n", " ")
            print(f"  {count:4d}x  {short}")
    else:
        print("\n--- No action errors recorded ---")

    print("\n--- Sample navigator goals (first 10 sessions) ---")
    for goal in all_goals[:10]:
        print(f"  · {goal[:100]}")

    print("\n--- Recent session tasks ---")
    for s in sorted(sessions, key=lambda x: -x["startedAt"])[:10]:
        outcome_tag = s["outcome"].upper().replace("_", " ")
        print(f"  [{outcome_tag:10s}] {s['task'][:80]}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <sessions.json>", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    if not Path(path).exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)
    sessions = load(path)
    summarize(sessions)
