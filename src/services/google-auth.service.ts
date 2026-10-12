
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import fs from 'node:fs/promises';
import path from 'node:path';

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
];

const SECRETS_DIR = path.resolve(process.cwd(), 'secrets');
const CREDENTIALS_PATH = path.join(
    SECRETS_DIR,
    'google-oauth.json'
);
const TOKEN_PATH = path.join(
    SECRETS_DIR,
    'google-token.json'
);

export async function getGoogleAuth() {
    await fs.mkdir(SECRETS_DIR, { recursive: true });

    let auth: InstanceType<typeof google.auth.OAuth2>;

    try {
        const tokenFile = await fs.readFile(TOKEN_PATH, 'utf8');
        const credentials = JSON.parse(tokenFile);

        const oauth = new google.auth.OAuth2();
        oauth.setCredentials(credentials);

        oauth.on('tokens', async tokens => {
            const current = oauth.credentials;

            await fs.writeFile(
                TOKEN_PATH,
                JSON.stringify(
                    { ...current, ...tokens },
                    null,
                    2
                ),
                'utf8'
            );
        });

        auth = oauth;

        // Проверяем, что сохранённый токен работает.
        await auth.getAccessToken();

        return auth;
    } catch {
        // Если токена нет или он недействителен,
        // запускаем повторную авторизацию.
    }

    const newAuth = await authenticate({
        keyfilePath: CREDENTIALS_PATH,
        scopes: SCOPES,
    });

    const credentials = newAuth.credentials;

    await fs.writeFile(
        TOKEN_PATH,
        JSON.stringify(credentials, null, 2),
        'utf8'
    );

    newAuth.on('tokens', async tokens => {
        await fs.writeFile(
            TOKEN_PATH,
            JSON.stringify(
                { ...newAuth.credentials, ...tokens },
                null,
                2
            ),
            'utf8'
        );
    });

    return newAuth;
}
