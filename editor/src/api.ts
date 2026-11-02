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

export async function renderVideo(): Promise<{ out?: string; error?: string }> {
  return (await fetch(`${API}/api/render`, { method: 'POST' })).json();
}

export function onPlanChanged(cb: () => void): () => void {
  const es = new EventSource(`${API}/api/events`);
  es.addEventListener('plan-changed', cb);
  return () => es.close();
}
