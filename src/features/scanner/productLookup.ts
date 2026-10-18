/**
 * Looks a retail barcode up in Open Food Facts (free, public, no key).
 * Covers many packaged food/drink products worldwide; local or non-food goods are often
 * missing, so "not found" is a normal result and is reported as such.
 */
export type ProductInfo = {
  found: boolean;
  name?: string;
  brands?: string;
  quantity?: string;
  imageUrl?: string;
};

export async function lookupProduct(code: string, signal?: AbortSignal): Promise<ProductInfo> {
  if (!/^\d{8,14}$/.test(code)) return { found: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity,image_front_small_url`,
      { headers: { Accept: 'application/json', 'User-Agent': 'ReceiptSplitter/1.0 (mobile app)' }, signal: controller.signal },
    );
    // an unknown product is answered with 404 (+ status:0): that is "not found", not a failure
    if (res.status === 404) return { found: false };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.status !== 1 || !json.product) return { found: false };
    const p = json.product;
    const name = typeof p.product_name === 'string' ? p.product_name.trim() : '';
    return {
      found: Boolean(name),
      name: name || undefined,
      brands: typeof p.brands === 'string' && p.brands.trim() ? p.brands.trim() : undefined,
      quantity: typeof p.quantity === 'string' && p.quantity.trim() ? p.quantity.trim() : undefined,
      imageUrl: typeof p.image_front_small_url === 'string' ? p.image_front_small_url : undefined,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
