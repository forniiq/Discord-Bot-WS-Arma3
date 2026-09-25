import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
];

const CREDENTIALS_PATH = path.resolve(
    process.cwd(),
    'secrets/google-oauth.json'
);

const TOKEN_PATH = path.resolve(
    process.cwd(),
    'secrets/google-token.json'
);

export async function getGoogleAuth() {
    const credentialsFile = JSON.parse(
        await fs.readFile(
            CREDENTIALS_PATH,
            'utf-8'
        )
    );

    const installed = credentialsFile.installed;

    if (!installed) {
        throw new Error(
            'В google-oauth.json не найден объект installed.'
        );
    }

    const clientId = installed.client_id;
    const clientSecret = installed.client_secret;
    const redirectUri = installed.redirect_uris?.[0];

    if (
        !clientId ||
        !clientSecret ||
        !redirectUri
    ) {
        throw new Error(
            'Некорректный google-oauth.json.'
        );
    }

    const auth = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    /*
     * Если токен уже существует —
     * используем сохранённую авторизацию.
     */

    try {
        const token = await fs.readFile(
            TOKEN_PATH,
            'utf-8'
        );

        auth.setCredentials(
            JSON.parse(token)
        );

        return auth;
    } catch {
        /*
         * Первый запуск.
         * Открываем браузер для OAuth.
         */

        const newAuth = await authenticate({
            scopes: SCOPES,
            keyfilePath: CREDENTIALS_PATH,
        });

        await fs.writeFile(
            TOKEN_PATH,
            JSON.stringify(
                newAuth.credentials,
                null,
                2
            ),
            'utf-8'
        );

        return newAuth as any;
    }
}