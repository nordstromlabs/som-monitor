import { parseHTML } from "linkedom";
import { type } from "arktype";
import { BaseScraper, ShopItem, ShopItems, regions } from ".";
import { SOM_ROOT_URL } from "../constants";

const SHOP_URL = `${SOM_ROOT_URL}/shop`;

interface SingleRegionItemEntry {
  title: string;
  imageUrl?: string;
  description?: string;
  price: number;
  purchaseUrl: string;
  id: number;
  stockRemaining?: number;
  regionCode: string;
  isBlackMarket: false;
}

export class RegularScraper extends BaseScraper {
  constructor(cookie: string) {
    super(cookie);
  }

  override async scrape(): Promise<ShopItems> {
    // Scrape all regions in parallel
    const regionPromises = regions.map(region =>
      this.scrapeRegion(region.code)
    );

    try {
      const allRegionResults = await Promise.all(regionPromises);
      const allRegionItems = allRegionResults.flat();

      // merge items by ID, combining prices from all the different regions
      const results = mergeRegionItems(allRegionItems);

      const shopItems = ShopItems(Array.from(results.values()));
      if (shopItems instanceof type.errors) {
        throw new Error(shopItems.summary);
      }

      return shopItems;
    } catch (error) {
      console.error('Error during parallel scraping:', error);
      throw error;
    }
  }

  async scrapeRegion(regionCode: string): Promise<SingleRegionItemEntry[]> {
    const regionItems: SingleRegionItemEntry[] = [];

    try {
      const response = await fetch(`${SHOP_URL}?region=${regionCode}`, {
        headers: this.headers,
      });

      if (response.redirected) {
        throw new Error(`Request was redirected for region ${regionCode}`);
      }

      const html = await response.text();
      const { document } = parseHTML(html);
      const grids = document.querySelectorAll(".sm\\:grid");

      if (grids.length === 0) {
        throw new Error(
          `Grid elements not found whilst looking at items for ${regionCode}`,
        );
      }

      for (const grid of Array.from(grids)) {
        for (const child of Array.from(grid.children)) {
          const title = child.querySelector("h3")?.textContent?.trim();
          if (!title) continue;

          const imageElement = child.querySelector("img.rounded-lg") as unknown as
            | HTMLImageElement
            | undefined;
          const imageUrlRaw = imageElement?.getAttribute('src')?.trim();
          const resolvedImageUrl = imageUrlRaw && !imageUrlRaw.startsWith('http')
            ? new URL(imageUrlRaw, SOM_ROOT_URL).toString()
            : imageUrlRaw;

          const description = child
            .querySelector("div.mb-4 > p.text-gray-700")
            ?.textContent?.trim();

          const priceEl = child
            .querySelector(
              "div.absolute.top-2.right-2.text-lg.font-bold.whitespace-nowrap.flex.items-center > picture",
            )
            ?.parentElement?.textContent?.trim()
            ?.replaceAll(",", "");

          if (!priceEl) {
            const avgText = child.querySelector(".text-xs.text-gray-500.text-center")?.textContent?.trim();
            if (!avgText?.includes("free") && !avgText?.includes("(this is a new one, you can enter again!)")) {
              throw new Error(`Price element not found for region ${regionCode}. Has the shop page code updated?`);
            }
          }

          const price = Number(priceEl) || 0;
          const purchaseUrlRaw = child.querySelector("form")?.getAttribute('action')?.trim();
          if (!purchaseUrlRaw) continue;

          const purchaseUrl = purchaseUrlRaw.startsWith('http')
            ? purchaseUrlRaw
            : new URL(purchaseUrlRaw, SOM_ROOT_URL).toString();

          const id = Number(purchaseUrl.replace(/[^0-9]/g, ""));

          const isOutOfStock = !!child.querySelector("p.text-red-600");
          const limitedStockRemainingText = child
            .querySelector("p.text-orange-600")
            ?.textContent?.replace(/[^0-9]/g, "");
          const limitedStockRemaining = limitedStockRemainingText
            ? Number(limitedStockRemainingText)
            : undefined;

          regionItems.push({
            title,
            imageUrl: resolvedImageUrl,
            description,
            price,
            purchaseUrl,
            id,
            stockRemaining: isOutOfStock ? 0 : limitedStockRemaining,
            regionCode,
            isBlackMarket: false
          });
        }
      }
    } catch (error) {
      console.error(`Error scraping region ${regionCode}:`, error);
      throw error;
    }

    return regionItems;
  }
}

function mergeRegionItems(allRegionItems: SingleRegionItemEntry[]): Map<number, ShopItem> {
  const results = new Map<number, ShopItem>();

  for (const item of allRegionItems) {
    const { regionCode, price, ...itemData } = item;

    if (results.has(item.id)) {
      const existing = results.get(item.id)!;
      // merge prices from different regions
      results.set(item.id, {
        ...existing,
        prices: {
          ...existing.prices,
          [regionCode]: price,
        },
      });
    } else {
      results.set(item.id, {
        ...itemData,
        prices: {
          [regionCode]: price,
        },
      });
    }
  }

  return results;
}
