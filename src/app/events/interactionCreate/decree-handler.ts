import { EventHandler } from 'commandkit';

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    MessageFlags,
    ModalBuilder,
    PermissionsBitField,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import {
    DECREE_ISSUERS,
    DECREE_SUBJECTS,
} from '@/config/decree-categories';

import {
    createDecreeData,
} from '@/services/decree.service';

import {
    createDecreeDocument,
} from '@/services/google-docs.service';

import {
    findPlayer,
} from '@/database/queries/players.queries';

import {
    RANKS,
} from '@/config/edit-сategories';

import {
    SERVER_CONFIG,
} from '@/config/server.config';

interface DecreeSession {
    number: number;
    pointsCount: number;
    issuerValue?: string;
    subjectValue?: string;

    png?: Buffer;
    decreeNumber?: number;
}

const sessions = new Map<string, DecreeSession>();


// ============================================================
// КНОПКА "СОЗДАТЬ ПРИКАЗ"
// ============================================================

async function handleDecreeCreate(
    interaction: any
) {
    const modal = new ModalBuilder()
        .setCustomId('decree_number_modal')
        .setTitle('Создание приказа');

    const numberInput = new TextInputBuilder()
        .setCustomId('number')
        .setLabel('Номер приказа')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Например: 153');

    const pointsInput = new TextInputBuilder()
        .setCustomId('points_count')
        .setLabel('Количество пунктов')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('От 1 до 5');

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(numberInput),

        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(pointsInput),
    );

    await interaction.showModal(modal);
}


// ============================================================
// MODAL: НОМЕР + КОЛИЧЕСТВО ПУНКТОВ
// ============================================================

async function handleDecreeNumberModal(
    interaction: any
) {
    const number = Number(
        interaction.fields.getTextInputValue('number')
    );

    const pointsCount = Number(
        interaction.fields.getTextInputValue('points_count')
    );

    if (!Number.isInteger(number) || number <= 0) {
        await interaction.reply({
            content:
                '❌ Номер приказа должен быть положительным числом.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    if (
        !Number.isInteger(pointsCount) ||
        pointsCount < 1 ||
        pointsCount > 5
    ) {
        await interaction.reply({
            content:
                '❌ Количество пунктов должно быть от 1 до 5.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    // Сохраняем промежуточные данные
    sessions.set(interaction.user.id, {
        number,
        pointsCount,
    });

    // Создаём меню выбора издателя
    const menu = new StringSelectMenuBuilder()
        .setCustomId('decree_issuer')
        .setPlaceholder('Выберите, от кого приказ');

    for (const issuer of DECREE_ISSUERS) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(issuer.label)
                .setValue(issuer.value)
        );
    }

    await interaction.reply({
        content:
            'Выберите, от кого издаётся приказ:',
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(menu),
        ],
        flags: MessageFlags.Ephemeral,
    });
}


// ============================================================
// SELECT: "ОТ КОГО ПРИКАЗ"
// ============================================================

async function handleDecreeIssuer(
    interaction: any
) {
    const session = sessions.get(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content:
                '❌ Сессия создания приказа истекла. Начните создание заново.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    const issuerValue = interaction.values[0];

    // Проверяем существование издателя
    const issuer = DECREE_ISSUERS.find(
        item => item.value === issuerValue
    );

    if (!issuer) {
        await interaction.reply({
            content: '❌ Неизвестный тип издателя.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    // Сохраняем выбранного издателя
    session.issuerValue = issuerValue;

    // Создаём меню выбора темы
    const menu = new StringSelectMenuBuilder()
        .setCustomId('decree_subject')
        .setPlaceholder('Выберите тему приказа');

    for (const subject of DECREE_SUBJECTS) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(subject.label)
                .setValue(subject.value)
        );
    }

    await interaction.update({
        content:
            `Вы выбрали: **${issuer.label}**\n\n` +
            'Теперь выберите, о чём приказ:',
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(menu),
        ],
    });
}


// ============================================================
// SELECT: "О ЧЁМ ПРИКАЗ"
// ============================================================

async function handleDecreeSubject(
    interaction: any
) {
    const session = sessions.get(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content:
                '❌ Сессия создания приказа истекла. Начните создание заново.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    const subjectValue = interaction.values[0];

    const subject = DECREE_SUBJECTS.find(
        item => item.value === subjectValue
    );

    if (!subject) {
        await interaction.reply({
            content: '❌ Неизвестная тема приказа.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    session.subjectValue = subjectValue;

    // ========================================================
    // Создаём Modal с полями для пунктов
    // ========================================================

    const modal = new ModalBuilder()
        .setCustomId('decree_points_modal')
        .setTitle('Пункты приказа');

    for (let i = 1; i <= session.pointsCount; i++) {
        const pointInput = new TextInputBuilder()
            .setCustomId(`point_${i}`)
            .setLabel(`Пункт ${i}`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder(`Текст пункта ${i}`);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>()
                .addComponents(pointInput)
        );
    }

    await interaction.showModal(modal);
}


// ============================================================
// MODAL: ТЕКСТ ПУНКТОВ
// ============================================================

async function handleDecreePointsModal(
    interaction: any
) {
    const member = await interaction.guild!.members.fetch(
        interaction.user.id
    );

    if (
        !member.permissions.has(
            PermissionsBitField.Flags.Administrator
        )
    ) {
        await interaction.reply({
            content:
                '❌ Создавать приказы могут только пользователи с правом **Администратор**.',
            flags: MessageFlags.Ephemeral,
        });

        sessions.delete(interaction.user.id);

        return;
    }

    const session = sessions.get(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content:
                '❌ Сессия создания приказа истекла. Начните создание заново.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    if (
        !session.issuerValue ||
        !session.subjectValue
    ) {
        await interaction.reply({
            content:
                '❌ Данные приказа заполнены не полностью.',
            flags: MessageFlags.Ephemeral,
        });

        sessions.delete(interaction.user.id);

        return;
    }

    const issuerConfig = DECREE_ISSUERS.find(
        issuer => issuer.value === session.issuerValue
    );

    if (!issuerConfig) {
        await interaction.reply({
            content: '❌ Неизвестный издатель приказа.',
            flags: MessageFlags.Ephemeral,
        });

        sessions.delete(interaction.user.id);
        return;
    }

    const members =
        await interaction.guild!.members.fetch();

    const issuerMember = members.find(
        (member: GuildMember) =>
            member.roles.cache.has(
                issuerConfig.roleId
            )
    );

    if (!issuerMember) {
        await interaction.reply({
            content:
                `❌ Не найден пользователь с ролью **${issuerConfig.label}**.`,
            flags: MessageFlags.Ephemeral,
        });

        sessions.delete(interaction.user.id);
        return;
    }

    const issuerPlayer = await findPlayer({
        discordId: issuerMember.id,
    });

    if (!issuerPlayer) {
        await interaction.reply({
            content:
                `❌ Пользователь с ролью **${issuerConfig.label}** не зарегистрирован в базе игроков.`,
            flags: MessageFlags.Ephemeral,
        });

        sessions.delete(interaction.user.id);
        return;
    }

    const issuerName = issuerPlayer.pName
        .replace(/^\[[^\]]+\]\s*/i, '')
        .trim();

    const issuerRank =
        RANKS[Number(issuerPlayer.pLvl)]
        ?? 'Неизвестное звание';

    // ========================================================
    // Получаем текст всех пунктов
    // ========================================================

    const points: string[] = [];

    for (let i = 1; i <= session.pointsCount; i++) {
        const point = interaction.fields.getTextInputValue(
            `point_${i}`
        );

        points.push(point.trim());
    }

    try {
        // ====================================================
        // Формируем DecreeData
        // ====================================================

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        const decree = await createDecreeData({
            memberId: interaction.user.id,

            number: session.number,
            issuerValue: session.issuerValue,
            subjectValue: session.subjectValue,
            points,

            issuerPerson: {
                name: issuerName,
                rank: issuerRank,
            },
        });

        // ====================================================
        // Создаём PNG приказа
        // ====================================================

        const png =
            await createDecreeDocument(decree);

        // ====================================================
        // Отправляем PNG в Discord
        // ====================================================

        session.png = png;
        session.decreeNumber = decree.number;

        setTimeout(() => {
            const currentSession = sessions.get(
                interaction.user.id
            );

            if (currentSession === session) {
                sessions.delete(interaction.user.id);
            }
        }, 15 * 60 * 1000);

        const buttons =
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `decree_publish_${interaction.user.id}`
                        )
                        .setLabel('Опубликовать')
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId(
                            `decree_cancel_publish_${interaction.user.id}`
                        )
                        .setLabel('Отмена')
                        .setStyle(ButtonStyle.Secondary),
                );

        await interaction.editReply({
            content:
                `✅ **Приказ №${decree.number} создан.**\n\n` +
                `Опубликовать его в канале <#${SERVER_CONFIG.discord.channels.decrees}>?`,

            files: [
                {
                    attachment: png,
                    name: `prikaz-${decree.number}.png`,
                },
            ],

            components: [buttons],
        });

    } catch (error) {
        console.error(
            '[DecreeHandler] Ошибка создания приказа:',
            error
        );

        sessions.delete(interaction.user.id);

        if (
            interaction.deferred ||
            interaction.replied
        ) {
            await interaction.editReply({
                content:
                    '❌ Не удалось создать приказ. ' +
                    'Подробности ошибки находятся в консоли.',
            }).catch(() => {});
        } else {
            await interaction.reply({
                content:
                    '❌ Не удалось создать приказ.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    }
}


// ============================================================
// EVENT HANDLER
// ============================================================
async function handleDecreePublish(
    interaction: any
) {
    const userId = interaction.user.id;

    if (
        interaction.customId !==
        `decree_publish_${userId}`
    ) {
        return;
    }

    const session = sessions.get(userId);

    if (
        !session ||
        !session.png ||
        !session.decreeNumber
    ) {
        await interaction.reply({
            content:
                '❌ Данные приказа больше недоступны. Создайте приказ заново.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    const channel =
        await interaction.guild!.channels.fetch(
            SERVER_CONFIG.discord.channels.decrees
        );

    if (!channel || !channel.isTextBased()) {
        await interaction.reply({
            content:
                '❌ Канал для приказов не найден.',
            flags: MessageFlags.Ephemeral,
        });

        return;
    }

    try {
        await channel.send({
            content:
                `@here\n📜 **Приказ №${session.decreeNumber}**`,

            files: [
                {
                    attachment: session.png,
                    name:
                        `prikaz-${session.decreeNumber}.png`,
                },
            ],

            allowedMentions: {
                parse: ['everyone'],
            },
        });

        const decreeNumber = session.decreeNumber;

        sessions.delete(userId);

        await interaction.update({
            content:
                `✅ **Приказ №${decreeNumber} опубликован в <#${SERVER_CONFIG.discord.channels.decrees}>.**`,

            attachments: [],
            components: [],
        });

    } catch (error) {
        console.error(
            '[DecreeHandler] Ошибка публикации приказа:',
            error
        );

        await interaction.reply({
            content:
                '❌ Не удалось опубликовать приказ.',
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function handleDecreeCancel(
    interaction: any
) {
    const userId = interaction.user.id;

    if (
        interaction.customId !==
        `decree_cancel_publish_${userId}`
    ) {
        return;
    }

    sessions.delete(userId);

    await interaction.update({
        content:
            '❌ Публикация приказа отменена.',
        attachments: [],
        components: [],
    });
}

const handler: EventHandler<'interactionCreate'> =
    async interaction => {

        if (!interaction.guild) {
            return;
        }

        // ----------------------------------------------------
        // КНОПКА "СОЗДАТЬ ПРИКАЗ"
        // ----------------------------------------------------

        if (
            interaction.isButton() &&
            interaction.customId === 'btn_decree_create'
        ) {
            if (
                !interaction.memberPermissions?.has(
                    PermissionsBitField.Flags.Administrator
                )
            ) {
                return void await interaction.reply({
                    content:
                        '❌ Создавать приказы могут только пользователи с правом **Администратор**.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            return void await handleDecreeCreate(
                interaction
            );
        }

        // ----------------------------------------------------
        // MODAL: НОМЕР ПРИКАЗА
        // ----------------------------------------------------

        if (
            interaction.isModalSubmit() &&
            interaction.customId === 'decree_number_modal'
        ) {
            return void await handleDecreeNumberModal(
                interaction
            );
        }

        // ----------------------------------------------------
        // SELECT: ИЗДАТЕЛЬ
        // ----------------------------------------------------

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === 'decree_issuer'
        ) {
            return void await handleDecreeIssuer(
                interaction
            );
        }

        // ----------------------------------------------------
        // SELECT: ТЕМА
        // ----------------------------------------------------

        if (
            interaction.isStringSelectMenu() &&
            interaction.customId === 'decree_subject'
        ) {
            return void await handleDecreeSubject(
                interaction
            );
        }

        // ----------------------------------------------------
        // MODAL: ПУНКТЫ
        // ----------------------------------------------------

        if (
            interaction.isModalSubmit() &&
            interaction.customId === 'decree_points_modal'
        ) {
            return void await handleDecreePointsModal(
                interaction
            );
        }

        if (
            interaction.isButton() &&
            interaction.customId.startsWith('decree_publish_')
        ) {
            return void await handleDecreePublish(
                interaction
            );
        }

        if (
            interaction.isButton() &&
            interaction.customId.startsWith('decree_cancel_publish_')
        ) {
            return void await handleDecreeCancel(
                interaction
            );
        }
    };

export default handler;