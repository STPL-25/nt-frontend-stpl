// ---------------------------------------------------------------------------
// Primitive option shape used in every select/dropdown
// ---------------------------------------------------------------------------
export interface Option {
  label: string;
  value: string | number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Pagination meta
// ---------------------------------------------------------------------------
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}
