import { findPlayer } from '@/database/queries';
import { formatPlayerProfileEmbed } from '@/utils/profile-formatter.utils';
import { EventHandler } from 'commandkit';
import { 
    ActionRowBuilder, 
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isButton() && interaction.customId === "btn_open_profile") {
        await interaction.deferReply({ ephemeral: true });

        // Ищем игрока по его Discord ID
        const player = await findPlayer({ discordId: interaction.user.id });

        if (!player) {
            return void interaction.editReply({
                content: '❌ **Ваш Discord не привязан ни к одному игровому аккаунту!**\nПожалуйста, сначала привяжите аккаунт через специальную панель привязки.',
            });
        }

        // Генерируем красивый Embed профиля
        const profileEmbed = formatPlayerProfileEmbed(
            player, 
            interaction.user.tag, 
            interaction.user.displayAvatarURL()
        );

        // Добавляем интерактивные кнопки прямо под личным профилем
        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

        return void interaction.editReply({
            embeds: [profileEmbed],
            components: [actionRow]
        });
    }

    if (interaction.isButton() && interaction.customId === "btn_refresh_profile") {
        await interaction.deferUpdate(); // Тихо подтверждаем нажатие кнопки

        const player = await findPlayer({ discordId: interaction.user.id });
        if (!player) {
            return void interaction.followUp({
                content: '❌ Аккаунт не найден в базе данных.',
                ephemeral: true
            });
        }

        const refreshedEmbed = formatPlayerProfileEmbed(
            player, 
            interaction.user.tag, 
            interaction.user.displayAvatarURL()
        );

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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

        return void interaction.editReply({
            embeds: [refreshedEmbed],
            components: [actionRow]
        });
    }
};

export default handler;