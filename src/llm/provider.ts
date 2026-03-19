export interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

export interface LLMResponse {
  text: string;
  toolUses: ToolUse[];
}

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMProvider {
  chat(
    systemPrompt: string,
    messages: Message[],
    tools: Tool[]
  ): Promise<LLMResponse>;
}
