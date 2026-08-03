// Отряды

import { UNITS } from "./edit-сategories";

export function getApprovedUnitsSet(): Set<string> {
    const approved = new Set<string>();
    
    for (const [id, name] of Object.entries(UNITS)) {
        if (id !== "0") {
            approved.add(name);
        }
    }
    
    return approved;
}