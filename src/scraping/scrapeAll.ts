import { RegularScraper } from "./regular";
import { BlackMarketScraper } from "./black";
import { regions, ShopItems } from "./index";

export async function scrapeAll(): Promise<ShopItems> {
  // Import env here to avoid circular dependency
  const { env } = await import("../");
  const scrapers = [new RegularScraper(env.SOM_COOKIE), new BlackMarketScraper(env.SOM_COOKIE)];
  const results = await Promise.all(scrapers.map(scraper => scraper.scrape()));
  const flat = results.flat();
  console.log(`🎉 Found ${flat.length} items with ${scrapers.length} scrapers and ${Object.keys(regions).length} regions.`);
  return flat;
}
