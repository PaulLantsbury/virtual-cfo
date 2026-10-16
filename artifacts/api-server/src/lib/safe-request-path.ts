/** Return only the request path so OAuth codes and state never reach logs. */
export function safeRequestPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const query = value.indexOf("?");
  return query === -1 ? value : value.slice(0, query);
}
