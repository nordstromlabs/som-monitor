import { type } from "arktype";
import { scrape, ShopItems, type ShopItem } from "./scrape";
import { NewItem, UpdatedItem } from "./blocks";
import { JSXSlack } from "jsx-slack";
import { readFile, writeFile, exists } from "node:fs/promises";
import { deepEquals } from "bun";
import { WebClient } from "@slack/web-api";

const OLD_ITEMS_PATH = "items.json";

const env = type({
  SOM_COOKIE: "string",
  SLACK_CHANNEL_ID: "string",
  SLACK_XOXB: "string",
})(process.env);

if (env instanceof type.errors) {
  console.error(env.summary);
  process.exit(1);
}

const slack = new WebClient(env.SLACK_XOXB);

const currentItems = await scrape(env.SOM_COOKIE);
if (!(await exists(OLD_ITEMS_PATH))) {
  console.log(`👋 First sync successful! Writing to \`${OLD_ITEMS_PATH}\``);
  await writeItems(currentItems);
  process.exit(0);
}

const oldItems = ShopItems(
  JSON.parse(await readFile(OLD_ITEMS_PATH, { encoding: "utf-8" }))
);
if (oldItems instanceof type.errors) {
  throw new Error(oldItems.summary);
}

if (deepEquals(oldItems, currentItems)) {
  console.log("✨ No shop updates detected.");
  process.exit(0);
}

const updates = [];
for (const currentItem of currentItems) {
  const oldItem = oldItems.find((item) => item.id === currentItem.id);
  if (!oldItem) {
    // New shop item!
    updates.push(JSXSlack(NewItem({ item: currentItem })));
    continue;
  }

  if (deepEquals(oldItem, currentItem)) {
    // Same item
    continue;
  }

  // Updated item!
  updates.push(JSXSlack(UpdatedItem({ oldItem, newItem: currentItem })));
}
console.log(`📰 ${updates.length} updates found.`);
console.log(JSON.stringify(updates, null, 2));

const chunkSize = 50; // slack API limit
for (let i = 0; i < updates.length; i += chunkSize) {
  const chunk = updates.slice(i, i + chunkSize)[0];
  const result = await slack.chat.postMessage({
    text: "✨ *New Summer of Making shop updates*",
    blocks: chunk,
    channel: env.SLACK_CHANNEL_ID,
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!result.ok) {
    throw new Error(
      `Failed to send chunked Slack message #${i}: ${result.error}`
    );
  }
}

await writeItems(currentItems);
console.log("🙌 Run completed!");

async function writeItems(newItems: ShopItem[]) {
  await writeFile(OLD_ITEMS_PATH, JSON.stringify(newItems, null, 2));
}
