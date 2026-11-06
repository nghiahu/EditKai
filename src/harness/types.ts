import type { Plan, Layer, Scene, Issue } from '../plan/types';

export interface LayerSummary {
  id: string;
  track: string;
  type?: string;
  start: number;
  end: number;
  label?: string;
}

export interface PlanSummary {
  meta: Plan['meta'];
  scenes: Scene[];
  layers: LayerSummary[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheHit?: boolean;
}

export interface TurnToolExecution {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  isError?: boolean;
}

export interface TurnLog {
  turn: number;
  toolExecutions: TurnToolExecution[];
  responseText?: string;
  usage: LlmUsage;
  costUsd: number;
}


export interface LlmResponse {
  message: ChatMessage;
  usage: LlmUsage;
}

export interface LlmProvider {
  chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LlmResponse>;
}

export interface TranscriptWord {
  t: string;
  s: number;
  e: number;
  hl?: boolean;
}

export interface TranscriptData {
  text?: string;
  words: TranscriptWord[];
}

export interface HarnessContext {
  draftPlan: Plan;
  projectDir: string;
  transcript?: TranscriptData;
}

