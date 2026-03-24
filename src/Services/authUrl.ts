/**
 * Authenticated file URL helper
 *
 * Appends the user's stored JWT token as a query parameter to any
 * /dwl/... file URL so the backend can authenticate the download.
 *
 * Works with <img src>, <iframe src>, <a href download>, and
 * window.open() since all of those cannot send an Authorization header.
 *
 * Token format mirrors the Authorization header used by axios:
 *   base64( JSON.stringify({ token: "hex…", iv: "hex…" }) )
 *
 * Non-/dwl URLs (e.g. external links) are returned unchanged.
 */
export function getAuthFileUrl(url: string | null | undefined): string {
  if (!url) return '';

  // Only protect our own FTP-served assets
  if (!url.includes('/dwl/')) return url;

  const stored = localStorage.getItem('userToken');
  if (!stored) return url;

  try {
    // stored is already JSON.stringify({token, iv})
    // btoa it to produce base64(JSON) — same encoding axios uses for the
    // Authorization header so the backend verifyImageToken can decode it.
    const base64Token = btoa(stored);
    const separator   = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(base64Token)}`;
  } catch {
    return url;
  }
}
