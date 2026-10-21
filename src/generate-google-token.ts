
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
    'google-oauth.json',
);

const TOKEN_PATH = path.join(
    SECRETS_DIR,
    'google-token.json',
);

async function main() {
    await fs.mkdir(SECRETS_DIR, { recursive: true });

    // Проверяем наличие OAuth Client credentials.
    await fs.access(CREDENTIALS_PATH);

    console.log('Запускаем Google OAuth...');

    const auth = await authenticate({
        keyfilePath: CREDENTIALS_PATH,
        scopes: SCOPES,
    });

    const credentials = auth.credentials;

    if (!credentials.refresh_token) {
        throw new Error(
            'Google не выдал refresh_token. ' +
            'Проверь OAuth Client и повторную авторизацию.',
        );
    }

    await fs.writeFile(
        TOKEN_PATH,
        JSON.stringify(credentials, null, 2),
        'utf8',
    );

    // Проверяем доступ к Google Drive.
    const drive = google.drive({
        version: 'v3',
        auth: auth as any,
    });

    await drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
    });

    console.log('Google OAuth успешно настроен.');
    console.log(`Токен сохранён: ${TOKEN_PATH}`);
}

main().catch(error => {
    console.error('Ошибка генерации Google OAuth токена:', error);
    process.exitCode = 1;
});
