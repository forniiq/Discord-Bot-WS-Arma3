import { google } from 'googleapis';
import { getGoogleAuth } from './services/google-auth.service';

async function main() {
    const auth = await getGoogleAuth();

    const drive = google.drive({
        version: 'v3',
        auth: auth as any,
    });

    const response = await drive.files.list({
        pageSize: 10,
        fields: 'files(id, name, mimeType)',
    });

    console.log('Google Drive подключен.');

    for (const file of response.data.files ?? []) {
        console.log(
            `${file.name} | ${file.mimeType} | ${file.id}`
        );
    }
}

main().catch(error => {
    console.error('Ошибка Google OAuth:', error);
    process.exit(1);
});