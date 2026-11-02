import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import type { Issue } from './types';

const schema = JSON.parse(readFileSync(new URL('../../schema/plan.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);

export function validatePlanSchema(plan: unknown): { ok: boolean; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!validate(plan)) {
    for (const e of validate.errors ?? []) {
      issues.push({ severity: 'error', code: 'schema', message: `${e.instancePath || '/'} ${e.message}` });
    }
  } else {
    // JSON Schema cannot compare two fields, so end > start is checked here.
    const p = plan as { layers: { id: string; start: number; end: number }[]; scenes: { id: string; start: number; end: number }[] };
    for (const l of [...p.layers, ...p.scenes]) {
      if (l.end <= l.start) issues.push({ severity: 'error', code: 'schema', layerId: l.id, message: `${l.id}: end must be greater than start` });
    }
  }
  return { ok: issues.length === 0, issues };
}
