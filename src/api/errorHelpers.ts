import axios from "axios";

/** Shape of field-level validation errors returned by the backend. */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** Shape of error responses returned by the backend, per the API contract. */
export interface ApiErrorBody {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  fieldErrors?: ApiFieldError[];
}

export interface ParsedApiError {
  message: string;
  fieldErrors: ApiFieldError[];
  status?: number;
  /** The backend's `error` field, e.g. "OVER_BILLING_OVERRIDE_REQUIRED" for purchase-order over-billing. */
  code?: string;
}

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Extracts a human-readable message and any field-level validation errors from an
 * error thrown by axios, regardless of whether it originated from the backend
 * (structured ApiErrorBody), a network failure, or something unexpected.
 */
export function parseApiError(error: unknown): ParsedApiError {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    return {
      message: body?.message ?? error.message ?? FALLBACK_MESSAGE,
      fieldErrors: body?.fieldErrors ?? [],
      status: error.response?.status,
      code: body?.error,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, fieldErrors: [] };
  }

  return { message: FALLBACK_MESSAGE, fieldErrors: [] };
}
