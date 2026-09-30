import { google } from 'googleapis';
import { pdf } from 'pdf-to-img';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';

import { getGoogleAuth } from './google-auth.service';
import type { DecreeData } from './decree.service';
import type { AwardDecreeData } from './award.service';

const TEMPLATE_DOCUMENT_ID =
    '1ahYQctItLhTKKEHAug0CRbEwOdG7cAweTSOENDmMZOA';

const AWARD_TEMPLATE_DOCUMENT_ID =
    '1Rdkf63F3manC_5aEoeV1BlLCZS3s7OjyT2wvvJv4pGw';

export async function createDecreeDocument(
    data: DecreeData
): Promise<Buffer> {
    const auth = await getGoogleAuth();

    const drive = google.drive({
        version: 'v3',
        auth: auth as any,
    });

    const docs = google.docs({
        version: 'v1',
        auth: auth as any,
    });

    let documentId: string | undefined;

    try {
        /*
         * 1. Создаём временную копию шаблона
         */

        const copiedFile = await drive.files.copy({
            fileId: TEMPLATE_DOCUMENT_ID,
            requestBody: {
                name: `Приказ №${data.number}`,
            },
        });

        documentId = copiedFile.data.id ?? undefined;

if (!documentId) {
    throw new Error(
        'Google Drive не вернул ID созданного документа.'
    );
}

        if (!documentId) {
            throw new Error(
                'Google Drive не вернул ID созданного документа.'
            );
        }

        /*
         * 2. Формируем текст для подписей
         */

        const signatures = data.signatures
            .map(
                signature =>
                    `${signature.title}\n${signature.rank} ${signature.name}`
            )
            .join('\n\n');

        /*
         * 3. Формируем текст пунктов приказа
         */

        const points = data.points
            .map(
                (point, index) =>
                    `${index + 1}. ${point}`
            )
            .join('\n');

        /*
         * 4. Заменяем переменные в Google Docs
         */

        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{NUMBER}}',
                                matchCase: true,
                            },
                            replaceText: String(data.number),
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{DATE}}',
                                matchCase: true,
                            },
                            replaceText: data.date,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{ISSUER}}',
                                matchCase: true,
                            },
                            replaceText: data.issuer.title,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{SUBJECT}}',
                                matchCase: true,
                            },
                            replaceText: data.subject,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{POINTS}}',
                                matchCase: true,
                            },
                            replaceText: points,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{SIGNATURES}}',
                                matchCase: true,
                            },
                            replaceText: signatures,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{EXECUTOR_RANK}}',
                                matchCase: true,
                            },
                            replaceText: data.executor.rank,
                        },
                    },
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{EXECUTOR_NAME}}',
                                matchCase: true,
                            },
                            replaceText: data.executor.name,
                        },
                    },
                ],
            },
        });

        /*
         * 5. Экспортируем Google Docs → PDF
         */

        const pdfResponse = await drive.files.export(
            {
                fileId: documentId,
                mimeType: 'application/pdf',
            },
            {
                responseType: 'arraybuffer',
            }
        );

        const pdfBuffer = Buffer.from(
            pdfResponse.data as ArrayBuffer
        );

        /*
         * 6. PDF → PNG
         */

        const document = await pdf(pdfBuffer, {
            scale: 2,
        });

        const pngPages: Buffer[] = [];

        for await (const page of document) {
            pngPages.push(Buffer.from(page));
        }

        await document.destroy();

        if (pngPages.length === 0) {
            throw new Error(
                'PDF не содержит страниц.'
            );
        }

        /*
         * Пока возвращаем только первую страницу.
         */

        return pngPages[0]!;

    } finally {
        /*
         * 7. Удаляем временный Google Docs
         */

        if (documentId) {
            try {
                await drive.files.delete({
                    fileId: documentId,
                });
            } catch (error) {
                console.error(
                    'Не удалось удалить временный Google Docs:',
                    error
                );
            }
        }
    }
}

export async function createAwardDecreeDocument(
    data: AwardDecreeData
): Promise<Buffer> {
    const auth = await getGoogleAuth();

    const drive = google.drive({
        version: 'v3',
        auth: auth as any,
    });

    const docs = google.docs({
        version: 'v1',
        auth: auth as any,
    });

    let documentId: string | undefined;
    let medalFileId: string | undefined;

    try {
        /*
         * 1. Создаём временную копию шаблона
         */

        const copiedFile = await drive.files.copy({
            fileId: AWARD_TEMPLATE_DOCUMENT_ID,
            requestBody: {
                name: `Приказ о награждении №${data.number}`,
            },
        });

        documentId = copiedFile.data.id ?? undefined;

        if (!documentId) {
            throw new Error(
                'Google Drive не вернул ID созданного документа.'
            );
        }

        /*
         * 2. Загружаем изображение медали в Google Drive
         */

        const medalFile = await drive.files.create({
            requestBody: {
                name: `award-medal-${data.medal.value}.png`,
                mimeType: 'image/png',
            },

            media: {
                mimeType: 'image/png',
                body: fsSync.createReadStream(data.medal.filePath),
            },

            fields: 'id',
        });

        medalFileId = medalFile.data.id ?? undefined;

        if (!medalFileId) {
            throw new Error(
                'Google Drive не вернул ID изображения медали.'
            );
        }

        /*
         * 3. Разрешаем Google Docs получить изображение
         */

        await drive.permissions.create({
            fileId: medalFileId,
            requestBody: {
                type: 'anyone',
                role: 'reader',
            },
        });

        const medalUrl =
            `https://drive.google.com/uc?export=download&id=${medalFileId}`;

        /*
         * 4. Заменяем обычные placeholder'ы
         */

        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [
                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{NUMBER}}',
                                matchCase: true,
                            },
                            replaceText: String(data.number),
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{DATE}}',
                                matchCase: true,
                            },
                            replaceText: data.date,
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{SQUAD}}',
                                matchCase: true,
                            },
                            replaceText:
                                data.player.squad || 'Без отряда',
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{CALLSIGN}}',
                                matchCase: true,
                            },
                            replaceText: data.player.callsign,
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{PLAYER_RANK}}',
                                matchCase: true,
                            },
                            replaceText: data.player.rank,
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{ISSUER}}',
                                matchCase: true,
                            },
                            replaceText: data.issuer.title,
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{ISSUER_RANK}}',
                                matchCase: true,
                            },
                            replaceText: data.issuer.rank,
                        },
                    },

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{ISSUER_NAME}}',
                                matchCase: true,
                            },
                            replaceText: data.issuer.name,
                        },
                    },
                ],
            },
        });

        /*
         * 5. Находим {{MEDAL}} в документе
         */

        const document = await docs.documents.get({
            documentId,
        });

        let medalStartIndex: number | undefined;

        for (const content of document.data.body?.content ?? []) {
            const paragraph = content.paragraph;

            if (!paragraph) {
                continue;
            }

            for (const element of paragraph.elements ?? []) {
                const textRun = element.textRun;

                if (!textRun?.content) {
                    continue;
                }

                const index = textRun.content.indexOf('{{MEDAL}}');

                if (index !== -1 && element.startIndex !== undefined) {
                    medalStartIndex =
                        element.startIndex! + index;

                    break;
                }
            }

            if (medalStartIndex !== undefined) {
                break;
            }
        }

        if (medalStartIndex === undefined) {
            throw new Error(
                'Placeholder {{MEDAL}} не найден в шаблоне наградного приказа.'
            );
        }

        /*
         * 6. Удаляем {{MEDAL}} и вставляем изображение
         */

        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [
                    {
                        deleteContentRange: {
                            range: {
                                startIndex: medalStartIndex,
                                endIndex: medalStartIndex + '{{MEDAL}}'.length,
                            },
                        },
                    },

                    {
                        insertInlineImage: {
                            location: {
                                index: medalStartIndex,
                            },
                            uri: medalUrl,
                            objectSize: {
                                height: {
                                    magnitude: 300,
                                    unit: 'PT',
                                },
                            },
                        },
                    },
                ],
            },
        });

        /*
         * 7. Экспортируем Google Docs → PDF
         */

        const pdfResponse = await drive.files.export(
            {
                fileId: documentId,
                mimeType: 'application/pdf',
            },
            {
                responseType: 'arraybuffer',
            }
        );

        const pdfBuffer = Buffer.from(
            pdfResponse.data as ArrayBuffer
        );

        /*
         * 8. PDF → PNG
         */

        const pdfDocument = await pdf(pdfBuffer, {
            scale: 2,
        });

        const pngPages: Buffer[] = [];

        for await (const page of pdfDocument) {
            pngPages.push(Buffer.from(page));
        }

        await pdfDocument.destroy();

        if (pngPages.length === 0) {
            throw new Error(
                'PDF не содержит страниц.'
            );
        }

        return pngPages[0]!;

    } finally {
        /*
         * 9. Удаляем временный Google Docs
         */

        if (documentId) {
            try {
                await drive.files.delete({
                    fileId: documentId,
                });
            } catch (error) {
                console.error(
                    'Не удалось удалить временный Google Docs:',
                    error
                );
            }
        }

        /*
         * 10. Удаляем временную медаль из Google Drive
         */

        if (medalFileId) {
            try {
                await drive.files.delete({
                    fileId: medalFileId,
                });
            } catch (error) {
                console.error(
                    'Не удалось удалить временное изображение медали:',
                    error
                );
            }
        }
    }
}