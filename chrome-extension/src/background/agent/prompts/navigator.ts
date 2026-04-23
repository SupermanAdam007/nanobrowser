/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePrompt } from './base';
import type { SystemModelMessage, UserModelMessage } from 'ai';
import type { AgentContext } from '@src/background/agent/types';
import { createLogger } from '@src/background/log';
import { navigatorSystemPromptTemplate } from './templates/navigator';

const logger = createLogger('agent/prompts/navigator');

export class NavigatorPrompt extends BasePrompt {
  private systemMessage: SystemModelMessage;

  constructor(private readonly maxActionsPerStep = 10) {
    super();
    const formattedPrompt = navigatorSystemPromptTemplate
      .replace('{{max_actions}}', this.maxActionsPerStep.toString())
      .trim();
    this.systemMessage = { role: 'system', content: formattedPrompt };
  }

  getSystemMessage(): SystemModelMessage {
    return this.systemMessage;
  }

  async getUserMessage(context: AgentContext): Promise<UserModelMessage> {
    return await this.buildBrowserStateUserMessage(context);
  }
}
