const SAFE_TENANT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Validates an opaque tenant identifier before it can cross a storage, cache,
 * stream, or realtime boundary. Tenant IDs are server-owned values, never
 * authorization claims supplied by the client.
 */
export function assertTenantId(tenantId: string): string {
  const value = tenantId.trim();
  if (!SAFE_TENANT_ID.test(value)) {
    throw new Error("invalid tenant identifier");
  }
  return value;
}

/**
 * Builds a Redis key whose namespace and identifier are both tenant-scoped.
 * Do not accept a precomposed key from callers: doing so makes accidental
 * cross-tenant key collisions or keyspace injection easier to introduce.
 */
export function tenantRedisKey(
  tenantId: string,
  namespace: string,
  identifier: string
): string {
  const tenant = assertTenantId(tenantId);
  if (!SAFE_KEY_SEGMENT.test(namespace) || !SAFE_KEY_SEGMENT.test(identifier)) {
    throw new Error("invalid tenant Redis key segment");
  }
  return `pipeflow:tenant:${tenant}:${namespace}:${identifier}`;
}

export function sameTenant(left: string, right: string): boolean {
  return assertTenantId(left) === assertTenantId(right);
}

export function metricSubscriptionAllows(
  subscriptions: ReadonlySet<string>,
  metric: string
): boolean {
  return subscriptions.has("*") || subscriptions.has(metric);
}
