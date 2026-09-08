import { findPlayer } from '@/database/queries';
import { formatPlayerProfileEmbed } from '@/utils/profile-formatter.utils';
import { EventHandler } from 'commandkit';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from 'discord.js';

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild) return;

    // ОТКРЫТИЕ ПРОФИЛЯ
    if (
        interaction.isButton() &&
        interaction.customId === 'btn_open_profile'
    ) {
        try {
            // СНАЧАЛА подтверждаем interaction
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            // Только после этого обращаемся к БД
            const player = await findPlayer({
                discordId: interaction.user.id
            });

            if (!player) {
                return void await interaction.editReply({
                    content:
                        '❌ **Ваш Discord не привязан ни к одному игровому аккаунту!**\n' +
                        'Пожалуйста, сначала привяжите аккаунт через специальную панель привязки.',
                    embeds: [],
                    components: []
                });
            }

            const profileEmbed = formatPlayerProfileEmbed(
                player,
                interaction.user.tag,
                interaction.user.displayAvatarURL()
            );

            const actionRow =
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_sync_roles')
                        .setLabel('Синхронизировать роли')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId('btn_refresh_profile')
                        .setLabel('Обновить данные')
                        .setEmoji('⚡')
                        .setStyle(ButtonStyle.Primary)
                );

            return void await interaction.editReply({
                embeds: [profileEmbed],
                components: [actionRow]
            });

        } catch (error) {
            console.error(
                '[ProfileHandler] Ошибка открытия профиля:',
                error
            );

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ Не удалось загрузить профиль.'
                }).catch(() => {});
            }
        }

        return;
    }

    // ОБНОВЛЕНИЕ ПРОФИЛЯ
    if (
        interaction.isButton() &&
        interaction.customId === 'btn_refresh_profile'
    ) {
        try {
            // Сначала подтверждаем interaction
            await interaction.deferUpdate();

            // После этого БД
            const player = await findPlayer({
                discordId: interaction.user.id
            });

            if (!player) {
                return void await interaction.followUp({
                    content: '❌ Аккаунт не найден в базе данных.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const refreshedEmbed = formatPlayerProfileEmbed(
                player,
                interaction.user.tag,
                interaction.user.displayAvatarURL()
            );

            const actionRow =
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_sync_roles')
                        .setLabel('Синхронизировать роли')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId('btn_refresh_profile')
                        .setLabel('Обновить данные')
                        .setEmoji('⚡')
                        .setStyle(ButtonStyle.Primary)
                );

            return void await interaction.editReply({
                embeds: [refreshedEmbed],
                components: [actionRow]
            });

        } catch (error) {
            console.error(
                '[ProfileHandler] Ошибка обновления профиля:',
                error
            );
        }

        return;
    }
};

export default handler;