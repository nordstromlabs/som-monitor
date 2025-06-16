import { execSync } from "node:child_process";
import { type ShopItem } from "./scrape";
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

export function NewItem({ item }: { item: ShopItem }) {
    return (
        <Blocks>
            <Header><New /> {item.title} (<Shells /> {item.price})</Header>
            <Section>
                {item.description && item.description !== "" ?
                    (<i>{item.description}</i>)
                    : null}
                <a href={item.purchaseUrl}><b><Trolley /> Buy</b></a>
            </Section>
            {item.imageUrl ? <Image
                src={item.imageUrl}
                alt={`Image for ${item.title}`}
            /> : null}
        </Blocks >
    )
}


export function DeletedItem({ item }: { item: ShopItem }) {
    return (
        <Blocks>
            <Header><Trash /> {item.title} (<Shells /> {item.price})</Header>
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
    const priceChanged = oldItem.price !== newItem.price
    const titleChanged = oldItem.title !== newItem.title
    const descChanged = oldItem.description !== newItem.description

    return (
        <Blocks>
            <Header>
                {titleChanged ? `${oldItem.title} → ${newItem.title}` : newItem.title}{' '}
                (<Shells /> {priceChanged ? `${oldItem.price} → ${newItem.price}` : newItem.price})
            </Header>
            <Section>
                {descChanged ? `${oldItem.description || "_no description_"} → ${newItem.description || "_no description_"}` : newItem.description}{' '}
                <a href={newItem.purchaseUrl}><b><Trolley /> Buy</b></a>
            </Section>
        </Blocks>
    )
}

export function UsergroupPing({ usergroupId }: { usergroupId: string }) {
    return (
        <Blocks>
            <Section>
                pinging <a href="@S091HANUAR1" />
            </Section>
        </Blocks>
    )
}
