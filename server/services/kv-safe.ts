function logKvWarning(action: string, key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown KV error";
  console.warn(`[KV:${action}] ${key} — ${message}`);
}

export async function safeKvGetText(
  kv: KVNamespace,
  key: string
): Promise<string | null> {
  try {
    return await kv.get(key);
  } catch (error) {
    logKvWarning("get", key, error);
    return null;
  }
}

export async function safeKvGetJson<T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> {
  try {
    const value = await kv.get(key, "json");
    return value as T | null;
  } catch (error) {
    logKvWarning("get-json", key, error);
    return null;
  }
}

export async function safeKvPut(
  kv: KVNamespace,
  key: string,
  value: string,
  options?: KVNamespacePutOptions
): Promise<boolean> {
  try {
    await kv.put(key, value, options);
    return true;
  } catch (error) {
    logKvWarning("put", key, error);
    return false;
  }
}

export async function safeKvDelete(kv: KVNamespace, key: string): Promise<boolean> {
  try {
    await kv.delete(key);
    return true;
  } catch (error) {
    logKvWarning("delete", key, error);
    return false;
  }
}
