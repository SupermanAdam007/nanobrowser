# Nanobrowser Improvement Log

---

## 2026-04-23 — Fix missing step timing and token counts in session logs

**Trigger**: 2 sessions analyzed, 50% completion rate; successful session had correct behavior but all `durationMs=0` and `inputTokens=0`

**Top weaknesses found**:
- `AgentStepRecord` constructed without `StepMetadata` — timing and token data silently dropped
- `generateObject` `usage` field was discarded in `invoke()` — input token count never captured

**Changes made**:
- `base.ts`: extract `usage.inputTokens` from `generateObject` response; store as `this.lastInputTokens` on the agent
- `navigator.ts`: record `stepStartTime = Date.now() / 1000` at execute() entry; create `StepMetadata(startTime, endTime, lastInputTokens, nSteps)` in the finally block; pass to `AgentStepRecord`

**Expected improvement**: future session exports will include accurate per-step duration and input token counts, enabling cost tracking and latency analysis via the SWOT skill.

---

## 2026-04-23 — Fix OpenAI-compatible provider API mismatch

**Trigger**: 1 session analyzed, 0% completion rate (immediate failure)

**Top weaknesses found**:
- 100% failure rate on OpenRouter (and all other OpenAI-compatible providers)
- Error "Invalid Responses API request" fired client-side before network contact
- Root cause: `@ai-sdk/openai` v3 changed `createOpenAI()(modelName)` to default to the Responses API (`/v1/responses`) instead of Chat Completions API (`/v1/chat/completions`)

**Changes made**:
- `providers.ts`: switched all `createOpenAI(opts)(modelName)` calls to `createOpenAI(opts).chat(modelName)` for OpenAI, OpenRouter, Ollama, DeepSeek, Cerebras, Llama, and CustomOpenAI providers
- `packages/storage/lib/sessions/types.ts`: added `rawNavigatorOutput` and `rawPlannerOutput` fields to `StepSummary`
- `session-logger.ts`: populates the new raw output fields from `AgentStepRecord.modelOutput` and planner result JSON
- `executor.ts`: passes full planner result JSON to `sessionLogger.recordPlan()`

**Expected improvement**: All OpenRouter sessions (and any other OpenAI-compatible provider) will now successfully reach the API instead of failing instantly. Session exports will now include full LLM responses for prompt debugging.
