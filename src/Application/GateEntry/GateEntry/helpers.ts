export const today = () => new Date().toISOString().slice(0, 10);

export const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
};
