
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
];

const SECRETS_DIR = path.resolve(process.cwd(), 'secrets');
const CREDENTIALS_PATH = path.join(
    SECRETS_DIR,
    'google-oauth.json',
);
const TOKEN_PATH = path.join(
    SECRETS_DIR,
    'google-token.json',
);

async function saveTokens(auth: OAuth2Client) {
    await fs.mkdir(SECRETS_DIR, { recursive: true });

    await fs.writeFile(
        TOKEN_PATH,
        JSON.stringify(auth.credentials, null, 2),
        'utf8',
    );
}

export async function getGoogleAuth(): Promise<OAuth2Client> {
    await fs.mkdir(SECRETS_DIR, { recursive: true });

    let auth: OAuth2Client;

    try {
        const raw = await fs.readFile(TOKEN_PATH, 'utf8');
        const credentials = JSON.parse(raw);

        if (!credentials.refresh_token) {
            throw new Error(
                'В google-token.json отсутствует refresh_token.',
            );
        }

        auth = new google.auth.OAuth2();
        auth.setCredentials(credentials);

        auth.on('tokens', async tokens => {
            try {
                auth.setCredentials({
                    ...auth.credentials,
                    ...tokens,
                });

                await saveTokens(auth);
            } catch (error) {
                console.error(
                    'Не удалось сохранить Google OAuth токены:',
                    error,
                );
            }
        });

        // Проверяем, что refresh token действительно работает.
        await auth.getAccessToken();

        return auth;
    } catch (error) {
        console.error(
            'Сохранённая Google OAuth авторизация не работает:',
            error,
        );

        // Не запускаем браузер автоматически на сервере.
        // Повторную авторизацию выполняем отдельно на ПК.
        throw new Error(
            'Google OAuth недоступен. Проверь refresh_token и настройки Google Cloud.',
            { cause: error },
        );
    }
}
