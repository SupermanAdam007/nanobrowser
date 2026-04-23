import type { z } from 'zod';
import type { ModelMessage } from 'ai';
import { generateObject } from 'ai';
import type { AgentContext, AgentOutput } from '../types';
import type { BasePrompt } from '../prompts/base';
import { createLogger } from '@src/background/log';
import type { Action } from '../actions/builder';
import type { AgentLLM } from '../providers';
import { isAbortedError } from './errors';

const logger = createLogger('agent');

export interface BaseAgentOptions {
  llm: AgentLLM;
  context: AgentContext;
  prompt: BasePrompt;
}

export interface ExtraAgentOptions {
  id?: string;
}

export abstract class BaseAgent<T extends z.ZodType, M = unknown> {
  protected id: string;
  protected llm: AgentLLM;
  protected prompt: BasePrompt;
  protected context: AgentContext;
  protected actions: Record<string, Action> = {};
  protected modelOutputSchema: T;
  declare ModelOutput: z.infer<T>;

  constructor(modelOutputSchema: T, options: BaseAgentOptions, extraOptions?: Partial<ExtraAgentOptions>) {
    this.modelOutputSchema = modelOutputSchema;
    this.llm = options.llm;
    this.prompt = options.prompt;
    this.context = options.context;
    this.id = extraOptions?.id ?? 'agent';
  }

  get modelId(): string {
    const model = this.llm.model;
    if (typeof model === 'string') return model;
    if (model && typeof model === 'object' && 'modelId' in model) {
      return (model as { modelId: string }).modelId;
    }
    return 'unknown';
  }

  async invoke(inputMessages: ModelMessage[]): Promise<this['ModelOutput']> {
    logger.debug(`[${this.modelId}] Invoking generateObject`, { messageCount: inputMessages.length });

    try {
      const { object } = await generateObject({
        model: this.llm.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        schema: this.modelOutputSchema as any,
        output: 'object',
        messages: inputMessages,
        abortSignal: this.context.controller.signal,
        maxOutputTokens: this.llm.settings.maxOutputTokens,
        temperature: this.llm.settings.temperature,
        topP: this.llm.settings.topP,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        providerOptions: this.llm.settings.providerOptions as any,
      });

      logger.debug(`[${this.modelId}] generateObject succeeded`);
      return object;
    } catch (error) {
      if (isAbortedError(error)) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.modelId}] generateObject failed: ${msg}`);
      throw new Error(`Failed to invoke ${this.modelId}: ${msg}`);
    }
  }

  abstract execute(): Promise<AgentOutput<M>>;
}
