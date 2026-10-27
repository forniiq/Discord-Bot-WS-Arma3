export function parseArmaArray(
    str: string | null | undefined
): number[] {
    if (!str) return [];

    try {
        const parsed = JSON.parse(str);

        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function stringifyArmaArray(arr: number[]): string {
    return JSON.stringify(arr);
}

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

export function formatPlayerTime(
    time: string | null | undefined
): string[] {
    const values = parseArmaArray(time);

    return Array.from({ length: 6 }, (_, index) => {
        const totalMinutes = values[index] ?? 0;

        if (
            !Number.isSafeInteger(totalMinutes) ||
            totalMinutes < 0
        ) {
            return 'Некорректные данные';
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return `${hours} ч ${minutes} мин`;
    });
}