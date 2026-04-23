import { createLogger } from '@src/background/log';
import { HistoryTreeProcessor } from '@src/background/browser/dom/history/service';
import type { BrowserState } from '@src/background/browser/views';
import type { DOMHistoryElement } from '@src/background/browser/dom/history/view';
import type { AgentStepRecord } from '../history';
import type { NavigatorActionRegistry } from './navigator';

const logger = createLogger('NavigatorReplay');

export interface ParsedModelOutput {
  current_state?: { next_goal?: string };
  action?: (Record<string, unknown> | null)[] | null;
}

export interface ParsedHistoryStep {
  parsedOutput: ParsedModelOutput;
  goal: string;
  actionsToReplay: (Record<string, unknown> | null)[];
}

/**
 * Parse and validate a history step's model output. Throws if the step has no
 * valid actions to replay.
 */
export function parseHistoryModelOutput(historyItem: AgentStepRecord): ParsedHistoryStep {
  if (!historyItem.modelOutput) {
    throw new Error('No model output found in history item');
  }

  let parsedOutput: ParsedModelOutput;
  try {
    parsedOutput = JSON.parse(historyItem.modelOutput) as ParsedModelOutput;
  } catch (error) {
    throw new Error(`Could not parse modelOutput: ${error}`);
  }

  const goal = parsedOutput?.current_state?.next_goal ?? '';
  const actionsToReplay = parsedOutput?.action;

  if (
    !actionsToReplay ||
    (Array.isArray(actionsToReplay) && actionsToReplay.length === 0) ||
    (Array.isArray(actionsToReplay) && actionsToReplay.length === 1 && actionsToReplay[0] === null)
  ) {
    throw new Error('No action to replay');
  }

  return { parsedOutput, goal, actionsToReplay };
}

/**
 * Map a historical element's index to its current position in the DOM tree.
 * Returns null if the element can no longer be found.
 */
export async function updateActionIndices(
  historicalElement: DOMHistoryElement,
  action: Record<string, unknown>,
  currentState: BrowserState,
  actionRegistry: NavigatorActionRegistry,
): Promise<Record<string, unknown> | null> {
  if (!historicalElement || !currentState.elementTree) {
    return action;
  }

  const currentElement = await HistoryTreeProcessor.findHistoryElementInTree(
    historicalElement,
    currentState.elementTree,
  );

  if (!currentElement || currentElement.highlightIndex === null) {
    return null;
  }

  const actionName = Object.keys(action)[0];
  const actionArgs = action[actionName] as Record<string, unknown>;
  const actionInstance = actionRegistry.getAction(actionName);
  if (!actionInstance) return action;

  const oldIndex = actionInstance.getIndexArg(actionArgs);
  if (oldIndex !== null && oldIndex !== currentElement.highlightIndex) {
    const updatedAction: Record<string, unknown> = { [actionName]: { ...actionArgs } };
    actionInstance.setIndexArg(updatedAction[actionName] as Record<string, unknown>, currentElement.highlightIndex);
    logger.info(`Element moved in DOM, updated index from ${oldIndex} to ${currentElement.highlightIndex}`);
    return updatedAction;
  }

  return action;
}
