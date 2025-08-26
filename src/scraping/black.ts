import { parseHTML } from "linkedom";
import { BaseScraper, ShopItems } from ".";
import { SOM_ROOT_URL } from "../constants";

const SHOP_URL = `${SOM_ROOT_URL}/shop/black_market`;

export class BlackMarketScraper extends BaseScraper {
  constructor(cookie: string) {
    super(cookie);
  }

  override async scrape(): Promise<ShopItems> {
    const response = await fetch(SHOP_URL, {
      headers: this.headers,
    });

    if (response.redirected) {
      throw new Error("Request was redirected");
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    const list = document.querySelector("body > div.container > main > div");
    if (!list) {
      throw new Error("List element not found");
    }

    const items: ShopItems = Array.from(list.children).map(row => {
      const title = row.querySelector(".shop-item-title")?.textContent?.trim();
      if (!title) {
        throw new Error("Title element not found");
      }

      const description = Array.from(row.querySelector(".shop-item-description")?.childNodes || [])
        .filter(node => node.nodeType === 3) // Node.TEXT_NODE
        .map(node => node.textContent?.trim() || "")
        .join("");

      const stockText = row.querySelector(".shop-item-remaining")?.textContent?.trim();
      const stockRemaining = stockText ? parseInt(stockText.replace(" left", "")) : undefined;

      const imageElement = row.querySelector(".shop-item-image > img") as unknown as HTMLImageElement | null;
      if (!imageElement) {
        throw new Error("Image element not found");
      }
      const imageUrlRaw = imageElement.getAttribute('src');
      const imageUrl = imageUrlRaw && !imageUrlRaw.startsWith('http')
        ? new URL(imageUrlRaw, SOM_ROOT_URL).toString()
        : imageUrlRaw || undefined;

      const idAttr = row.getAttribute("data-item-id");
      if (!idAttr) {
        throw new Error("ID attribute not found");
      }
      const id = Number.parseInt(idAttr, 10);
      if (!Number.isFinite(id)) {
        throw new Error(`Invalid ID attribute: "${idAttr}"`);
      }

      const purchaseUrl = `${SOM_ROOT_URL}/shop/items/${id}/buy`;

      const priceAttr = row.getAttribute("data-item-price");
      if (!priceAttr) {
        throw new Error("Price attribute not found");
      }
      const price = Number.parseInt(priceAttr, 10);
      if (!Number.isFinite(price)) {
        throw new Error(`Invalid price attribute: "${priceAttr}"`);
      }

      return {
        title,
        id,
        purchaseUrl,
        description,
        stockRemaining,
        imageUrl,
        isBlackMarket: true,
        prices: {
          XX: price
        }
      };
    });

    return ShopItems.assert(items);
  }
}
