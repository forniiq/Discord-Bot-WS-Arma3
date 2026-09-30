import { google } from 'googleapis';
import { pdf } from 'pdf-to-img';

import { getGoogleAuth } from './google-auth.service';
import type { DecreeData } from './decree.service';
import type { AwardDecreeData } from './award.service';

import sharp from 'sharp';

const TEMPLATE_DOCUMENT_ID =
    '1ahYQctItLhTKKEHAug0CRbEwOdG7cAweTSOENDmMZOA';

const AWARD_TEMPLATE_DOCUMENT_ID =
    '1Rdkf63F3manC_5aEoeV1BlLCZS3s7OjyT2wvvJv4pGw';

const AWARD_MEDAL_SIZE = 270;

const AWARD_MEDAL_POSITION = {
    left: 1200,
    top: 425,
};

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
         * 2. Заменяем placeholder'ы
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
                                text: '{{MEDAL_NAME}}',
                                matchCase: true,
                            },
                            replaceText: data.medal.name,
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

                    {
                        replaceAllText: {
                            containsText: {
                                text: '{{MEDAL}}',
                                matchCase: true,
                            },
                            replaceText: '',
                        },
                    },
                ],
            },
        });

        /*
         * 3. Экспортируем Google Docs → PDF
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
         * 4. PDF → PNG
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

        /*
         * 5. Накладываем медаль поверх готового PNG
         */

        const finalPng = await overlayMedal(
            pngPages[0]!,
            data.medal.filePath
        );

        return finalPng;

    } finally {
        /*
         * 6. Удаляем временный Google Docs
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

async function overlayMedal(
    decreePng: Buffer,
    medalPath: string
): Promise<Buffer> {
    const medal = await sharp(medalPath)
        .resize({
            width: AWARD_MEDAL_SIZE,
        })
        .png()
        .toBuffer();

    return sharp(decreePng)
        .composite([
            {
                input: medal,
                left: AWARD_MEDAL_POSITION.left,
                top: AWARD_MEDAL_POSITION.top,
            },
        ])
        .png()
        .toBuffer();
}