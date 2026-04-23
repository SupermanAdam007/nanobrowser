import { sessionLogStore } from '@extension/storage';
import type { SessionLog, SessionOutcome, StepSummary } from '@extension/storage';
import type { AgentStepRecord } from './history';
import { createLogger } from '@src/background/log';

const logger = createLogger('SessionLogger');

export class SessionLogger {
  private readonly log: SessionLog;
  private pendingPlan?: { nextSteps: string; observation: string };

  constructor(id: string, task: string, navigatorModel: string, plannerModel: string) {
    this.log = {
      id,
      task,
      startedAt: Date.now(),
      completedAt: 0,
      outcome: 'failed',
      steps: 0,
      navigatorModel,
      plannerModel,
      stepSummaries: [],
    };
  }

  recordPlan(nextSteps: string, observation: string): void {
    this.pendingPlan = { nextSteps, observation };
  }

  recordStep(record: AgentStepRecord): void {
    let navigatorGoal = '';
    let navigatorMemory = '';
    const actionsChosen: string[] = [];

    if (record.modelOutput) {
      try {
        const parsed = JSON.parse(record.modelOutput) as {
          current_state?: { next_goal?: string; memory?: string };
          action?: unknown[];
        };
        navigatorGoal = parsed?.current_state?.next_goal ?? '';
        navigatorMemory = parsed?.current_state?.memory ?? '';
        if (Array.isArray(parsed?.action)) {
          for (const a of parsed.action) {
            if (a && typeof a === 'object') {
              actionsChosen.push(...Object.keys(a as Record<string, unknown>));
            }
          }
        }
      } catch {
        // unparseable output — skip
      }
    }

    const actionErrors = record.result.filter(r => r.error).map(r => r.error as string);

    const summary: StepSummary = {
      step: record.metadata?.stepNumber ?? this.log.stepSummaries.length,
      url: record.state.url ?? '',
      navigatorGoal,
      navigatorMemory,
      actionsChosen,
      actionErrors,
      durationMs: record.metadata ? Math.round(record.metadata.durationSeconds * 1000) : 0,
      inputTokens: record.metadata?.inputTokens ?? 0,
      plannerNextSteps: this.pendingPlan?.nextSteps,
      plannerObservation: this.pendingPlan?.observation,
    };

    this.log.stepSummaries.push(summary);
    this.pendingPlan = undefined;
  }

  async finalize(outcome: SessionOutcome, steps: number, finalAnswer?: string, errorMessage?: string): Promise<void> {
    this.log.completedAt = Date.now();
    this.log.outcome = outcome;
    this.log.steps = steps;
    if (finalAnswer) this.log.finalAnswer = finalAnswer;
    if (errorMessage) this.log.errorMessage = errorMessage;

    try {
      await sessionLogStore.save(this.log);
      logger.info(`Session logged: ${outcome} (${steps} steps)`);
    } catch (err) {
      logger.error('Failed to save session log', err);
    }
  }
}
