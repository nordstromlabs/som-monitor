import { Window } from "happy-dom";
import { BaseScraper, ShopItem, ShopItems, SOM_ROOT_DOMAIN, regions } from ".";

const SHOP_URL = `${SOM_ROOT_DOMAIN}/shop/black_market`;

export class BlackMarketScraper extends BaseScraper {
  constructor() {
    super();
  }

  override async scrape(): Promise<ShopItems> {
    const window = new Window({ url: SHOP_URL });
    const document = window.document;

    const response = await fetch(SHOP_URL, {
      headers: this.headers,
    });

    document.body.innerHTML = await response.text();

    const list = document.querySelector("body > div.container > main > div");
    if (!list) {
      throw new Error("List element not found");
    }

    const items: ShopItems = Array.from(list.children).map(row => {
      const title = row.querySelector(".shop-item-title")?.textContent?.trim();
      if (!title) {
        throw new Error("Title element not found");
      }

      const description = Array.from(row.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join("");

      const stockText = row.querySelector(".shop-item-remaining")?.textContent?.trim();
      const stockRemaining = stockText ? parseInt(stockText.replace(" left", "")) : undefined;

      const imageUrl = (row.querySelector(".shop-item-image > img") as unknown as HTMLImageElement | null)?.src;
      if (!imageUrl) {
        throw new Error("Image element not found");
      }

      const purchaseUrl = row.querySelector("form")?.action?.trim();
      if (!purchaseUrl) {
        throw new Error("Purchase URL element not found");
      }
      const id = Number(purchaseUrl.replace(/[^0-9]/g, ""));

      const priceAttr = row.getAttribute("data-item-price");
      if (!priceAttr) {
        throw new Error("Price attribute not found");
      }
      const price = parseInt(priceAttr);

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

    return items;
  }
}
