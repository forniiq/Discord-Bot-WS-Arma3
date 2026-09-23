import { EventHandler } from 'commandkit';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} from 'discord.js';

import { SERVER_CONFIG } from '@/config/server.config';
import {
    findPlayer,
    getUnitActivity,
    type ActivityPlayer,
    type ActivitySort
} from '@/database/queries';

const COMMANDER_ROLE_IDS = SERVER_CONFIG.discord.roles.comanders;

const PLAYERS_PER_PAGE = 10;

function isDiscIdLinked(
    discId: string | number | null | undefined
): boolean {
    if (!discId) return false;

    const value = String(discId).trim();

    return value !== '' && value !== '0';
}

function formatLastTime(value: string | null): string {
    if (!value) {
        return 'Никогда';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Неизвестно';
    }

    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createActivityEmbed(
    players: ActivityPlayer[],
    page: number,
    sort: ActivitySort,
    unitId: string
): EmbedBuilder {
    const totalPages = Math.max(
        1,
        Math.ceil(players.length / PLAYERS_PER_PAGE)
    );

    const startIndex = page * PLAYERS_PER_PAGE;

    const pagePlayers = players.slice(
        startIndex,
        startIndex + PLAYERS_PER_PAGE
    );

    const sortText = sort === 'newest'
        ? 'Сначала недавно заходившие'
        : 'Сначала давно заходившие';

    const description = pagePlayers.length > 0
        ? pagePlayers
            .map((player, index) => {
                const number = startIndex + index + 1;

                return [
                    `**${number}. ${player.pName}**`,
                    `└ Последний вход: \`${formatLastTime(player.pLastTime)}\``
                ].join('\n');
            })
            .join('\n\n')
        : 'В этом отряде нет игроков.';

    return new EmbedBuilder()
        .setTitle('📊 АКТИВНОСТЬ ОТРЯДА')
        .setDescription(description)
        .addFields(
            {
                name: '👥 Участников',
                value: `\`${players.length}\``,
                inline: true
            },
            {
                name: '🏷️ Отряд',
                value: `\`${unitId}\``,
                inline: true
            },
            {
                name: '🔽 Сортировка',
                value: sortText,
                inline: true
            }
        )
        .setFooter({
            text: `Страница ${page + 1} из ${totalPages} • War Spectra Bot`
        })
        .setColor('#2b2d31')
        .setTimestamp();
}

function createActivityButtons(
    page: number,
    totalPlayers: number,
    sort: ActivitySort
): ActionRowBuilder<ButtonBuilder> {
    const totalPages = Math.max(
        1,
        Math.ceil(totalPlayers / PLAYERS_PER_PAGE)
    );

    const isFirstPage = page <= 0;
    const isLastPage = page >= totalPages - 1;

    return new ActionRowBuilder<ButtonBuilder>().addComponents(

        new ButtonBuilder()
            .setCustomId(`activity:first:${sort}`)
            .setLabel('Первая')
            .setEmoji('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isFirstPage),

        new ButtonBuilder()
            .setCustomId(`activity:prev:${page}:${sort}`)
            .setLabel('Назад')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isFirstPage),

        new ButtonBuilder()
            .setCustomId(`activity:sort:${sort}`)
            .setLabel(
                sort === 'newest'
                    ? 'Сначала старые'
                    : 'Сначала новые'
            )
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`activity:next:${page}:${sort}`)
            .setLabel('Вперёд')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isLastPage),

        new ButtonBuilder()
            .setCustomId(`activity:last:${sort}`)
            .setLabel('Последняя')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(isLastPage)
    );
}

const handler: EventHandler<'interactionCreate'> = async (interaction) => {
    if (!interaction.guild) return;

    if (
        !interaction.isButton() ||
        (
            interaction.customId !== 'btn_activity_view' &&
            !interaction.customId.startsWith('activity:')
        )
    ) {
        return;
    }

    const member = await interaction.guild.members.fetch(
        interaction.user.id
    );

    const isCommander = COMMANDER_ROLE_IDS.some(
        roleId => member.roles.cache.has(roleId)
    );

    if (!isCommander) {
        return void interaction.reply({
            content: '❌ У вас нет доступа к просмотру активности отряда.',
            ephemeral: true
        });
    }

    const player = await findPlayer({
        discordId: interaction.user.id
    });

    if (!player || !isDiscIdLinked(player.DiscID)) {
        return void interaction.reply({
            content:
                '❌ Ваш Discord-аккаунт не привязан к игровому профилю.',
            ephemeral: true
        });
    }

    const unitId = String(player.pUnits ?? '').trim();

    if (!unitId || unitId === '0') {
        return void interaction.reply({
            content:
                '❌ Ваш игровой персонаж не состоит ни в одном отряде.',
            ephemeral: true
        });
    }

    let page = 0;
    let sort: ActivitySort = 'newest';

    if (interaction.customId.startsWith('activity:')) {
        const parts = interaction.customId.split(':');

        const action = parts[1];

        if (action === 'first') {
            sort = parts[2] as ActivitySort;
            page = 0;
        }

        if (action === 'last') {
            sort = parts[2] as ActivitySort;
        }

        if (action === 'prev') {
            page = Number(parts[2]);
            sort = parts[3] as ActivitySort;

            page--;
        }

        if (action === 'next') {
            page = Number(parts[2]);
            sort = parts[3] as ActivitySort;

            page++;
        }

        if (action === 'sort') {
            const oldSort = parts[2] as ActivitySort;

            sort = oldSort === 'newest'
                ? 'oldest'
                : 'newest';

            page = 0;
        }
    }

    if (sort !== 'newest' && sort !== 'oldest') {
        sort = 'newest';
    }

    await interaction.deferReply({
        ephemeral: true
    });

    try {
        const players = await getUnitActivity(
            unitId,
            sort
        );

        const totalPages = Math.max(
            1,
            Math.ceil(players.length / PLAYERS_PER_PAGE)
        );

        page = Math.max(
            0,
            Math.min(page, totalPages - 1)
        );

        if (interaction.customId.startsWith('activity:')) {
            const action = interaction.customId.split(':')[1];

            if (action === 'last') {
                page = totalPages - 1;
            }
        }

        const embed = createActivityEmbed(
            players,
            page,
            sort,
            unitId
        );

        const buttons = createActivityButtons(
            page,
            players.length,
            sort
        );

        return void interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });

    } catch (error) {
        console.error(
            'Ошибка при получении активности отряда:',
            error
        );

        return void interaction.editReply({
            content:
                '❌ Произошла ошибка при получении активности отряда.',
            embeds: [],
            components: []
        });
    }
};

export default handler;