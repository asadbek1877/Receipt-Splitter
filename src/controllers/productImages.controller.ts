import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { fetchProductImage } from "../services/productImageSearch.js";

type ProductImageResponseItem = {
  productName: string;
  imageUrl: string | null;
};

const MAX_PRODUCT_NAMES = Number(process.env.PRODUCT_IMAGE_BATCH_LIMIT || 50);

function normalizeProductName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ");
}

function parseProductNames(body: unknown) {
  const value = (body as any)?.productNames ?? (body as any)?.names;
  if (!Array.isArray(value)) return null;

  return value
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_PRODUCT_NAMES);
}

async function getOrFetchProductImage(productName: string): Promise<ProductImageResponseItem> {
  const normalizedName = normalizeProductName(productName);
  if (!normalizedName) return { productName, imageUrl: null };

  try {
    const db = prisma as any;
    const cached = await db.productImage.findUnique({
      where: { normalizedName },
      select: { imageUrl: true },
    });

    if (cached?.imageUrl) {
      return { productName, imageUrl: cached.imageUrl };
    }

    const searchResult = await fetchProductImage(productName);
    if (!searchResult.imageUrl) {
      if (searchResult.rateLimited) {
        console.warn("[ProductImages] image provider rate limited", {
          provider: searchResult.provider,
          productName,
        });
      }
      return { productName, imageUrl: null };
    }

    await db.productImage.upsert({
      where: { normalizedName },
      create: {
        normalizedName,
        displayName: productName,
        imageUrl: searchResult.imageUrl,
        provider: searchResult.provider,
      },
      update: {
        displayName: productName,
        imageUrl: searchResult.imageUrl,
        provider: searchResult.provider,
        lastFetchedAt: new Date(),
      },
    });

    return { productName, imageUrl: searchResult.imageUrl };
  } catch (error) {
    console.error("[ProductImages] failed to resolve product image", {
      productName,
      message: error instanceof Error ? error.message : String(error),
    });
    return { productName, imageUrl: null };
  }
}

export async function getProductImages(req: Request, res: Response) {
  const productNames = parseProductNames(req.body);

  if (!productNames) {
    return res.status(400).json({
      error: "Request body must include productNames: string[]",
    });
  }

  if (productNames.length === 0) {
    return res.json([]);
  }

  const byNormalizedName = new Map<string, string>();
  for (const productName of productNames) {
    const normalizedName = normalizeProductName(productName);
    if (normalizedName && !byNormalizedName.has(normalizedName)) {
      byNormalizedName.set(normalizedName, productName);
    }
  }

  const resolvedByNormalizedName = new Map<string, ProductImageResponseItem>();

  // Resolve sequentially to avoid bursting image-provider rate limits.
  for (const [normalizedName, representativeName] of byNormalizedName) {
    const resolved = await getOrFetchProductImage(representativeName);
    resolvedByNormalizedName.set(normalizedName, resolved);
  }

  const response = productNames.map((productName) => {
    const normalizedName = normalizeProductName(productName);
    const resolved = resolvedByNormalizedName.get(normalizedName);
    return {
      productName,
      imageUrl: resolved?.imageUrl ?? null,
    };
  });

  return res.json(response);
}
