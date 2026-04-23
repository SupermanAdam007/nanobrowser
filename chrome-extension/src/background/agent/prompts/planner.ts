/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePrompt } from './base';
import type { SystemModelMessage, UserModelMessage } from 'ai';
import type { AgentContext } from '@src/background/agent/types';
import { plannerSystemPromptTemplate } from './templates/planner';

export class PlannerPrompt extends BasePrompt {
  getSystemMessage(): SystemModelMessage {
    return { role: 'system', content: plannerSystemPromptTemplate };
  }

  async getUserMessage(_context: AgentContext): Promise<UserModelMessage> {
    return { role: 'user', content: '' };
  }
}
