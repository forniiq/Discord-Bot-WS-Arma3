import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { google } from 'googleapis';

import { getGoogleAuth } from '../../services/google-auth.service';
import { MessageFlags } from 'discord.js';

const TEMPLATE_DOCUMENT_ID =
    '1ahYQctItLhTKKEHAug0CRbEwOdG7cAweTSOENDmMZOA';

const AWARD_TEMPLATE_DOCUMENT_ID =
    '1Rdkf63F3manC_5aEoeV1BlLCZS3s7OjyT2wvvJv4pGw';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator'
};

export const command: CommandData = {
    name: 'google-status',
    description: 'Проверить работу гугла',
};

export const chatInput: ChatInputCommand = async (ctx) => {
    await ctx.interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    try {
        const auth = await getGoogleAuth();

        const drive = google.drive({
            version: 'v3',
            auth: auth as any,
        });

        const docs = google.docs({
            version: 'v1',
            auth: auth as any,
        });

        const [driveResult, decree, award] =
            await Promise.all([
                drive.files.get({
                    fileId: TEMPLATE_DOCUMENT_ID,
                    fields: 'id, name, mimeType',
                }),

                docs.documents.get({
                    documentId: TEMPLATE_DOCUMENT_ID,
                }),

                docs.documents.get({
                    documentId: AWARD_TEMPLATE_DOCUMENT_ID,
                }),
            ]);

        await ctx.interaction.editReply({
            content: [
                '✅ **Google API работает**',
                '',
                '✅ OAuth-токен действителен.',
                '✅ Google Drive API доступен.',
                `✅ Обычный шаблон: ${decree.data.title ?? driveResult.data.name}`,
                `✅ Шаблон награждения: ${award.data.title ?? 'Доступен'}`,
            ].join('\n'),
        });
    } catch (error) {
        console.error(
            'Ошибка проверки Google API:',
            error,
        );

        await ctx.interaction.editReply({
            content: [
                '❌ **Ошибка подключения к Google API**',
                '',
                'Не удалось проверить авторизацию или доступ к шаблонам.',
                'Подробности смотри в логах бота.',
            ].join('\n'),
        });
    }
};