interface ValidationIssue {
  message?: string;
  path?: string[];
}

export function extractApiErrorMessage(
  payload: unknown,
  fallback: string
): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const data = payload as {
    error?: string | { issues?: ValidationIssue[] };
    message?: string;
  };

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (data.error && typeof data.error === "object" && Array.isArray(data.error.issues)) {
    const firstIssue = data.error.issues[0];
    if (firstIssue?.message) {
      const field = firstIssue.path?.[0];
      return field ? `${field}: ${firstIssue.message}` : firstIssue.message;
    }
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  return fallback;
}
