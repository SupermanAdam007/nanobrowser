import type { ModelMessage, SystemModelMessage, UserModelMessage, AssistantModelMessage } from 'ai';
import { MessageHistory, MessageMetadata } from '@src/background/agent/messages/views';
import { createLogger } from '@src/background/log';
import {
  filterExternalContent,
  wrapUserRequest,
  splitUserTextAndAttachments,
  wrapAttachments,
} from '@src/background/agent/messages/utils';

const logger = createLogger('MessageManager');

export class MessageManagerSettings {
  maxInputTokens = 128000;
  estimatedCharactersPerToken = 3;
  imageTokens = 800;
  includeAttributes: string[] = [];
  messageContext?: string;
  sensitiveData?: Record<string, string>;
  availableFilePaths?: string[];

  constructor(
    options: {
      maxInputTokens?: number;
      estimatedCharactersPerToken?: number;
      imageTokens?: number;
      includeAttributes?: string[];
      messageContext?: string;
      sensitiveData?: Record<string, string>;
      availableFilePaths?: string[];
    } = {},
  ) {
    if (options.maxInputTokens !== undefined) this.maxInputTokens = options.maxInputTokens;
    if (options.estimatedCharactersPerToken !== undefined)
      this.estimatedCharactersPerToken = options.estimatedCharactersPerToken;
    if (options.imageTokens !== undefined) this.imageTokens = options.imageTokens;
    if (options.includeAttributes !== undefined) this.includeAttributes = options.includeAttributes;
    if (options.messageContext !== undefined) this.messageContext = options.messageContext;
    if (options.sensitiveData !== undefined) this.sensitiveData = options.sensitiveData;
    if (options.availableFilePaths !== undefined) this.availableFilePaths = options.availableFilePaths;
  }
}

export default class MessageManager {
  private history: MessageHistory;
  private settings: MessageManagerSettings;

  constructor(settings: MessageManagerSettings = new MessageManagerSettings()) {
    this.settings = settings;
    this.history = new MessageHistory();
  }

  public initTaskMessages(systemMessage: SystemModelMessage, task: string, messageContext?: string): void {
    this.addMessageWithTokens(systemMessage, 'init');

    if (messageContext && messageContext.length > 0) {
      const contextMessage: UserModelMessage = {
        role: 'user',
        content: `Context for the task: ${messageContext}`,
      };
      this.addMessageWithTokens(contextMessage, 'init');
    }

    const taskMessage = MessageManager.taskInstructions(task);
    this.addMessageWithTokens(taskMessage, 'init');

    if (this.settings.sensitiveData) {
      const info = `Here are placeholders for sensitive data: ${Object.keys(this.settings.sensitiveData)}`;
      const infoMessage: UserModelMessage = {
        role: 'user',
        content: `${info}\nTo use them, write <secret>the placeholder name</secret>`,
      };
      this.addMessageWithTokens(infoMessage, 'init');
    }

    // Example output to demonstrate expected JSON format
    const placeholderMessage: UserModelMessage = { role: 'user', content: 'Example output:' };
    this.addMessageWithTokens(placeholderMessage, 'init');

    const exampleOutput = {
      current_state: {
        evaluation_previous_goal:
          `Success - I successfully clicked on the 'Apple' link from the Google Search results page, ` +
          `which directed me to the 'Apple' company homepage. This is a good start toward finding ` +
          `the best place to buy a new iPhone as the Apple website often list iPhones for sale.`,
        memory:
          `I searched for 'iPhone retailers' on Google. From the Google Search results page, ` +
          `I used the 'click_element' tool to click on a element labelled 'Best Buy' but calling ` +
          `the tool did not direct me to a new page. I then used the 'click_element' tool to click ` +
          `on a element labelled 'Apple' which redirected me to the 'Apple' company homepage. ` +
          `Currently at step 3/15.`,
        next_goal:
          `Looking at reported structure of the current page, I can see the item '[127]<h3 iPhone/>' ` +
          `in the content. I think this button will lead to more information and potentially prices ` +
          `for iPhones. I'll click on the link to 'iPhone' at index [127] using the 'click_element' ` +
          `tool and hope to see prices on the next page.`,
      },
      action: [{ click_element: { index: 127 } }],
    };
    const exampleAssistantMsg: AssistantModelMessage = {
      role: 'assistant',
      content: JSON.stringify(exampleOutput),
    };
    this.addMessageWithTokens(exampleAssistantMsg, 'init');

    const historyStartMessage: UserModelMessage = {
      role: 'user',
      content: '[Your task history memory starts here]',
    };
    this.addMessageWithTokens(historyStartMessage);

    if (this.settings.availableFilePaths && this.settings.availableFilePaths.length > 0) {
      const filepathsMsg: UserModelMessage = {
        role: 'user',
        content: `Here are file paths you can use: ${this.settings.availableFilePaths}`,
      };
      this.addMessageWithTokens(filepathsMsg, 'init');
    }
  }

  private static taskInstructions(task: string): UserModelMessage {
    const { userText, attachmentsInner } = splitUserTextAndAttachments(task);

    const cleanedTask = filterExternalContent(userText);
    const content = `Your ultimate task is: """${cleanedTask}""". If you achieved your ultimate task, stop everything and use the done action in the next step to complete the task. If not, continue as usual.`;
    const wrappedUser = wrapUserRequest(content, false);

    if (attachmentsInner && attachmentsInner.length > 0) {
      const wrappedFiles = wrapAttachments(attachmentsInner);
      return { role: 'user', content: `${wrappedUser}\n\n${wrappedFiles}` };
    }

    return { role: 'user', content: wrappedUser };
  }

  public length(): number {
    return this.history.messages.length;
  }

  public addNewTask(newTask: string): void {
    const { userText, attachmentsInner } = splitUserTextAndAttachments(newTask);

    const cleanedTask = filterExternalContent(userText);
    const content = `Your new ultimate task is: """${cleanedTask}""". This is a follow-up of the previous tasks. Make sure to take all of the previous context into account and finish your new ultimate task.`;
    const wrappedUser = wrapUserRequest(content, false);

    let finalContent = wrappedUser;
    if (attachmentsInner && attachmentsInner.length > 0) {
      const wrappedFiles = wrapAttachments(attachmentsInner);
      finalContent = `${wrappedUser}\n\n${wrappedFiles}`;
    }

    const msg: UserModelMessage = { role: 'user', content: finalContent };
    this.addMessageWithTokens(msg);
  }

  public addPlan(plan?: string, position?: number): void {
    if (plan) {
      const cleanedPlan = filterExternalContent(plan, false);
      const msg: AssistantModelMessage = { role: 'assistant', content: `<plan>${cleanedPlan}</plan>` };
      this.addMessageWithTokens(msg, null, position);
    }
  }

  public addStateMessage(stateMessage: UserModelMessage): void {
    this.addMessageWithTokens(stateMessage);
  }

  public addModelOutput(modelOutput: Record<string, unknown>): void {
    const msg: AssistantModelMessage = {
      role: 'assistant',
      content: JSON.stringify(modelOutput),
    };
    this.addMessageWithTokens(msg);
  }

  public removeLastStateMessage(): void {
    this.history.removeLastStateMessage();
  }

  public getMessages(): ModelMessage[] {
    const messages = this.history.messages
      .filter(m => {
        if (!m.message) {
          console.error(`[MessageManager] Filtering out message with undefined message property:`, m);
          return false;
        }
        return true;
      })
      .map(m => m.message);

    let totalInputTokens = 0;
    logger.debug(`Messages in history: ${this.history.messages.length}:`);

    for (const m of this.history.messages) {
      totalInputTokens += m.metadata.tokens;
      if (m.message) {
        logger.debug(`${m.message.role} - Token count: ${m.metadata.tokens}`);
      }
    }

    logger.debug(`Total input tokens: ${totalInputTokens}`);
    return messages;
  }

  public addMessageWithTokens(message: ModelMessage, messageType?: string | null, position?: number): void {
    let filteredMessage = message;
    if (this.settings.sensitiveData) {
      filteredMessage = this._filterSensitiveData(message);
    }

    const tokenCount = this._countTokens(filteredMessage);
    const metadata: MessageMetadata = new MessageMetadata(tokenCount, messageType);
    this.history.addMessage(filteredMessage, metadata, position);
  }

  private _filterSensitiveData(message: ModelMessage): ModelMessage {
    const replaceSensitive = (value: string): string => {
      let filteredValue = value;
      if (!this.settings.sensitiveData) return filteredValue;

      for (const [key, val] of Object.entries(this.settings.sensitiveData)) {
        if (!val) continue;
        filteredValue = filteredValue.replace(val, `<secret>${key}</secret>`);
      }
      return filteredValue;
    };

    if (typeof message.content === 'string') {
      return { ...message, content: replaceSensitive(message.content) } as ModelMessage;
    }

    if (Array.isArray(message.content)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredContent = (message.content as any[]).map((item: Record<string, unknown>) => {
        if (typeof item === 'object' && item !== null && 'text' in item && typeof item.text === 'string') {
          return { ...item, text: replaceSensitive(item.text) };
        }
        return item;
      });
      return { ...message, content: filteredContent } as ModelMessage;
    }

    return message;
  }

  private _countTokens(message: ModelMessage): number {
    if (typeof message.content === 'string') {
      return this._countTextTokens(message.content);
    }

    if (Array.isArray(message.content)) {
      let tokens = 0;
      for (const item of message.content as Record<string, unknown>[]) {
        if (item.type === 'image') {
          tokens += this.settings.imageTokens;
        } else if (item.type === 'text' && typeof item.text === 'string') {
          tokens += this._countTextTokens(item.text);
        } else if (item.type === 'tool-call' || item.type === 'tool-result') {
          tokens += this._countTextTokens(JSON.stringify(item));
        }
      }
      return tokens;
    }

    return 0;
  }

  private _countTextTokens(text: string): number {
    return Math.floor(text.length / this.settings.estimatedCharactersPerToken);
  }

  public cutMessages(): void {
    let diff = this.history.totalTokens - this.settings.maxInputTokens;
    if (diff <= 0) return;

    const lastMsg = this.history.messages[this.history.messages.length - 1];

    // Remove image from last message if it has image content
    if (Array.isArray(lastMsg.message.content)) {
      let text = '';
      const filteredContent = (lastMsg.message.content as Record<string, unknown>[]).filter(item => {
        if (item.type === 'image') {
          diff -= this.settings.imageTokens;
          lastMsg.metadata.tokens -= this.settings.imageTokens;
          this.history.totalTokens -= this.settings.imageTokens;
          logger.debug(
            `Removed image with ${this.settings.imageTokens} tokens - total tokens now: ${this.history.totalTokens}/${this.settings.maxInputTokens}`,
          );
          return false;
        }
        if (item.type === 'text' && typeof item.text === 'string') {
          text += item.text;
        }
        return true;
      });
      // Collapse to plain string if only text remains
      (lastMsg.message as { content: unknown }).content =
        filteredContent.length === 1 && filteredContent[0].type === 'text' ? text : filteredContent;
      this.history.messages[this.history.messages.length - 1] = lastMsg;
    }

    if (diff <= 0) return;

    const proportionToRemove = diff / lastMsg.metadata.tokens;
    if (proportionToRemove > 0.99) {
      throw new Error(
        `Max token limit reached - history is too long - reduce the system prompt or task. proportion_to_remove: ${proportionToRemove}`,
      );
    }
    logger.debug(
      `Removing ${(proportionToRemove * 100).toFixed(2)}% of the last message (${(proportionToRemove * lastMsg.metadata.tokens).toFixed(2)} / ${lastMsg.metadata.tokens.toFixed(2)} tokens)`,
    );

    const content = lastMsg.message.content as string;
    const charactersToRemove = Math.floor(content.length * proportionToRemove);
    const newContent = content.slice(0, -charactersToRemove);

    this.history.removeLastStateMessage();

    const msg: UserModelMessage = { role: 'user', content: newContent };
    this.addMessageWithTokens(msg);

    const finalMsg = this.history.messages[this.history.messages.length - 1];
    logger.debug(
      `Added message with ${finalMsg.metadata.tokens} tokens - total tokens now: ${this.history.totalTokens}/${this.settings.maxInputTokens} - total messages: ${this.history.messages.length}`,
    );
  }
}
