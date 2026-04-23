import type { ModelMessage } from 'ai';

export class MessageMetadata {
  tokens: number;
  message_type: string | null = null;

  constructor(tokens: number, message_type?: string | null) {
    this.tokens = tokens;
    this.message_type = message_type ?? null;
  }
}

export class ManagedMessage {
  message: ModelMessage;
  metadata: MessageMetadata;

  constructor(message: ModelMessage, metadata: MessageMetadata) {
    this.message = message;
    this.metadata = metadata;
  }
}

export class MessageHistory {
  messages: ManagedMessage[] = [];
  totalTokens = 0;

  addMessage(message: ModelMessage, metadata: MessageMetadata, position?: number): void {
    const managedMessage: ManagedMessage = { message, metadata };

    if (position === undefined) {
      this.messages.push(managedMessage);
    } else {
      this.messages.splice(position, 0, managedMessage);
    }
    this.totalTokens += metadata.tokens;
  }

  removeMessage(index = -1): void {
    if (this.messages.length > 0) {
      const msg = this.messages.splice(index, 1)[0];
      this.totalTokens -= msg.metadata.tokens;
    }
  }

  removeLastStateMessage(): void {
    if (this.messages.length > 2 && this.messages[this.messages.length - 1].message.role === 'user') {
      const msg = this.messages.pop();
      if (msg) {
        this.totalTokens -= msg.metadata.tokens;
      }
    }
  }

  getMessages(): ModelMessage[] {
    return this.messages.map(m => m.message);
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }

  removeOldestMessage(): void {
    for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].message.role !== 'system') {
        const msg = this.messages.splice(i, 1)[0];
        this.totalTokens -= msg.metadata.tokens;
        break;
      }
    }
  }
}
