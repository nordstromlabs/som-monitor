import { RegularScraper } from "./regular";
import { BlackMarketScraper } from "./black";
import { StickerlodeScraper } from "./stickerlode";
import { regions, ShopItems } from "./index";

export async function scrapeAll(cookie: string): Promise<ShopItems> {
  const scrapers = [new RegularScraper(cookie), new BlackMarketScraper(cookie)];
  const results = await Promise.all(scrapers.map(scraper => scraper.scrape()));
  const flat = results.flat();
  console.log(`🎉 Found ${flat.length} items with ${scrapers.length} scrapers and ${regions.length} regions.`);
  return flat;
}
