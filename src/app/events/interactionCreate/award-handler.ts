import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildMember,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
    UserSelectMenuBuilder,
} from 'discord.js';

import {
    createAwardDecreeDocument,
} from '@/services/google-docs.service';

import type {
    EventHandler,
} from 'commandkit';

import {
    AWARD_MEDALS,
    DECREE_ISSUERS,
} from '@/config/decree-categories';

import {
    getIssuerMember,
} from '@/services/issuer-cache.service';

import {
    createAwardDecreeData,
} from '@/services/award.service';
import { SERVER_CONFIG } from '@/config/server.config';

interface AwardSession {
    number: number;

    playerId?: string;

    medalValue?: string;

    issuerValue?: string;

    png?: Buffer;

    decreeNumber?: number;
}

const sessions = new Map<string, AwardSession>();


/*
 * =========================
 * Создание приказа
 * =========================
 */

async function handleAwardCreate(
    interaction: any,
) {
    const modal = new ModalBuilder()
        .setCustomId('award_number_modal')
        .setTitle('Создание приказа награждения');

    const numberInput = new TextInputBuilder()
        .setCustomId('number')
        .setLabel('Номер приказа')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: 125')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>()
            .addComponents(numberInput)
    );

    await interaction.showModal(modal);
}


/*
 * =========================
 * Номер приказа
 * =========================
 */

async function handleAwardNumberModal(
    interaction: any,
) {
    const numberValue = interaction.fields.getTextInputValue(
        'number'
    );

    const number = Number(numberValue);

    if (!Number.isInteger(number) || number <= 0) {
        await interaction.reply({
            content: '❌ Номер приказа должен быть положительным целым числом.',
            ephemeral: true,
        });

        return;
    }

    sessions.set(interaction.user.id, {
        number,
    });

    const menu = new UserSelectMenuBuilder()
        .setCustomId('award_player')
        .setPlaceholder('Выберите награждаемого игрока')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>()
        .addComponents(menu);

    await interaction.reply({
        content: 'Выберите игрока, которого необходимо наградить.',
        components: [row],
        ephemeral: true,
    });
}


/*
 * =========================
 * Выбор игрока
 * =========================
 */

async function handleAwardPlayer(
    interaction: any,
) {
    const session = sessions.get(
        interaction.user.id
    );

    if (!session) {
        await interaction.reply({
            content: '❌ Сессия создания приказа не найдена.',
            ephemeral: true,
        });

        return;
    }

    const playerId = interaction.values[0];

    session.playerId = playerId;

    const menu = new StringSelectMenuBuilder()
        .setCustomId('award_medal')
        .setPlaceholder('Выберите медаль')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            AWARD_MEDALS.map(medal =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(medal.label)
                    .setValue(medal.value)
            )
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(menu);

    await interaction.update({
        content: 'Выберите медаль для награждения.',
        components: [row],
    });
}


/*
 * =========================
 * Выбор медали
 * =========================
 */

async function handleAwardMedal(
    interaction: any,
) {
    const session = sessions.get(
        interaction.user.id
    );

    if (!session) {
        await interaction.reply({
            content: '❌ Сессия создания приказа не найдена.',
            ephemeral: true,
        });

        return;
    }

    const medalValue = interaction.values[0];

    session.medalValue = medalValue;

    const menu = new StringSelectMenuBuilder()
        .setCustomId('award_issuer')
        .setPlaceholder('Выберите издателя приказа')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
            DECREE_ISSUERS.map(issuer =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(issuer.label)
                    .setValue(issuer.value)
            )
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(menu);

    await interaction.update({
        content: 'Выберите издателя приказа.',
        components: [row],
    });
}


/*
 * =========================
 * Выбор издателя
 * =========================
 */

async function handleAwardIssuer(interaction: any) {
    const session = sessions.get(interaction.user.id);

    if (!session) {
        await interaction.reply({
            content: '❌ Сессия создания приказа не найдена.',
            ephemeral: true,
        });
        return;
    }

    const issuerValue = interaction.values[0];
    session.issuerValue = issuerValue;

    const issuerConfig = DECREE_ISSUERS.find(
        issuer => issuer.value === issuerValue
    );

    if (!issuerConfig) {
        await interaction.reply({
            content: '❌ Неизвестный издатель приказа.',
            ephemeral: true,
        });
        return;
    }

    if (!session.playerId) {
        await interaction.reply({
            content: '❌ Награждаемый игрок не выбран.',
            ephemeral: true,
        });
        return;
    }

    if (!session.medalValue) {
        await interaction.reply({
            content: '❌ Медаль не выбрана.',
            ephemeral: true,
        });
        return;
    }

    // Сразу подтверждаем interaction
    await interaction.deferReply({
        ephemeral: true,
    });

    try {
        const playerMember =
            await interaction.guild.members.fetch(
                session.playerId
            );

        const issuerMember =
            getIssuerMember(issuerConfig.roleId);

        if (!issuerMember) {
            await interaction.editReply({
                content:
                    `❌ Не найден пользователь с ролью **${issuerConfig.label}**.`,
            });
            return;
        }

        const decree =
            await createAwardDecreeData({
                number: session.number,
                playerMember,
                medalValue: session.medalValue,
                issuerValue: session.issuerValue!,
                issuerMember,
            });

        const png =
            await createAwardDecreeDocument(decree);

        session.png = png;
        session.decreeNumber =
            decree.number;

        const attachment =
            new AttachmentBuilder(
                png,
                {
                    name:
                        `award-decree-${decree.number}.png`,
                }
            );

        const buttons =
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `award_publish_${interaction.user.id}`
                        )
                        .setLabel(
                            'Опубликовать'
                        )
                        .setStyle(
                            ButtonStyle.Success
                        ),

                    new ButtonBuilder()
                        .setCustomId(
                            `award_cancel_publish_${interaction.user.id}`
                        )
                        .setLabel('Отмена')
                        .setStyle(
                            ButtonStyle.Secondary
                        ),
                );

        await interaction.editReply({
            content:
                `✅ **Приказ о награждении №${decree.number} создан.**\n\n` +
                `Опубликовать его в канале <#${SERVER_CONFIG.discord.channels.decrees}>?`,

            files: [
                {
                    attachment: png,
                    name: `award-decree-${decree.number}.png`,
                },
            ],

            components: [buttons],
        });

    } catch (error) {
        console.error(
            'Ошибка создания приказа награждения:',
            error
        );

        await interaction.editReply({
            content:
                `❌ Не удалось создать приказ.\n` +
                `${
                    error instanceof Error
                        ? error.message
                        : 'Неизвестная ошибка.'
                }`,
            components: [],
        });
    }
}


/*
 * =========================
 * Event Handler
 * =========================
 */

export default (async (interaction) => {

    if (!interaction.isButton() &&
        !interaction.isModalSubmit() &&
        !interaction.isUserSelectMenu() &&
        !interaction.isStringSelectMenu()) {
        return;
    }

    if (!interaction.guild) {
        return;
    }

    /*
     * Кнопка создания награждения
     */

    if (
        interaction.isButton() &&
        interaction.customId === 'btn_award_create'
    ) {
        await handleAwardCreate(interaction);
        return;
    }

    /*
     * Номер приказа
     */

    if (
        interaction.isModalSubmit() &&
        interaction.customId === 'award_number_modal'
    ) {
        await handleAwardNumberModal(interaction);
        return;
    }

    /*
     * Выбор игрока
     */

    if (
        interaction.isUserSelectMenu() &&
        interaction.customId === 'award_player'
    ) {
        await handleAwardPlayer(interaction);
        return;
    }

    /*
     * Выбор медали
     */

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === 'award_medal'
    ) {
        await handleAwardMedal(interaction);
        return;
    }

    /*
     * Выбор издателя
     */

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === 'award_issuer'
    ) {
        await handleAwardIssuer(interaction);
        return;
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith('award_publish_')
    ) {
        await handleAwardPublish(interaction);
        return;
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith('award_cancel_publish_')
    ) {
        await handleAwardCancel(interaction);
        return;
    }

}) as EventHandler<'interactionCreate'>;

async function handleAwardPublish(
    interaction: any,
) {
    const userId = interaction.user.id;

    if (
        interaction.customId !==
        `award_publish_${userId}`
    ) {
        return;
    }

    const session = sessions.get(userId);

    if (!session) {
        await interaction.reply({
            content:
                '❌ Сессия создания приказа не найдена или уже завершена.',
            ephemeral: true,
        });

        return;
    }

    if (
        !session.png ||
        session.decreeNumber === undefined
    ) {
        await interaction.reply({
            content:
                '❌ Готовый приказ не найден.',
            ephemeral: true,
        });

        return;
    }

    const decreeChannel =
        interaction.guild.channels.cache.get(
            SERVER_CONFIG.discord.channels.decrees
        );

    if (
        !decreeChannel ||
        !decreeChannel.isTextBased()
    ) {
        await interaction.reply({
            content:
                '❌ Канал для публикации приказов не найден.',
            ephemeral: true,
        });

        return;
    }

    const attachment = new AttachmentBuilder(
        session.png,
        {
            name:
                `award-decree-${session.decreeNumber}.png`,
        }
    );

    try {
        await decreeChannel.send({
            content: '@here',
            files: [attachment],
        });

        const decreeNumber =
            session.decreeNumber;

        sessions.delete(userId);

        await interaction.update({
            content:
                `✅ Приказ о награждении №${decreeNumber} опубликован.`,
            components: [],
            attachments: [],
        });

    } catch (error) {
        console.error(
            'Ошибка публикации приказа награждения:',
            error
        );

        await interaction.reply({
            content:
                '❌ Не удалось опубликовать приказ.',
            ephemeral: true,
        });
    }
}

async function handleAwardCancel(
    interaction: any,
) {
    const userId = interaction.user.id;

    if (
        interaction.customId !==
        `award_cancel_publish_${userId}`
    ) {
        return;
    }

    sessions.delete(userId);

    await interaction.update({
        content: '❌ Создание приказа отменено.',
        components: [],
        attachments: [],
    });
}