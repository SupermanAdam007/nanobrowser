import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createGroq } from '@ai-sdk/groq';
import { createAzure } from '@ai-sdk/azure';
import type { LanguageModel } from 'ai';
import { type ProviderConfig, type ModelConfig, ProviderTypeEnum } from '@extension/storage';

const LLAMA_BASE_URL = 'https://api.llama.com/v1';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const CEREBRAS_BASE_URL = 'https://api.cerebras.ai/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Compatible with ai-sdk's ProviderOptions = Record<string, JSONObject>
type AgentProviderOptions = Record<string, Record<string, string | number | boolean | null>>;

export interface AgentLLMSettings {
  maxOutputTokens: number;
  temperature?: number;
  topP?: number;
  providerOptions?: AgentProviderOptions;
}

export interface AgentLLM {
  model: LanguageModel;
  settings: AgentLLMSettings;
}

function isOpenAIReasoningModel(modelName: string): boolean {
  const name = modelName.includes('/') ? (modelName.split('/').pop() ?? modelName) : modelName;
  return name.startsWith('o1') || name.startsWith('o3') || name.startsWith('o4');
}

function openAIReasoningSettings(modelConfig: ModelConfig): AgentLLMSettings {
  const effort = modelConfig.reasoningEffort;
  return {
    maxOutputTokens: 16384,
    ...(effort ? { providerOptions: { openai: { reasoningEffort: effort } } } : {}),
  };
}

function standardSettings(temperature: number, topP: number): AgentLLMSettings {
  return { maxOutputTokens: 4096, temperature, topP };
}

export function createModel(providerConfig: ProviderConfig, modelConfig: ModelConfig): AgentLLM {
  const temperature = (modelConfig.parameters?.temperature as number) ?? 0.1;
  const topP = (modelConfig.parameters?.topP as number) ?? 0.9;
  const modelName = modelConfig.modelName;
  const isReasoning = isOpenAIReasoningModel(modelName);

  switch (modelConfig.provider as ProviderTypeEnum) {
    case ProviderTypeEnum.OpenAI:
      return {
        model: createOpenAI({ apiKey: providerConfig.apiKey })(modelName),
        settings: isReasoning ? openAIReasoningSettings(modelConfig) : standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.AzureOpenAI: {
      const baseUrl = providerConfig.baseUrl ?? '';
      let resourceName: string | undefined;
      try {
        resourceName = new URL(baseUrl).hostname.split('.')[0];
      } catch {
        // ignore malformed URL; createAzure will use baseURL as fallback
      }
      const effort = modelConfig.reasoningEffort;
      const azureSettings: AgentLLMSettings = isReasoning
        ? {
            maxOutputTokens: 16384,
            ...(effort ? { providerOptions: { azure: { reasoningEffort: effort } } } : {}),
          }
        : standardSettings(temperature, topP);
      return {
        model: createAzure({
          resourceName,
          apiKey: providerConfig.apiKey,
          apiVersion: providerConfig.azureApiVersion,
        })(modelName),
        settings: azureSettings,
      };
    }

    case ProviderTypeEnum.Anthropic:
      return {
        model: createAnthropic({ apiKey: providerConfig.apiKey })(modelName),
        settings: { maxOutputTokens: 4096, temperature: Math.min(temperature, 1), topP },
      };

    case ProviderTypeEnum.Gemini:
      return {
        model: createGoogleGenerativeAI({ apiKey: providerConfig.apiKey })(modelName),
        settings: standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.Grok:
      return {
        model: createXai({ apiKey: providerConfig.apiKey })(modelName),
        settings: standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.Groq:
      return {
        model: createGroq({ apiKey: providerConfig.apiKey })(modelName),
        settings: standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.Ollama: {
      const baseURL = `${(providerConfig.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '')}/v1`;
      return {
        model: createOpenAI({ apiKey: 'ollama', baseURL })(modelName),
        settings: standardSettings(temperature, topP),
      };
    }

    case ProviderTypeEnum.OpenRouter:
      return {
        model: createOpenAI({
          apiKey: providerConfig.apiKey,
          baseURL: OPENROUTER_BASE_URL,
          headers: { 'HTTP-Referer': 'https://nanobrowser.ai', 'X-Title': 'Nanobrowser' },
        })(modelName),
        settings: isReasoning ? openAIReasoningSettings(modelConfig) : standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.DeepSeek:
      return {
        model: createOpenAI({ apiKey: providerConfig.apiKey, baseURL: DEEPSEEK_BASE_URL })(modelName),
        settings: standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.Cerebras:
      return {
        model: createOpenAI({ apiKey: providerConfig.apiKey, baseURL: CEREBRAS_BASE_URL })(modelName),
        settings: standardSettings(temperature, topP),
      };

    case ProviderTypeEnum.Llama:
      return {
        model: createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl ?? LLAMA_BASE_URL })(
          modelName,
        ),
        settings: standardSettings(temperature, topP),
      };

    default:
      // CustomOpenAI and any other OpenAI-compatible provider
      return {
        model: createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })(modelName),
        settings: isReasoning ? openAIReasoningSettings(modelConfig) : standardSettings(temperature, topP),
      };
  }
}
