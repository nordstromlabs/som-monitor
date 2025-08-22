import { type } from "arktype";

export const regions = [
  {
    code: "US",
    name: "🇺🇸",
  },
  {
    code: "EU",
    name: "🇪🇺/🇬🇧",
  },
  {
    code: "IN",
    name: "🇮🇳",
  },
  {
    code: "CA",
    name: "🇨🇦",
  },
  { code: "AU", name: "🇦🇺" },
  {
    code: "XX",
    name: "🌍",
  },
];

export const ShopItem = type({
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
  "stockRemaining?": "(number >= 0) | undefined",
  "isBlackMarket": "boolean = false"
});
export type ShopItem = typeof ShopItem.infer;
export const ShopItems = ShopItem.array();
export type ShopItems = typeof ShopItems.infer;

export class BaseScraper {
  protected headers: { [key: string]: string };

  constructor(cookie: string) {
    this.headers = {
      Cookie: cookie,
      "User-Agent":
        "The Summer of Making Monitor starts now! The premise is simple: scrape stuff, ping stuff! Your job is to send me the shop items you have available to peruse. Tell the story of your items with updates on your shop page. One you're done, your shop item update goes to head-to-head #meta match ups voted on by the community. The more votes you get, the less likely Hack Club gets cancelled! You can spend shells on rewards in the shop. We're giving away shells, orders, users, everything you need to keep building. Update stuff, get stuff. Repeat until the summer ends on August 31st. This summer is yours for the making, get started at go.skyfall.dev/som-monitor. For teenagers 18 or under.",
    };
  }

  async scrape(): Promise<ShopItems> {
    throw new Error("Unimplemented.")
  }
}