// Утилита работы с битовыми массивами БД

export function parseArmaArray(str: string | null | undefined): number[] {
    if (!str) return [];
    try {
        return JSON.parse(str);
    } catch {
        return [];
    }
}

export function stringifyArmaArray(arr: number[]): string {
    return JSON.stringify(arr);
}

// Преобразование массива индексов из Discord SelectMenu в формат ArmA [1, 0, 1]
export function selectedValuesToArmaArray(selectedIndexes: string[], totalLength: number): string {
    const result = new Array(totalLength).fill(0);
    for (const indexStr of selectedIndexes) {
        const idx = parseInt(indexStr, 10);
        if (!isNaN(idx) && idx < totalLength) {
            result[idx] = 1;
        }
    }
    return JSON.stringify(result);
}