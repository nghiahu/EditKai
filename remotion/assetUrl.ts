/** URL of a project asset: path segments are percent-encoded so names containing %, # or spaces survive. */
export function assetUrl(base: string, src: string): string {
  if (/^(https?:|data:|file:)/.test(src)) return src;
  return `${base}/${src.split('/').map(encodeURIComponent).join('/')}`;
}
