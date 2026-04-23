import type { SystemModelMessage, UserModelMessage } from 'ai';
import type { AgentContext } from '@src/background/agent/types';
import { wrapUntrustedContent } from '../messages/utils';
import { createLogger } from '@src/background/log';

const logger = createLogger('BasePrompt');

abstract class BasePrompt {
  abstract getSystemMessage(): SystemModelMessage;
  abstract getUserMessage(context: AgentContext): Promise<UserModelMessage>;

  async buildBrowserStateUserMessage(context: AgentContext): Promise<UserModelMessage> {
    const browserState = await context.browserContext.getState(context.options.useVision);
    const rawElementsText = browserState.elementTree.clickableElementsToString(context.options.includeAttributes);

    let formattedElementsText = '';
    if (rawElementsText !== '') {
      const scrollInfo = `[Scroll info of current page] window.scrollY: ${browserState.scrollY}, document.body.scrollHeight: ${browserState.scrollHeight}, window.visualViewport.height: ${browserState.visualViewportHeight}, visual viewport height as percentage of scrollable distance: ${Math.round((browserState.visualViewportHeight / (browserState.scrollHeight - browserState.visualViewportHeight)) * 100)}%\n`;
      logger.info(scrollInfo);
      const elementsText = wrapUntrustedContent(rawElementsText);
      formattedElementsText = `${scrollInfo}[Start of page]\n${elementsText}\n[End of page]\n`;
    } else {
      formattedElementsText = 'empty page';
    }

    let stepInfoDescription = '';
    if (context.stepInfo) {
      stepInfoDescription = `Current step: ${context.stepInfo.stepNumber + 1}/${context.stepInfo.maxSteps}`;
    }

    const timeStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    stepInfoDescription += `Current date and time: ${timeStr}`;

    let actionResultsDescription = '';
    if (context.actionResults.length > 0) {
      for (let i = 0; i < context.actionResults.length; i++) {
        const result = context.actionResults[i];
        if (result.extractedContent) {
          actionResultsDescription += `\nAction result ${i + 1}/${context.actionResults.length}: ${result.extractedContent}`;
        }
        if (result.error) {
          const error = result.error.split('\n').pop();
          actionResultsDescription += `\nAction error ${i + 1}/${context.actionResults.length}: ...${error}`;
        }
      }
    }

    const currentTab = `{id: ${browserState.tabId}, url: ${browserState.url}, title: ${browserState.title}}`;
    const otherTabs = browserState.tabs
      .filter(tab => tab.id !== browserState.tabId)
      .map(tab => `- {id: ${tab.id}, url: ${tab.url}, title: ${tab.title}}`);
    const stateDescription = `
[Task history memory ends]
[Current state starts here]
The following is one-time information - if you need to remember it write it to memory:
Current tab: ${currentTab}
Other available tabs:
  ${otherTabs.join('\n')}
Interactive elements from top layer of the current page inside the viewport:
${formattedElementsText}
${stepInfoDescription}
${actionResultsDescription}
`;

    if (browserState.screenshot && context.options.useVision) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: stateDescription },
          { type: 'image', image: browserState.screenshot, mediaType: 'image/jpeg' },
        ],
      };
    }

    return { role: 'user', content: stateDescription };
  }
}

export { BasePrompt };
