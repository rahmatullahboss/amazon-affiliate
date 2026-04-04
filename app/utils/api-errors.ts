interface ValidationIssue {
  message?: string;
  path?: string[];
}

function asReadableMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = asReadableMessage(item);
      if (message) {
        return message;
      }
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const directMessage = asReadableMessage(record.message);
  if (directMessage) {
    return directMessage;
  }

  const issues = record.issues;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (!issue || typeof issue !== "object") {
        continue;
      }

      const issueRecord = issue as Record<string, unknown>;
      const issueMessage = asReadableMessage(issueRecord.message);
      if (!issueMessage) {
        continue;
      }

      const rawPath = issueRecord.path;
      const field =
        Array.isArray(rawPath) && rawPath.length > 0
          ? rawPath
              .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
              .filter(Boolean)
              .join(".")
          : "";

      return field ? `${field}: ${issueMessage}` : issueMessage;
    }
  }

  return null;
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

  const nestedErrorMessage = asReadableMessage(data.error);
  if (nestedErrorMessage) {
    return nestedErrorMessage;
  }

  const nestedMessage = asReadableMessage(data.message);
  if (nestedMessage) {
    return nestedMessage;
  }

  return fallback;
}
