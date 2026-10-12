
import { UNITS, ROLES_CONFIG } from "./roles-сonfig";

function normalizeUnitName(value: string): string {
    return value
        .trim()
        .toLocaleLowerCase("ru-RU")
        .replace(/\s+/g, " ");
}

// Проверка названий и тегов из актуального кэша БД
export function getApprovedUnitsSet(): Set<string> {
    const approved = new Set<string>();

    for (const [id, name] of Object.entries(UNITS)) {
        if (id !== "0") {
            approved.add(normalizeUnitName(name));
        }
    }

    for (const unit of Object.values(ROLES_CONFIG.units)) {
        if (unit.tag) {
            approved.add(normalizeUnitName(unit.tag));
        }
    }

    return approved;
}

// Преобразование тега из никнейма в название отряда из БД
export function getCanonicalUnitName(tag: string): string | null {
    const normalizedTag = normalizeUnitName(tag);

    for (const [id, name] of Object.entries(UNITS)) {
        if (
            id !== "0" &&
            normalizeUnitName(name) === normalizedTag
        ) {
            return name;
        }
    }

    for (const [id, unit] of Object.entries(ROLES_CONFIG.units)) {
        if (
            id !== "0" &&
            unit.tag &&
            normalizeUnitName(unit.tag) === normalizedTag
        ) {
            return UNITS[id] ?? unit.tag;
        }
    }

    return null;
}
