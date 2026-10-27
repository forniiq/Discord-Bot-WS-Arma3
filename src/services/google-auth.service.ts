import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import fs from 'node:fs/promises';
import path from 'node:path';

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

    try {
        const rawCredentials = await fs.readFile(
            CREDENTIALS_PATH,
            'utf8',
        );

        const credentials = JSON.parse(rawCredentials);
        const oauthConfig = credentials.installed ?? credentials.web;

        if (
            !oauthConfig?.client_id ||
            !oauthConfig?.client_secret
        ) {
            throw new Error(
                'В google-oauth.json отсутствуют client_id или client_secret.',
            );
        }

        const auth = new google.auth.OAuth2(
            oauthConfig.client_id,
            oauthConfig.client_secret,
            oauthConfig.redirect_uris?.[0],
        );

        const rawTokens = await fs.readFile(TOKEN_PATH, 'utf8');
        const tokens = JSON.parse(rawTokens);

        if (!tokens.refresh_token) {
            throw new Error(
                'В google-token.json отсутствует refresh_token. Требуется повторная авторизация.',
            );
        }

        auth.setCredentials(tokens);

        auth.on('tokens', async newTokens => {
            try {
                auth.setCredentials({
                    ...auth.credentials,
                    ...newTokens,
                });

                await saveTokens(auth);
            } catch (error) {
                console.error(
                    'Не удалось сохранить Google OAuth токены:',
                    error,
                );
            }
        });

        await auth.getAccessToken();

        return auth;
    } catch (error) {
        const err = error as {
            message?: string;
            code?: string | number;
            response?: {
                status?: number;
                data?: unknown;
            };
        };

        console.error('Ошибка Google OAuth:', {
            message: err.message,
            code: err.code,
            status: err.response?.status,
            response: err.response?.data,
        });

        throw new Error(
            'Google OAuth недоступен. Проверь подробности ошибки выше.',
            { cause: error },
        );
    }
}
