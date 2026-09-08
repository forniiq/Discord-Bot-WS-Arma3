import fs from 'fs';
import path from 'path';

interface MessageState {
    monitorMessageId: string | null;
    bankMessageId: string | null;
}

const FILE_PATH = path.join(
    process.cwd(),
    'data',
    'messages.config.json'
);

function readState(): MessageState {
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[MessageState] Не удалось прочитать messages.config.json:', error);

        return {
            monitorMessageId: null,
            bankMessageId: null
        };
    }
}

function writeState(state: MessageState): void {
    try {
        fs.writeFileSync(
            FILE_PATH,
            JSON.stringify(state, null, 4),
            'utf-8'
        );
    } catch (error) {
        console.error('[MessageState] Не удалось сохранить messages.config.json:', error);
    }
}

export function getMessageId(
    type: 'monitor' | 'bank'
): string | null {
    const state = readState();

    return type === 'monitor'
        ? state.monitorMessageId
        : state.bankMessageId;
}

export function setMessageId(
    type: 'monitor' | 'bank',
    messageId: string
): void {
    const state = readState();

    if (type === 'monitor') {
        state.monitorMessageId = messageId;
    } else {
        state.bankMessageId = messageId;
    }

    writeState(state);
}