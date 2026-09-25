import { RANKS } from "@/config/edit-сategories";

export function getRankByLevel(level: string): string {
    const index = Number(level);

    return RANKS[index] ?? 'Неизвестное звание';
}

export function cleanPlayerName(name: string): string {
    return name
        .replace(/^\[[^\]]+\]\s*/i, '')
        .trim();
}

export function formatDecreeDate(): string {
    const date = new Date();

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}