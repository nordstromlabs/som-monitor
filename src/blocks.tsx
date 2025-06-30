import { execSync } from "node:child_process";
import { type ShopItem } from "./scrape";
import { regions } from "./scrape";
import { Blocks, Header, Section, Image, Context } from 'jsx-slack';

function Shells() {
    return <>:shells:</>
}

function Trolley() {
    return <>:tw_shopping_trolley:</>
}

function New() {
    return <>:new:</>
}

function Trash() {
    return <>:win10-trash:</>
}

function Warning() {
    return <>:tw_warning:</>
}

function Star() {
    return <>:star:</>
}

function Robot() {
    return <>:robot_face:</>
}

function formatPrices(prices: ShopItem['prices']): string {
    const priceEntries = Object.entries(prices).filter(([_, price]) => price !== undefined) as [string, number][];

    if (priceEntries.length === 0) {
        return "Price not available";
    }

    if (priceEntries.length === 1) {
        const [regionCode, price] = priceEntries[0]!;
        const region = regions.find(r => r.code === regionCode);
        return `${price} (${region?.name || regionCode})`;
    }

    return priceEntries
        .map(([regionCode, price]) => {
            const region = regions.find(r => r.code === regionCode);
            return `${region?.name || regionCode}: ${price}`;
        })
        .join(', ');
}

function comparePrices(oldPrices: ShopItem['prices'], newPrices: ShopItem['prices']): boolean {
    const oldEntries = Object.entries(oldPrices).filter(([_, price]) => price !== undefined);
    const newEntries = Object.entries(newPrices).filter(([_, price]) => price !== undefined);

    if (oldEntries.length !== newEntries.length) return true;

    return oldEntries.some(([regionCode, oldPrice]) => {
        return newPrices[regionCode as keyof typeof newPrices] !== oldPrice;
    });
}

export function NewItem({ item }: { item: ShopItem }) {
    const renderStock = () => {
        if (item.stockRemaining === 0) {
            return <><Warning /> <b>Out of stock</b></>
        } else if (typeof item.stockRemaining === "number") {
            return <><Warning /> <b>Stock:</b> {item.stockRemaining} items available</>
        } else {
            return <><b>Stock:</b> Unlimited</>
        }
    }

    const showBuy = item.stockRemaining !== 0

    return (
        <Blocks>
            <Header><New /> {item.title} (<Shells /> {formatPrices(item.prices)})</Header>
            <Section>
                {item.description && item.description !== "" ? (
                    <i>{item.description}</i>
                ) : null}<br />
                {renderStock()}<br /><br />

                {showBuy && (
                    <a href={item.purchaseUrl}><b><Trolley /> Buy</b></a>
                )}
            </Section>
            {item.imageUrl ? (
                <Image
                    src={item.imageUrl}
                    alt={`Image for ${item.title}`}
                />
            ) : null}
        </Blocks>
    )
}

export function DeletedItem({ item }: { item: ShopItem }) {
    return (
        <Blocks>
            <Header><Trash /> {item.title} (<Shells /> {formatPrices(item.prices)})</Header>
            <Section>
                {item.description && item.description !== "" ?
                    (<i>{item.description}</i>)
                    : null}
            </Section>
            {item.imageUrl ? <Image
                src={item.imageUrl}
                alt={`Image for ${item.title}`}
            /> : null}
        </Blocks >
    )
}

export function UpdatedItem({ oldItem, newItem }: { oldItem: ShopItem; newItem: ShopItem }) {
    const priceChanged = comparePrices(oldItem.prices, newItem.prices)
    const titleChanged = oldItem.title !== newItem.title
    const descChanged = oldItem.description !== newItem.description
    const imageUrlChanged = oldItem.imageUrl !== newItem.imageUrl
    const stockChanged = oldItem.stockRemaining !== newItem.stockRemaining

    const renderStock = () => {
        if (stockChanged) {
            const oldStock = oldItem.stockRemaining === 0 ? "Out of stock"
                : typeof oldItem.stockRemaining === "number" ? `${oldItem.stockRemaining} items`
                    : "Unlimited"

            const newStock = newItem.stockRemaining === 0 ? "Out of stock"
                : typeof newItem.stockRemaining === "number" ? `${newItem.stockRemaining} items`
                    : "Unlimited"

            const prefix = newItem.stockRemaining === 0 ? <><Warning /> </> : ""

            return <>{prefix}<b>Stock:</b> {oldStock} → {newStock}</>
        } else {
            if (newItem.stockRemaining === 0) {
                return <><Warning /> <b>Out of stock</b></>
            } else if (typeof newItem.stockRemaining === "number") {
                return <><Warning /> <b>Stock:</b> {newItem.stockRemaining} items available</>
            } else {
                return <><b>Stock:</b> Unlimited</>
            }
        }
    }

    const showBuy = newItem.stockRemaining !== 0

    return (
        <Blocks>
            <Header>
                {titleChanged ? `${oldItem.title} → ${newItem.title}` : newItem.title}{' '}
                (<Shells /> {priceChanged ? `${formatPrices(oldItem.prices)} → ${formatPrices(newItem.prices)}` : formatPrices(newItem.prices)})
            </Header>
            <Section>
                {descChanged
                    ? `${oldItem.description || "_no description_"} → ${newItem.description || "_no description_"}`
                    : newItem.description}{' '}<br />
                {renderStock()}<br /><br />
                {showBuy && (
                    <a href={newItem.purchaseUrl}><b><Trolley /> Buy</b></a>
                )}
            </Section>
            {
                imageUrlChanged && oldItem.imageUrl ? (
                    <Image
                        src={oldItem.imageUrl}
                        alt={`Old image for ${newItem.title}`}
                    />
                ) : null
            }
            {
                newItem.imageUrl ? (
                    <Image
                        src={newItem.imageUrl}
                        alt={`New image for ${newItem.title}`}
                    />
                ) : null
            }
        </Blocks >
    )
}

export function UsergroupPing({ usergroupId }: { usergroupId: string }) {
    return (
        <Blocks>
            <Context>
                pinging <a href={`@${usergroupId}`} /> · <a href="https://go.skyfall.dev/som-monitor"><Star /> star the repo!</a> · <a href="https://go.skyfall.dev/converge"><Robot /> discord/slackbot ysws</a>
            </Context>
        </Blocks>
    )
}