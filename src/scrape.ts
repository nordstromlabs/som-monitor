import { Window } from "happy-dom";
import { type } from "arktype";
import { version as bunVersion } from "bun";
import { version } from "../package.json";

const SOM_ROOT_DOMAIN = "https://summer.hackclub.com";
const SOM_URL = `${SOM_ROOT_DOMAIN}/shop`;

const ShopItem = type({
  title: "string",
  "description?": "string",
  "imageUrl?": "string",
  prices: {
    "US?": "number >= 0",
    "EU?": "number >= 0",
    "IN?": "number >= 0",
    "CA?": "number >= 0",
    "AU?": "number >= 0",
    "XX?": "number >= 0",
  },
  purchaseUrl: "string",
  id: "number >= 0",
  "stockRemaining?": "(number > 0) | undefined",
});
export type ShopItem = typeof ShopItem.infer;
export const ShopItems = ShopItem.array();
export type ShopItems = typeof ShopItems.infer;

export const regions = [
  {
    code: "US",
    name: "United States",
  },
  {
    code: "EU",
    name: "EU + UK",
  },
  {
    code: "IN",
    name: "India",
  },
  {
    code: "CA",
    name: "Canada",
  },
  { code: "AU", name: "Australia" },
  {
    code: "XX",
    name: "Rest of World",
  },
];

/// note that this scraper *does not* upload images to hc-cdn.
/// that's for the differ to do -- that way, we don't perform extra work
export async function scrape(cookie: string) {
  const results: Map<number, ShopItem> = new Map();

  for (const region of regions) {
    const response = await fetch(`${SOM_URL}?region=${region.code}`, {
      headers: {
        Cookie: cookie,
        "User-Agent": `SOM-Monitor/${version} bun/${bunVersion} (+https://skyfall.dev)`,
      },
    });
    const window = new Window({ url: SOM_URL });
    const document = window.document;
    document.body.innerHTML = await response.text();
    const grid = document.querySelector(".sm\\:grid");
    if (!grid) {
      throw new Error(`Grid element not found whilst looking at items for ${region.code}`);
    }

    for (const child of grid.children) {
      const title = child.querySelector("h3")?.textContent.trim()!;
      const imageUrl = (
        child.querySelector("img.rounded-lg") as unknown as
          | HTMLImageElement
          | undefined
      )?.src.trim();
      const description = child
        .querySelector("div.mb-4 > p.text-gray-700")
        ?.textContent?.trim();
      const price =
        Number(
          child
            .querySelector(
              "div.absolute.top-2.right-2.text-lg.font-bold.whitespace-nowrap.flex.items-center > img"
            )
            ?.parentElement?.textContent.trim()
            .replaceAll(",", "")
        ) || 0;
      const purchaseUrl = child.querySelector("form")?.action.trim()!;
      const id = Number(purchaseUrl.replace(/[^0-9]/g, ""));

      const isOutOfStock = !!child.querySelector("p.text-red-600");
      const limitedStockRemainingText = child
        .querySelector("p.text-orange-600")
        ?.textContent?.replace(/[^0-9]/g, "");
      const limitedStockRemaining = limitedStockRemainingText
        ? Number(limitedStockRemainingText)
        : undefined;

      if (results.has(id)) {
        const prev = results.get(id)!;
        results.set(id, {
          ...prev,
          prices: {
            ...prev.prices,
            [region.code]: price,
          },
        });
      } else {
        results.set(id, {
          title,
          imageUrl,
          description,
          prices: {
            [region.code]: price,
          },
          purchaseUrl,
          id,
          stockRemaining: isOutOfStock ? 0 : limitedStockRemaining,
        });
      }
    }
  }

  const shopItems = ShopItems(Array.from(results.values()));
  if (shopItems instanceof type.errors) {
    throw new Error(shopItems.summary);
  }

  console.log(`🎉 Found ${shopItems.length} items.`);
  return shopItems;
}