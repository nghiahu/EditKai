// Browser-safe (no node imports).
const ORDINALS: Record<string, number> = { nhat: 1, hai: 2, ba: 3, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

/** The step number in a spoken step mark ("bước 3", "mẹo số 3", "thứ hai" to "thứ mười", "thứ nhất"), or undefined. "đầu tiên" is not read: it does not mean a list. */
export function parseStep(text: string): number | undefined {
  const t = plain(text);
  const digits = /^(?:buoc|meo so)\s+(\d{1,3})$/.exec(t);
  if (digits) { const n = Number(digits[1]); return n >= 1 && n <= 99 ? n : undefined; }
  const ordinal = /^thu\s+(\w+)$/.exec(t);
  return ordinal ? ORDINALS[ordinal[1]] : undefined;
}
