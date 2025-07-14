import { Window } from "happy-dom";
import { type } from "arktype";

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

interface RegionShopItem {
  title: string;
  imageUrl?: string;
  description?: string;
  price: number;
  purchaseUrl: string;
  id: number;
  stockRemaining?: number;
  regionCode: string;
}

async function scrapeRegion(regionCode: string, cookie: string): Promise<RegionShopItem[]> {
  const window = new Window({ url: SOM_URL });
  const regionItems: RegionShopItem[] = [];

  try {
    const response = await fetch(`${SOM_URL}?region=${regionCode}`, {
      headers: {
        Cookie: cookie,
        "User-Agent":
          "The Summer of Making Monitor starts now! The premise is simple: scrape stuff, ping stuff! Your job is to send me the shop items you have available to peruse. Tell the story of your items with updates on your shop page. One you're done, your shop item update goes to head-to-head #meta match ups voted on by the community. The more votes you get, the less likely Hack Club gets cancelled! You can spend shells on rewards in the shop. We're giving away shells, orders, users, everything you need to keep building. Update stuff, get stuff. Repeat until the summer ends on August 31st. This summer is yours for the making, get started at go.skyfall.dev/som-monitor. For teenagers 18 or under.",
      },
    });

    const document = window.document;
    document.body.innerHTML = await response.text();
    const grids = document.querySelectorAll(".sm\\:grid");
    
    if (grids.length === 0) {
      throw new Error(
        `Grid elements not found whilst looking at items for ${regionCode}`,
      );
    }

    for (const grid of grids) {
      for (const child of grid.children) {
        const title = child.querySelector("h3")?.textContent?.trim();
        if (!title) continue;

        const imageUrl = (
          child.querySelector("img.rounded-lg") as unknown as
            | HTMLImageElement
            | undefined
        )?.src?.trim();
        
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
          throw new Error(
            `Price element not found for region ${regionCode}. Has the shop page code updated?`,
          );
        }
        
        const price = Number(priceEl) || 0;
        const purchaseUrl = child.querySelector("form")?.action?.trim();
        if (!purchaseUrl) continue;
        
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
          imageUrl,
          description,
          price,
          purchaseUrl,
          id,
          stockRemaining: isOutOfStock ? 0 : limitedStockRemaining,
          regionCode,
        });
      }
    }
  } catch (error) {
    console.error(`Error scraping region ${regionCode}:`, error);
    throw error;
  }

  return regionItems;
}

function mergeRegionItems(allRegionItems: RegionShopItem[]): Map<number, ShopItem> {
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

/// note that this scraper *does not* upload images to hc-cdn.
/// that's for the differ to do -- that way, we don't perform extra work
export async function scrape(cookie: string): Promise<ShopItems> {
  // Scrape all regions in parallel
  const regionPromises = regions.map(region => 
    scrapeRegion(region.code, cookie)
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

    console.log(`🎉 Found ${shopItems.length} items across ${regions.length} regions.`);
    return shopItems;
  } catch (error) {
    console.error('Error during parallel scraping:', error);
    throw error;
  }
}
