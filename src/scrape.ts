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
  price: "number >= 0",
  purchaseUrl: "string",
  id: "number >= 0",
  "stockRemaining?": "(number > 0) | undefined",
});
export type ShopItem = typeof ShopItem.infer;
export const ShopItems = ShopItem.array();
export type ShopItems = typeof ShopItems.infer;

/// note that this scraper *does not* upload images to hc-cdn.
/// that's for the differ to do -- that way, we don't perform extra work
export async function scrape(cookie: string) {
  const response = await fetch(SOM_URL, {
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
    throw new Error("grid not found");
  }

  const results: ShopItems = [];
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

    results.push({
      title,
      imageUrl,
      description,
      price,
      purchaseUrl,
      id,
      stockRemaining: isOutOfStock ? 0 : limitedStockRemaining,
    });
  }

  const shopItems = ShopItems(results);
  if (shopItems instanceof type.errors) {
    throw new Error(shopItems.summary);
  }

  console.log(`🎉 Found ${shopItems.length} items.`);
  return shopItems;
}
