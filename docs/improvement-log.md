# Nanobrowser Improvement Log

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
