import type { Issue, Plan } from '../../src/plan/types';
import type { Theme } from '../../src/style/theme';

declare const __API__: string;
export const API = __API__;

export const getPlan = async (): Promise<Plan> => {
  const r = await fetch(`${API}/api/plan`);
  if (!r.ok) throw new Error((await r.json()).error ?? 'Không tải được plan');
  return r.json();
};
export const getTheme = async (): Promise<Theme> => (await fetch(`${API}/api/theme`)).json();

export async function savePlan(plan: Plan): Promise<{ ok: true } | { ok: false; issues: Issue[] }> {
  const r = await fetch(`${API}/api/plan`, { method: 'PUT', body: JSON.stringify(plan) });
  if (r.status === 204) return { ok: true };
  const body = await r.json().catch(() => ({}));
  return { ok: false, issues: body.issues ?? [{ severity: 'error', code: 'http', message: body.error ?? `Lỗi ${r.status}` }] };
}

export async function getIssues(): Promise<Issue[]> {
  const r = await fetch(`${API}/api/validate`);
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? `Lỗi ${r.status}`);
  return body.issues;
}

export async function renderVideo(): Promise<{ out?: string; error?: string }> {
  return (await fetch(`${API}/api/render`, { method: 'POST' })).json();
}

export function onPlanChanged(cb: () => void): () => void {
  const es = new EventSource(`${API}/api/events`);
  es.addEventListener('plan-changed', cb);
  return () => es.close();
}

export interface AgentChatResponse {
  reply: string;
  hasChanges: boolean;
  diff: unknown;
  diffDescription: string[];
  draftPlan: Plan;
  pendingId: string;
  turnCount: number;
}

export async function sendAgentChat(message: string, history: unknown[] = []): Promise<AgentChatResponse> {
  const r = await fetch(`${API}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `Lỗi ${r.status}`);
  }
  return r.json();
}

export async function applyAgentChanges(pendingId: string): Promise<void> {
  const r = await fetch(`${API}/api/agent/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingId }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `Lỗi ${r.status}`);
  }
}

