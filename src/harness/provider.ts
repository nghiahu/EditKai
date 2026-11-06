import type {
  ChatMessage,
  LlmProvider,
  LlmResponse,
  ToolDefinition,
} from './types';

function tryLoadEnv(): void {
  try {
    if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
      (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
    }
  } catch {
    // Non-fatal if .env doesn't exist
  }
}

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

  private simulateDynamicTurn(messages: ChatMessage[], tools: ToolDefinition[]): LlmResponse {
    // Nếu ở lượt cuối hoặc công cụ bị tắt, ép trả lời bằng text
    if (!tools || tools.length === 0) {
      return {
        message: {
          role: 'assistant',
          content: 'Dựa trên các thông tin đã thu thập từ các lượt trước, kế hoạch dựng hiện tại đã được đồng bộ và sẵn sàng để áp dụng hoặc xuất video.',
        },
        usage: { inputTokens: 250, outputTokens: 45 },
      };
    }

    const lastMessage = messages[messages.length - 1];
    const lastUser =
      [...messages]
        .reverse()
        .find(m => m.role === 'user' && !m.content?.startsWith('[HỆ THỐNG]'))
        ?.content?.toLowerCase() ?? '';

    // Nếu vừa nhận kết quả từ tool call ở lượt trước
    if (lastMessage.role === 'tool') {
      if (
        lastMessage.toolCallId?.includes('get_plan_summary') ||
        lastUser.includes('tóm tắt') ||
        lastUser.includes('xem')
      ) {
        let count = 5;
        let style = 's1';
        try {
          const d = JSON.parse(lastMessage.content ?? '{}');
          if (Array.isArray(d.layers)) count = d.layers.length;
          if (d.meta?.style) style = d.meta.style;
        } catch {
          // ignore
        }
        return {
          message: {
            role: 'assistant',
            content: `Kế hoạch dựng (phong cách "${style}") hiện có tổng cộng ${count} layer trên timeline (bao gồm các thẻ tiêu đề, phụ đề và đồ họa). Mọi mốc thời gian đều liên tục và hợp lệ.`,
          },
          usage: { inputTokens: 210, outputTokens: 55 },
        };
      }

      if (lastMessage.toolCallId?.includes('patch_layer')) {
        // Multi-turn: sau khi patch layer, mô hình tự gọi validate_plan để kiểm tra an toàn
        return {
          message: {
            role: 'assistant',
            toolCalls: [{ id: 'call_validate_plan', name: 'validate_plan', args: {} }],
          },
          usage: { inputTokens: 240, outputTokens: 25 },
        };
      }

      if (lastMessage.toolCallId?.includes('validate_plan')) {
        return {
          message: {
            role: 'assistant',
            content:
              'Tôi đã cập nhật thuộc tính của layer theo yêu cầu và đã kiểm tra an toàn qua validate_plan (không có lỗi vi phạm vùng mặt hay che phụ đề). Bạn có thể xem thay đổi đề xuất bên dưới.',
          },
          usage: { inputTokens: 290, outputTokens: 60 },
        };
      }

      if (
        lastMessage.toolCallId?.includes('add_layer') ||
        lastMessage.toolCallId?.includes('add_callout') ||
        lastMessage.toolCallId?.includes('add_title_card')
      ) {
        // Multi-turn: sau khi thêm layer/callout, mô hình tự động gọi validate_plan để kiểm tra an toàn
        return {
          message: {
            role: 'assistant',
            toolCalls: [{ id: 'call_validate_plan', name: 'validate_plan', args: {} }],
          },
          usage: { inputTokens: 230, outputTokens: 25 },
        };
      }

      if (lastMessage.toolCallId?.includes('remove_layer')) {
        return {
          message: {
            role: 'assistant',
            content:
              'Đã xóa layer thành công khỏi bản nháp. Vui lòng kiểm tra diff bên dưới trước khi áp dụng vào timeline.',
          },
          usage: { inputTokens: 220, outputTokens: 45 },
        };
      }
    }

    // Tìm ID layer thực tế từ kết quả tool get_plan_summary trước đó nếu có trong lịch sử
    let targetLayerId = 'l1';
    for (const m of messages) {
      if (m.role === 'tool' && m.content) {
        try {
          const d = JSON.parse(m.content);
          if (Array.isArray(d.layers) && d.layers.length > 0 && d.layers[0].id) {
            targetLayerId = d.layers[0].id;
          }
        } catch {
          // ignore
        }
      }
    }

    // Ưu tiên kiểm tra các hành động chỉnh sửa (sửa, đổi, màu, thêm, xóa) trước
    if (
      lastUser.includes('sửa') ||
      lastUser.includes('đổi') ||
      lastUser.includes('màu') ||
      lastUser.includes('chỉnh') ||
      lastUser.includes('thời gian') ||
      lastUser.includes('vàng') ||
      lastUser.includes('cam')
    ) {
      const color = lastUser.includes('cam') ? '#ff8800' : '#ffd700';
      return {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_patch_layer',
              name: 'patch_layer',
              args: { id: targetLayerId, patch: { props: { fill: color } } },
            },
          ],
        },
        usage: { inputTokens: 170, outputTokens: 40 },
      };
    }

    if (
      lastUser.includes('callout') ||
      lastUser.includes('chú thích') ||
      lastUser.includes('mũi tên') ||
      lastUser.includes('vòng tròn')
    ) {
      return {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_add_callout',
              name: 'add_callout',
              args: {
                start: 1.5,
                end: 4.0,
                label: 'Điểm nhấn',
                kind: 'arrow',
                x: 0.75,
                y: 0.3,
                color: 'accent',
              },
            },
          ],
        },
        usage: { inputTokens: 180, outputTokens: 45 },
      };
    }

    if (
      lastUser.includes('tiêu đề') ||
      lastUser.includes('title') ||
      lastUser.includes('intro') ||
      lastUser.includes('mở đầu')
    ) {
      return {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_add_title_card',
              name: 'add_title_card',
              args: {
                start: 0.5,
                end: 3.0,
                title: 'Giới thiệu nội dung',
                icon: 'star',
              },
            },
          ],
        },
        usage: { inputTokens: 175, outputTokens: 40 },
      };
    }

    if (lastUser.includes('thêm')) {
      return {
        message: {
          role: 'assistant',
          toolCalls: [
            {
              id: 'call_add_layer',
              name: 'add_layer',
              args: {
                layer: {
                  id: 'callout-highlight',
                  track: 'graphic',
                  type: 'callout',
                  start: 1.5,
                  end: 4.0,
                  props: { label: 'Điểm nhấn', fill: '#ffd700' },
                },
              },
            },
          ],
        },
        usage: { inputTokens: 185, outputTokens: 45 },
      };
    }

    if (lastUser.includes('xóa')) {
      return {
        message: {
          role: 'assistant',
          toolCalls: [{ id: 'call_remove_layer', name: 'remove_layer', args: { id: targetLayerId } }],
        },
        usage: { inputTokens: 150, outputTokens: 30 },
      };
    }

    // Nếu người dùng hỏi tóm tắt hoặc xem
    if (
      lastUser.includes('tóm tắt') ||
      lastUser.includes('xem') ||
      lastUser.includes('kế hoạch') ||
      lastUser.includes('layer')
    ) {
      return {
        message: {
          role: 'assistant',
          toolCalls: [{ id: 'call_get_plan_summary', name: 'get_plan_summary', args: {} }],
        },
        usage: { inputTokens: 140, outputTokens: 30 },
      };
    }

    // Mặc định: gọi get_plan_summary để xem cấu trúc
    return {
      message: {
        role: 'assistant',
        toolCalls: [{ id: 'call_get_plan_summary', name: 'get_plan_summary', args: {} }],
      },
      usage: { inputTokens: 130, outputTokens: 25 },
    };
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    this.callHistory.push({ messages, tools });
    if (this.index < this.responses.length) {
      const res = this.responses[this.index];
      this.index++;
      return res;
    }
    return this.simulateDynamicTurn(messages, tools);
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
  tryLoadEnv();

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
