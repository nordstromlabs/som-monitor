import { parseHTML } from "linkedom";
import { BaseScraper, ShopItem, ShopItems, regions } from ".";
import { SOM_ROOT_URL } from "../constants";

const CAMPFIRE_URL = `${SOM_ROOT_URL}/campfire?show_all_old_stickers=true`;
const STICKERLODE_MAGIC = 0xdeadbeef; // stickerlode items are not normal items and cannot be bought directly - as such we give them a fake ID for our internal uses.

export class StickerlodeScraper extends BaseScraper {
  constructor(cookie: string) {
    super(cookie);
  }

  override async scrape(): Promise<ShopItems> {
    const response = await fetch(CAMPFIRE_URL, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`[stickerlode] HTTP ${response.status}: ${response.statusText}`);
    }
    if (response.redirected) {
      throw new Error(`[stickerlode] Request was redirected to ${response.url}`);
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    const grid = document.querySelector(".stickerlode-grid");
    if (!grid || !grid.children) {
      throw new Error("[stickerlode] grid element not found");
    }

    const items: ShopItems = Array.from(grid.children).map((stickerContainer, index) => {
      const imageUrl = stickerContainer.querySelector("div > div.advent-card-front.w-full.h-full.flex.items-center.justify-center.relative > img")?.getAttribute('src');
      const title = stickerContainer.querySelector("div.advent-card-back > h3")?.textContent;
      const description = stickerContainer.querySelector("div.advent-card-back > p")?.textContent;

      if (!title) {
        throw new Error("[stickerlode] title element not found");
      }
      if (!imageUrl) {
        throw new Error("[stickerlode] image element not found");
      }
      if (!description) {
        throw new Error("[stickerlode] description element not found");
      }

      return ShopItem.assert({
        title,
        imageUrl,
        description,
        prices: regions.reduce<Record<string, number>>((acc, region) => {
          acc[region.code] = 0;
          return acc;
        }, {}),
        id: STICKERLODE_MAGIC + index,
        shopType: 'stickerlode',
      });
    });

    return ShopItems.assert(items);
  }
}
