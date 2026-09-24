// The backend's error responses are shaped { success: false, error: "..." }
// (see e.g. ServiceAgreement.controller.js) — .error is the field that actually
// carries the specific message. .message is checked too since a few older
// endpoints/hooks use it, and err.message is axios's own generic
// "Request failed with status code 4xx" as a last resort before the
// caller-supplied fallback.
export function getErrorMessage(err: any, fallback: string): string {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}
