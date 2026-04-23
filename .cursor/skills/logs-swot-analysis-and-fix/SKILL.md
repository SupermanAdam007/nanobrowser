---
name: logs-swot-analysis-and-fix
description: Ingests exported nanobrowser session logs, produces a SWOT analysis of agent behavior, and implements targeted code fixes. Use when the user provides session log JSON, asks to analyze agent logs, wants to improve the extension based on real usage data, mentions session data or debug logs, or asks why the agent fails.
---

# Nanobrowser Logs → SWOT → Fix

Turns exported session logs into concrete code improvements.

## Step 1 — Ingest logs

**Source**: logs are exported from Options → Sessions → Export JSON.  
The file is an array of `SessionLog` objects (see `packages/storage/lib/sessions/types.ts`).

**Run the summarizer first** — it extracts the statistics you need:

```bash
python .cursor/skills/logs-swot-analysis-and-fix/scripts/summarize.py <path-to-sessions.json>
```

Read the output carefully before forming any opinions. If the JSON is small enough, also read it directly.

## Step 2 — SWOT analysis

Produce a structured SWOT using the summary output and raw logs. Fill this template:

```
## SWOT — Nanobrowser Agent Behavior

### Strengths (what already works well)
- e.g., High completion rate (82%), low error rate on click/type actions

### Weaknesses (consistent failure patterns)
- e.g., Fails on multi-tab tasks — scroll_down called 8+ times before giving up
- e.g., Navigator memory resets topic mid-task (poor memory persistence)

### Opportunities (changes likely to improve outcomes)
- e.g., Prompt: add explicit "if lost, go back to search results" heuristic
- e.g., Schema: add a `wait_for_element` action to reduce timing errors
- e.g., Error handling: treat HTTP 429 as retryable, not fatal

### Threats (systemic risks if unaddressed)
- e.g., Max-steps sessions: 40% hit the cap, wasting tokens on circular behavior
- e.g., Auth errors always fatal — no user-friendly message shown
```

Be specific. Attach counts/percentages from the summary wherever possible.

## Step 3 — Prioritize

Rank each SWOT item by **impact × effort**. Pick the top 3–5 items to implement.  
Prefer changes that fix the most common failure modes.

## Step 4 — Implement fixes

Use the mapping below to locate the right files. Make all changes as described — do not stop after analysis.

### Fix mapping

| Finding type | Files to change |
|---|---|
| Navigator behavior / reasoning | `chrome-extension/src/background/agent/agents/navigator.ts` |
| Navigator system prompt | `chrome-extension/src/background/agent/prompts/navigator.ts` |
| Planner behavior / reasoning | `chrome-extension/src/background/agent/agents/planner.ts` |
| Planner system prompt | `chrome-extension/src/background/agent/prompts/planner.ts` |
| Available actions / schemas | `chrome-extension/src/background/agent/actions/schemas.ts` |
| Action execution logic | `chrome-extension/src/background/agent/actions/builder.ts` |
| Error handling / recovery | `chrome-extension/src/background/agent/agents/errors.ts` |
| Memory / message history | `chrome-extension/src/background/agent/messages/service.ts` |
| Session/retry orchestration | `chrome-extension/src/background/agent/executor.ts` |
| Default settings (steps, failures) | `packages/storage/lib/settings/generalSettings.ts` |
| Session logging fields | `packages/storage/lib/sessions/types.ts` + `chrome-extension/src/background/agent/session-logger.ts` |

### Fix patterns

**Prompt improvement**: Read the full current prompt, identify the gap, add a targeted instruction. Keep prompts concise — one focused sentence beats a paragraph.

**New action**: Add Zod schema to `schemas.ts`, implement handler in `builder.ts`, run type-check to confirm.

**Error recovery**: Update detection functions in `errors.ts` to catch new patterns; update retry logic in `executor.ts`.

**Memory fix**: Adjust `cutMessages` or `addModelOutput` in `messages/service.ts`.

**Default tuning**: Update `DEFAULT_GENERAL_SETTINGS` in `generalSettings.ts` for values like `maxSteps`, `planningInterval`.

## Step 5 — Verify

After implementing:

```bash
# Type-check all affected packages
pnpm -F chrome-extension type-check
pnpm -F @extension/storage type-check
pnpm -F options type-check
```

Fix any TypeScript errors before finishing. Then summarize what was changed and why (tied to SWOT findings).

## Step 6 — Log the fix

Append a brief entry to `docs/improvement-log.md` (create if missing):

```markdown
## YYYY-MM-DD — <short title>

**Trigger**: N sessions analyzed, X% completion rate
**Top weaknesses found**: ...
**Changes made**: ...
**Expected improvement**: ...
```

This creates an audit trail for iterative improvement across future sessions.

---

## Key data fields in SessionLog

```typescript
interface StepSummary {
  step: number;
  url: string;
  navigatorGoal: string;    // what the navigator was trying to do
  navigatorMemory: string;  // what it remembered
  actionsChosen: string[];  // action names, e.g. ["click_element", "scroll_down"]
  actionErrors: string[];   // error messages from failed actions
  durationMs: number;
  inputTokens: number;
  plannerNextSteps?: string;   // planner guidance for this step
  plannerObservation?: string; // planner's current assessment
}

interface SessionLog {
  outcome: 'complete' | 'failed' | 'cancelled' | 'max_steps';
  steps: number;
  navigatorModel: string;
  plannerModel: string;
  stepSummaries: StepSummary[];
  finalAnswer?: string;
  errorMessage?: string;
}
```

## Common failure signatures

| Pattern | Likely cause | Fix target |
|---|---|---|
| `scroll_down` repeated 5+ times | No "give up" heuristic | Navigator prompt |
| `actionErrors` full of "element not found" | Stale element indices | Timing in builder.ts |
| All sessions hit `max_steps` | Planning interval too long, or navigator loops | `planningInterval`, planner prompt |
| Outcome `failed` with auth error | Provider key expired or wrong | `errors.ts` user message |
| `navigatorMemory` resets between steps | Memory cutoff too aggressive | `service.ts` cutMessages |
| Same URL appears 3+ consecutive steps | Navigator stuck | Navigator prompt: detect loops |
