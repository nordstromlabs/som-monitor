import { Window } from "happy-dom";
import { type } from "arktype";

const SOM_ROOT_DOMAIN = "https://summer.hackclub.com";
const SOM_URL = `${SOM_ROOT_DOMAIN}/shop`;

const ShopItem = type({
  title: "string",
  "description?": "string",
  "imageUrl?": "string",
  price: "number",
  purchaseUrl: "string",
  id: "number",
});
export type ShopItem = typeof ShopItem.infer;
export const ShopItems = ShopItem.array();
export type ShopItems = typeof ShopItems.infer;

export async function scrape(cookie: string) {
  const response = await fetch(SOM_URL, {
    headers: {
      Cookie: cookie,
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
    const title = child.querySelector("h3")?.textContent!;
    const imageUrl = (
      child.querySelector("img.rounded-lg") as unknown as
        | HTMLImageElement
        | undefined
    )?.src;
    const description = child.querySelector(
      "div.mb-4 > p.text-gray-700"
    )?.textContent;
    const price =
      Number(
        child
          .querySelector(
            "div.absolute.top-2.right-2.text-lg.font-bold.whitespace-nowrap.flex.items-center > img"
          )
          ?.parentElement?.textContent.trim()
          .replaceAll(",", "")
      ) || 0;
    const purchaseUrl = child.querySelector("form")?.action!;
    const id = Number(purchaseUrl.replace(/[^0-9]/g, ""));

    results.push({
      title,
      imageUrl,
      description,
      price,
      purchaseUrl,
      id,
    });
  }

  const shopItems = ShopItems(results);
  if (shopItems instanceof type.errors) {
    throw new Error(shopItems.summary);
  }
  console.log(`🎉 Found ${shopItems.length} items.`);
  return shopItems;
}
