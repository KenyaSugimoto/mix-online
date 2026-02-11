type RequestScope = {
  userId: string;
  tableId: string | null;
};

const toScopeKey = (scope: RequestScope, requestId: string) =>
  `${scope.userId}:${scope.tableId ?? "-"}:${requestId}`;

export class RequestIdStore {
  private readonly ttlMs: number;
  private readonly expiresAtByKey = new Map<string, number>();

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(
    scope: RequestScope,
    requestId: string,
    now = Date.now(),
  ): boolean {
    this.pruneExpired(now);

    const key = toScopeKey(scope, requestId);
    const expiresAt = this.expiresAtByKey.get(key);
    if (expiresAt && expiresAt > now) {
      return true;
    }

    this.expiresAtByKey.set(key, now + this.ttlMs);
    return false;
  }

  size(): number {
    return this.expiresAtByKey.size;
  }

  pruneExpired(now = Date.now()): void {
    for (const [key, expiresAt] of this.expiresAtByKey) {
      if (expiresAt <= now) {
        this.expiresAtByKey.delete(key);
      }
    }
  }
}
