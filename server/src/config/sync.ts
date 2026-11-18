/** Tunables for the sync protocol. */
export const SYNC = {
  /** Max client changes accepted per request. Clients batch above this. */
  MAX_PUSH: 500,
  /** Max server changes returned per request. Clients page with `cursor`. */
  PAGE_SIZE: 500,
  /**
   * Pull overlap window. A write is stamped with server_updated_at before it is
   * committed, so a concurrent request could stamp T and commit after another
   * device already pulled up to T. Re-reading a short window before the
   * client's cursor closes that gap; duplicates are harmless because applying
   * a record is idempotent (last-write-wins on updated_at).
   */
  OVERLAP_MS: 5_000,
  /** Client clocks ahead of the server by more than this get clamped to server time. */
  MAX_CLOCK_SKEW_MS: 5 * 60_000,
} as const;
