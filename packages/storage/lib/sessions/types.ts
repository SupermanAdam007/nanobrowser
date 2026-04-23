export type SessionOutcome = 'complete' | 'failed' | 'cancelled' | 'max_steps';

export interface StepSummary {
  step: number;
  url: string;
  navigatorGoal: string;
  navigatorMemory: string;
  actionsChosen: string[];
  actionErrors: string[];
  durationMs: number;
  inputTokens: number;
  plannerNextSteps?: string;
  plannerObservation?: string;
  /** Raw JSON string returned by the navigator LLM — useful for prompt debugging */
  rawNavigatorOutput?: string;
  /** Raw JSON string returned by the planner LLM for this planning step */
  rawPlannerOutput?: string;
}

export interface SessionLog {
  id: string;
  task: string;
  startedAt: number;
  completedAt: number;
  outcome: SessionOutcome;
  steps: number;
  navigatorModel: string;
  plannerModel: string;
  stepSummaries: StepSummary[];
  finalAnswer?: string;
  errorMessage?: string;
}
