/**
 * v4-shaped unique id without native modules.
 *
 * The `uuid` package needs crypto.getRandomValues, which does not exist in React Native
 * (Hermes), so `uuid()` threw "Property 'crypto' doesn't exist". These ids are only used as
 * local keys / idempotency keys, where uniqueness (not secrecy) is what matters.
 */
export function uuid(): string {
  const seed = Date.now().toString(16).padStart(12, '0').slice(-12);
  let i = 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = i < 12 ? parseInt(seed[i++], 16) ^ ((Math.random() * 16) % 16) : (Math.random() * 16) | 0;
    const v = c === 'x' ? r & 15 : (r & 3) | 8;
    return v.toString(16);
  });
}
