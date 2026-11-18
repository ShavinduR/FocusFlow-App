import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

/**
 * Name-based UUID (v5-style, SHA-256): the same seed always gives the same id.
 * Used for rollover copies so that two devices doing the Morning Review
 * offline create the SAME task id, which sync then merges instead of duplicating.
 */
export async function deterministicUuid(seed: string) {
  const h = await digestStringAsync(CryptoDigestAlgorithm.SHA256, seed);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
