/** Resolve bundled public assets at either a domain root or a Pages project path. */
export function publicAssetUrl(path: string): string {
  const base = import.meta.env?.BASE_URL || '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}
