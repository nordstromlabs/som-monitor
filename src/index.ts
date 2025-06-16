import { type } from "arktype";
import { scrape, ShopItems, type ShopItem } from "./scrape";
import { DeletedItem, NewItem, UpdatedItem, UsergroupPing } from "./blocks";
import { JSXSlack } from "jsx-slack";
import { readFile, writeFile, exists } from "node:fs/promises";
import { deepEquals } from "bun";
import { WebClient } from "@slack/web-api";
import { Cron } from "croner";

const OLD_ITEMS_PATH = "items.json";

async function run() {
  const env = type({
    SOM_COOKIE: "string",
    SLACK_CHANNEL_ID: "string",
    SLACK_XOXB: "string",
    SLACK_USERGROUP_ID: "string",
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
    return;
  }

  const oldItems = ShopItems(
    JSON.parse(await readFile(OLD_ITEMS_PATH, { encoding: "utf-8" }))
  );
  if (oldItems instanceof type.errors) {
    throw new Error(oldItems.summary);
  }

  if (deepEquals(oldItems, currentItems)) {
    console.log("✨ No shop updates detected.");
    return;
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
  for (const oldItem of oldItems) {
    const currentItem = currentItems.find((item) => item.id === oldItem.id);
    if (!currentItem) {
      // Deleted shop item
      updates.push(JSXSlack(DeletedItem({ item: oldItem })));
      continue;
    }
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
  await slack.chat.postMessage({
    text: "@shop-watchers",
    blocks: JSXSlack(UsergroupPing({ usergroupId: env.SLACK_USERGROUP_ID })),
    channel: env.SLACK_CHANNEL_ID,
    unfurl_links: false,
    unfurl_media: false,
  });

  await writeItems(currentItems);
  console.log("🙌 Run completed!");
}

// every five minutes!
new Cron("*/5 * * * *", run);
run();

async function writeItems(newItems: ShopItem[]) {
  await writeFile(OLD_ITEMS_PATH, JSON.stringify(newItems, null, 2));
}
