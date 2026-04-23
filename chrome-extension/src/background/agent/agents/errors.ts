import { APICallError } from 'ai';

export const LLM_FORBIDDEN_ERROR_MESSAGE =
  'Access denied (403 Forbidden). Please check:\n\n1. Your API key has the required permissions\n\n2. For Ollama: Set OLLAMA_ORIGINS=chrome-extension://* \nsee https://github.com/ollama/ollama/blob/main/docs/faq.md';

export const EXTENSION_CONFLICT_ERROR_MESSAGE =
  'Cannot access a chrome-extension:// URL of different extension. This is likely due to conflicting extensions. Please use Nanobrowser in a new profile.';

export class ChatModelAuthError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatModelAuthError';
  }
}

export class ChatModelForbiddenError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatModelForbiddenError';
  }
}

export class ChatModelBadRequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChatModelBadRequestError';
  }
}

export class RequestCancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestCancelledError';
  }
}

export class ExtensionConflictError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExtensionConflictError';
  }
}

export class MaxStepsReachedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MaxStepsReachedError';
  }
}

export class MaxFailuresReachedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MaxFailuresReachedError';
  }
}

export class ResponseParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ResponseParseError';
  }
}

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 401;
  if (!(error instanceof Error)) return false;
  const name = error.constructor?.name !== 'Error' ? error.constructor.name : error.name;
  return (
    name === 'AuthenticationError' ||
    error.message.toLowerCase().includes('authentication') ||
    error.message.includes(' 401') ||
    error.message.toLowerCase().includes('api key')
  );
}

export function isForbiddenError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 403;
  return error instanceof Error && error.message.includes(' 403') && error.message.includes('Forbidden');
}

export function isBadRequestError(error: unknown): boolean {
  if (error instanceof APICallError) return error.statusCode === 400;
  if (!(error instanceof Error)) return false;
  const name = error.constructor?.name !== 'Error' ? error.constructor.name : error.name;
  return (
    name === 'BadRequestError' ||
    error.message.includes(' 400') ||
    error.message.toLowerCase().includes('badrequest') ||
    error.message.includes('Invalid parameter') ||
    (error.message.includes('response_format') &&
      error.message.includes('json_schema') &&
      error.message.includes('not supported'))
  );
}

export function isAbortedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.message.includes('Aborted');
}

export function isExtensionConflictError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return msg.includes('cannot access a chrome-extension') && msg.includes('of different extension');
}
