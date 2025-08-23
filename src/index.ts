import { type } from "arktype";
import { ShopItems, type ShopItem } from "./scraping";
import { scrapeAll } from "./scraping/scrapeAll";
import { DeletedItem, NewItem, UpdatedItem, ChannelPing } from "./blocks";
import { JSXSlack } from "jsx-slack";
import { readFile, writeFile, exists } from "node:fs/promises";
import { deepEquals } from "bun";
import { WebClient } from "@slack/web-api";
import * as Sentry from "@sentry/bun";

let cachedItems: ShopItem[] | null = null;
let hasReadFromDisk = false;

const envSchema = type({
  SOM_COOKIE: "string",
  SLACK_CHANNEL_ID: "string",
  SLACK_XOXB: "string",
  OLD_ITEMS_PATH: "string = 'items.json'",
  BLOCKS_LOG_PATH: "string?",
  SENTRY_DSN: "string?",
  MASTER_KEY: "string",
});
const env = envSchema.assert(process.env);

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
  });
}

const SLACK_BLOCK_LIMIT = 50;

async function readItems(): Promise<ShopItem[] | null> {
  if (hasReadFromDisk && cachedItems !== null) {
    return cachedItems;
  }

  if (!(await exists(env.OLD_ITEMS_PATH))) {
    return null;
  }

  try {
    const fileContent = await readFile(env.OLD_ITEMS_PATH, { encoding: "utf-8" });
    const parsed = ShopItems(JSON.parse(fileContent));

    if (parsed instanceof type.errors) {
      throw new Error(parsed.summary);
    }

    cachedItems = parsed;
    hasReadFromDisk = true;

    return parsed;
  } catch (error) {
    console.error("Error reading items from disk:", error);
    throw error;
  }
}

async function writeItems(newItems: ShopItem[]) {
  await writeFile(env.OLD_ITEMS_PATH, JSON.stringify(newItems, null, 2));
  cachedItems = newItems;
  hasReadFromDisk = true;
}

async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.error(error)
      lastError = error as Error;
      if (i < retries - 1) {
        console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
        Sentry.captureException(error);
        await Bun.sleep(delay);
      }
    }
  }
  throw lastError;
}

async function uploadImagesForItems(items: ShopItem[]) {
  const imagesToUpload: string[] = [];
  const itemToImageIndex = new Map<ShopItem, number>();

  for (const item of items) {
    if (item.imageUrl) {
      itemToImageIndex.set(item, imagesToUpload.length);
      imagesToUpload.push(item.imageUrl);
    }
  }

  if (imagesToUpload.length > 0) {
    const uploaded = await uploadToCdn(imagesToUpload);
    for (const [item, idx] of itemToImageIndex.entries()) {
      item.imageUrl = uploaded[idx]!.deployedUrl;
    }
  }
}

function shouldNotifyChannel(oldItem: ShopItem, newItem: ShopItem): boolean {
  const ignoreKeys = ["title", "description"];
  const importantChange = Object.keys(newItem).some((key) => {
    if (ignoreKeys.includes(key)) return false;
    const oldVal = (oldItem as any)[key];
    const newVal = (newItem as any)[key];

    if (key === "stockRemaining") {
      if (typeof oldVal === "number" && typeof newVal === "number") {
        return Math.abs(oldVal - newVal) > 1;
      }
    }

    return !deepEquals(oldVal, newVal);
  });

  return importantChange;
}

async function run() {
  try {
    const slack = new WebClient(env.SLACK_XOXB);

    const currentItems = await retry(() => scrapeAll(env.SOM_COOKIE));
    await uploadImagesForItems(currentItems);

    const oldItems = await readItems();

    if (oldItems === null) {
      await writeItems(currentItems);
      console.log(
        `👋 First sync successful! Writing to \`${env.OLD_ITEMS_PATH}\``
      );
      return;
    }

    if (deepEquals(oldItems, currentItems)) {
      console.log("✨ No shop updates detected.");
      return;
    }

    const updates = [];
    const newItemNames: string[] = [];
    const updatedItemNames: string[] = [];
    const deletedItemNames: string[] = [];
    let shouldPingChannel = false;

    for (const currentItem of currentItems) {
      const oldItem = oldItems.find((item) => item.id === currentItem.id);

      if (!oldItem) {
        updates.push(JSXSlack(NewItem({ item: currentItem })));
        newItemNames.push(currentItem.title);
        shouldPingChannel = true;
        continue;
      }

      if (deepEquals(oldItem, currentItem)) {
        continue;
      }

      updates.push(JSXSlack(UpdatedItem({ oldItem, newItem: currentItem })));
      updatedItemNames.push(oldItem.title);

      if (shouldNotifyChannel(oldItem, currentItem)) {
        shouldPingChannel = true;
      }
    }

    for (const oldItem of oldItems) {
      const currentItem = currentItems.find((item) => item.id === oldItem.id);
      if (!currentItem) {
        updates.push(JSXSlack(DeletedItem({ item: oldItem })));
        deletedItemNames.push(oldItem.title);
        shouldPingChannel = true;
      }
    }

    await writeItems(currentItems);

    console.log(`📰 ${updates.length} updates found.`);
    if (env.BLOCKS_LOG_PATH) {
      await writeFile(env.BLOCKS_LOG_PATH, JSON.stringify(updates, null, 2));
    }

    const notificationTexts = [];
    if (newItemNames.length > 0) {
      notificationTexts.push(`*new items:* ${newItemNames.join(", ")}`);
    }
    if (deletedItemNames.length > 0) {
      notificationTexts.push(`*deleted items:* ${deletedItemNames.join(", ")}`);
    }
    if (updatedItemNames.length > 0) {
      notificationTexts.push(`*updated items:* ${updatedItemNames.join(", ")}`);
    }
    const notificationText = `✨ ${notificationTexts.join(" · ")}`;

    if (shouldPingChannel) {
      updates.push(JSXSlack(ChannelPing()));
    }
    const allBlocks = updates.flat();
    if (allBlocks.length === 0) throw new Error("Updates were detected, but we have no update blocks. This should never happen.");

    for (let i = 0; i < allBlocks.length; i += SLACK_BLOCK_LIMIT) {
      const chunk = allBlocks.slice(i, i + SLACK_BLOCK_LIMIT);
      const result = await retry(() =>
        slack.chat.postMessage({
          text: notificationText,
          blocks: chunk,
          channel: env.SLACK_CHANNEL_ID,
          unfurl_links: false,
          unfurl_media: false,
        })
      );
      if (!result.ok) {
        throw new Error(
          `Failed to send chunked Slack message: ${result.error}`
        );
      }
    }

    console.log("🙌 Run completed!");
  } catch (error) {
    console.error("Fatal error during run:", error);
    Sentry.captureException(error);
    process.exit(1);
  }
}

Bun.serve({
  routes: {
    "/": Response.redirect("https://go.skyfall.dev/som-monitor"),
    "/api/shop": async () => {
      if (cachedItems !== null) {
        return new Response(JSON.stringify(cachedItems, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(Bun.file(env.OLD_ITEMS_PATH));
    },
    "/api/check": async (request) => {
      const authHeader = request.headers.get("Authorization");

      if (!authHeader || authHeader !== `Bearer ${env.MASTER_KEY}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        await run();
        return new Response("Check completed successfully", { status: 200 });
      } catch (error) {
        console.error("Error during manual check:", error);
        return new Response(`Internal server error: ${error}`, { status: 500 });
      }
    },
  },
  port: 8080,
  idleTimeout: 22
})

const cdnResponseSchema = type({
  files: type({
    deployedUrl: "string.url",
  }).array(),
});

async function uploadToCdn(urls: string[]) {
  const res = await retry(() =>
    fetch("https://cdn.hackclub.com/api/v3/new", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer beans",
      },
      body: JSON.stringify(urls),
    })
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Error occurred whilst uploading ${urls} to CDN: ${text}`);
  }

  const json = cdnResponseSchema.assert(JSON.parse(text));
  console.log(`⬆️ Uploaded ${urls.length} files to CDN.`);
  return json.files;
}
