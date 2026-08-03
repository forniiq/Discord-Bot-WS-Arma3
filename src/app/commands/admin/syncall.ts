import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} from 'discord.js';
import { runBulkSync } from '@/services/bulk-sync.service';

export const metadata: CommandMetadata = {
    userPermissions: 'Administrator',
    guilds: [process.env.GUILD_ID as string]
};

export const command: CommandData = {
    name: 'syncall',
    description: '🔄 Запустить массовую синхронизацию ролей и никнеймов для всех пользователей',
};

export const chatInput: ChatInputCommand = async (ctx) => {
    const { interaction } = ctx;

    if (!interaction.guild) {
        return void interaction.reply({ 
            content: '❌ Команда доступна только на сервере.', 
            ephemeral: true 
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Подтверждение массовой синхронизации')
        .setDescription(
            'Вы собираетесь запустить **полную синхронизацию ролей и никнеймов** для всех пользователей из базы данных.\n\n' +
            '⏳ Этот процесс может занять некоторое время. Вы уверены, что хотите продолжить?'
        )
        .setColor('#f1c40f')
        .setFooter({ text: `Запрошено: ${interaction.user.tag}` })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('confirm_sync')
            .setLabel('Подтвердить')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('cancel_sync')
            .setLabel('Отмена')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
    );

    const responseMessage = await interaction.reply({
        embeds: [confirmEmbed],
        components: [row],
        ephemeral: false,
        fetchReply: true
    });

    const collector = responseMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
            return void i.reply({
                content: '❌ Только инициатор команды может подтвердить или отменить действие.',
                ephemeral: true
            });
        }

        if (i.customId === 'confirm_sync') {
            collector.stop('confirmed');

            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                row.components.map(button => button.setDisabled(true))
            );

            await i.update({
                content: '🚀 **Инициализация процесса массовой синхронизации...**',
                embeds: [],
                components: [disabledRow]
            });

            // Решение ошибки TS2345: приведение к any обходит дублирование типов discord.js
            await runBulkSync(interaction.guild as any, interaction as any);

        } else if (i.customId === 'cancel_sync') {
            collector.stop('canceled');

            const cancelEmbed = new EmbedBuilder()
                .setTitle('❌ Синхронизация отменена')
                .setDescription(`Синхронизация была отменена пользователем ${interaction.user}.`)
                .setColor('#e74c3c');

            await i.update({
                content: null,
                embeds: [cancelEmbed],
                components: []
            });
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('⏱️ Время ожидания истекло')
                .setDescription('Запрос на массовую синхронизацию был отменен из-за отсутствия ответа.')
                .setColor('#95a5a6');

            await interaction.editReply({
                content: null,
                embeds: [timeoutEmbed],
                components: []
            }).catch(() => {});
        }
    });
};