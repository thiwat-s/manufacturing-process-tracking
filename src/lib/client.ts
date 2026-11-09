export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Request failed.');
  return result;
}
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
export function statusClass(status: string) {
  return status === 'COMPLETED' ? 'completed' : status === 'IN_PROGRESS' ? 'progress' : 'pending';
}
export function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
}
