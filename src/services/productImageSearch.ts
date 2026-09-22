type ProductImageProvider = "google" | "unsplash";

export type ProductImageSearchResult = {
  imageUrl: string | null;
  provider: ProductImageProvider | null;
  rateLimited?: boolean;
};

const IMAGE_SEARCH_TIMEOUT_MS = Number(process.env.IMAGE_SEARCH_TIMEOUT_MS || 5000);

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 429) {
      return { status: response.status, data: null, rateLimited: true };
    }
    if (!response.ok) {
      return { status: response.status, data: null, rateLimited: false };
    }
    return { status: response.status, data: await response.json(), rateLimited: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function searchGoogle(productName: string): Promise<ProductImageSearchResult> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;

  if (!apiKey || !cx) return { imageUrl: null, provider: null };

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: `${productName} product`,
    searchType: "image",
    num: "1",
    safe: "active",
    imgSize: "medium",
  });

  const { data, rateLimited } = await fetchJson(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`
  );

  if (rateLimited) return { imageUrl: null, provider: "google", rateLimited: true };

  const item = Array.isArray((data as any)?.items) ? (data as any).items[0] : null;
  const imageUrl = firstString(item?.image?.thumbnailLink, item?.link);

  return { imageUrl, provider: "google" };
}

async function searchUnsplash(productName: string): Promise<ProductImageSearchResult> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) return { imageUrl: null, provider: null };

  const params = new URLSearchParams({
    query: productName,
    per_page: "1",
    orientation: "squarish",
    content_filter: "high",
  });

  const { data, rateLimited } = await fetchJson(
    `https://api.unsplash.com/search/photos?${params.toString()}`
  );

  if (rateLimited) return { imageUrl: null, provider: "unsplash", rateLimited: true };

  const item = Array.isArray((data as any)?.results) ? (data as any).results[0] : null;
  const imageUrl = firstString(item?.urls?.thumb, item?.urls?.small, item?.urls?.regular);

  return { imageUrl, provider: "unsplash" };
}

export async function fetchProductImage(productName: string): Promise<ProductImageSearchResult> {
  try {
    const googleResult = await searchGoogle(productName);
    if (googleResult.imageUrl || googleResult.rateLimited) return googleResult;

    const unsplashResult = await searchUnsplash(productName);
    if (unsplashResult.imageUrl || unsplashResult.rateLimited) return unsplashResult;

    return { imageUrl: null, provider: null };
  } catch (error) {
    console.warn("[ProductImages] image search failed:", {
      productName,
      message: error instanceof Error ? error.message : String(error),
    });
    return { imageUrl: null, provider: null };
  }
}
