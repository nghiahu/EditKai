import type {
  ChatMessage,
  LlmProvider,
  LlmResponse,
  ToolDefinition,
} from './types';

export class MockLlmProvider implements LlmProvider {
  private responses: LlmResponse[];
  private index = 0;
  public callHistory: Array<{ messages: ChatMessage[]; tools: ToolDefinition[] }> = [];

  constructor(responses: LlmResponse[] = []) {
    this.responses = [...responses];
  }

  public queueResponse(res: LlmResponse): void {
    this.responses.push(res);
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    this.callHistory.push({ messages, tools });
    if (this.index < this.responses.length) {
      const res = this.responses[this.index];
      this.index++;
      return res;
    }
    return {
      message: {
        role: 'assistant',
        content: 'Mô hình giả lập không còn phản hồi nào trong hàng đợi.',
      },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

export class GeminiLlmProvider implements LlmProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'tool') {
          return {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: m.toolCallId ?? 'unknown',
                  response: { content: m.content },
                },
              },
            ],
          };
        }
        const parts: Record<string, unknown>[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.args,
              },
            });
          }
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

    const systemInstruction = messages.find(m => m.role === 'system')?.content;

    const functionDeclarations = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload: Record<string, unknown> = {
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      ...(functionDeclarations.length > 0
        ? { tools: [{ functionDeclarations }] }
        : {}),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API lỗi (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name: string; args: Record<string, unknown> };
          }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        cachedContentTokenCount?: number;
      };
    };

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    let textContent = '';
    const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.text) textContent += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${part.functionCall.name}_${i}`,
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
        });
      }
    }

    return {
      message: {
        role: 'assistant',
        content: textContent || undefined,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      },
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        cachedTokens: data.usageMetadata?.cachedContentTokenCount,
      },
    };
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    const formattedMessages = messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content ?? '',
          tool_call_id: m.toolCallId,
        };
      }
      return {
        role: m.role,
        content: m.content ?? null,
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args),
                },
              })),
            }
          : {}),
      };
    });

    const openAiTools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        ...(openAiTools.length > 0 ? { tools: openAiTools } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API lỗi (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const choice = data.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls?.map(tc => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }
      return {
        id: tc.id,
        name: tc.function.name,
        args,
      };
    });

    return {
      message: {
        role: 'assistant',
        content: choice?.content || undefined,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      },
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

export function createLlmProvider(options?: {
  provider?: 'gemini' | 'anthropic' | 'openai' | 'mock';
  apiKey?: string;
  model?: string;
  mockResponses?: LlmResponse[];
}): LlmProvider {
  const chosen = options?.provider ?? (
    process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.ANTHROPIC_API_KEY
        ? 'anthropic'
        : process.env.OPENAI_API_KEY
          ? 'openai'
          : 'mock'
  );

  if (chosen === 'mock' || (!options?.apiKey && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY)) {
    return new MockLlmProvider(options?.mockResponses);
  }

  if (chosen === 'gemini') {
    return new GeminiLlmProvider(options?.apiKey ?? process.env.GEMINI_API_KEY!, options?.model);
  }

  if (chosen === 'openai') {
    return new OpenAiLlmProvider(options?.apiKey ?? process.env.OPENAI_API_KEY!, options?.model);
  }

  // fallback to Mock
  return new MockLlmProvider(options?.mockResponses);
}
