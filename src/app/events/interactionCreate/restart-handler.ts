import { EventHandler } from 'commandkit';
import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionsBitField
} from 'discord.js';
import { sendLog, sendAdminLog } from '@/utils/logger.utils';
import { spawn } from 'child_process';
import path from 'path';

// Пути к батникам рестарта
const BATCH_PATHS = {
    pve: 'C:\\arma3server\\RESTAR WAS_Altis.bat',
    pvp: 'D:\\arma3serverPVP\\RESTAR WAS_Altis.bat'
};

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild || !interaction.isButton()) return;

    // 1. Первичное нажатие на кнопки "Рестарт PvE" или "Рестарт PvP"
    if (interaction.customId === 'btn_restart_pve' || interaction.customId === 'btn_restart_pvp') {
        const isPvE = interaction.customId === 'btn_restart_pve';
        const serverType = isPvE ? 'PvE' : 'PvP';

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ ПОДТВЕРЖДЕНИЕ РЕСТАРТА')
            .setDescription(
                `Вы действительно хотите запустить **перезапуск ${serverType} сервера**?`
            )
            .setColor('#fee75c');

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_restart_${isPvE ? 'pve' : 'pvp'}`)
                .setLabel(`Подтвердить рестарт ${serverType}`)
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️'),
            new ButtonBuilder()
                .setCustomId('cancel_restart')
                .setLabel('Отмена')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

        return void interaction.reply({
            embeds: [confirmEmbed],
            components: [confirmRow],
            ephemeral: true
        });
    }

    // 2. Нажатие кнопки "Отмена"
    if (interaction.customId === 'cancel_restart') {
        return void interaction.update({
            content: '❌ **Перезапуск сервера отменен.**',
            embeds: [],
            components: []
        });
    }

    // 3. Подтверждение перезапуска (confirm_restart_pve / confirm_restart_pvp)
    if (interaction.customId === 'confirm_restart_pve' || interaction.customId === 'confirm_restart_pvp') {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({
                content: '❌ **Недостаточно прав:** Данное действие могут выполнять только администраторы.',
                ephemeral: true
            });
        }

        const type = interaction.customId === 'confirm_restart_pve' ? 'pve' : 'pvp';
        const isPvE = type === 'pve';
        const serverName = isPvE ? 'PvE' : 'PvP';
        const batPath = BATCH_PATHS[type];

        // Ответ администратору, нажавшему кнопку
        await interaction.update({
            content: `⏳ **Запускается процесс рестарта ${serverName} сервера...**`,
            embeds: [],
            components: []
        });

        // Запуск .bat файла через cmd.exe
        const batDir = path.dirname(batPath);
        const batFile = path.basename(batPath);

        const restartProcess = spawn(
            'cmd.exe',
            ['/c', batFile],
            {
                cwd: batDir,
                windowsHide: false
            }
        );

        restartProcess.stdout?.on('data', (data) => {
            console.log(`[${serverName}] ${data}`);
        });

        restartProcess.stderr?.on('data', (data) => {
            console.error(`[${serverName}] ${data}`);
        });

        restartProcess.on('error', async (error) => {
            await sendLog(
                'ERROR',
                'Arma3Restart',
                `Ошибка запуска батника ${serverName}: ${error.message}`
            );

            await interaction.followUp({
                content: `❌ **Не удалось запустить рестарт ${serverName}:**\n\`${error.message}\``,
                ephemeral: true
            }).catch(() => null);
        });

        restartProcess.on('spawn', async () => {
            await sendLog(
                'INFO',
                'Arma3Restart',
                `Батник рестарта ${serverName} успешно запущен.`
            );

            // Отправка анонса игрокам при успешном запуске скрипта
            const ANNOUNCE_CHANNEL_ID = process.env.RESTART_ANNOUNCE_CHANNEL_ID;

            if (ANNOUNCE_CHANNEL_ID) {
                try {
                    const announceChannel = interaction.guild?.channels.cache.get(ANNOUNCE_CHANNEL_ID) 
                        || await interaction.guild?.channels.fetch(ANNOUNCE_CHANNEL_ID);

                    if (announceChannel && announceChannel.isTextBased() && 'send' in announceChannel) {
                        const publicEmbed = new EmbedBuilder()
                            .setTitle(isPvE ? '🛡️ РЕСТАРТ PVE СЕРВЕРА' : '⚔️ РЕСТАРТ PVP СЕРВЕРА')
                            .setDescription(
                                `Производится рестарт **${serverName}** сервера!\n\n` +
                                '🔄 Сервер перезапускается и будет доступен через пару минут.\n' +
                                'Пожалуйста, подождите и переподключитесь после завершения.'
                            )
                            .setColor(isPvE ? '#2ecc71' : '#e74c3c')
                            .setFooter({ text: 'War Spectra' })
                            .setTimestamp();

                        await announceChannel.send({
                            content: '@here',
                            embeds: [publicEmbed]
                        });
                    }
                } catch (err) {
                    await sendLog('ERROR', 'ArmaRestart', `Не удалось отправить анонс в канал ${ANNOUNCE_CHANNEL_ID}: ${err}`);
                }
            }

            // Запись в лог аудита администраторов
            await sendAdminLog({
                title: '🔄 Рестарт сервера',
                description: `Администратор <@${interaction.user.id}> запустил рестарт **${serverName}** сервера.`,
                color: isPvE ? '#57f287' : '#ed4245',
                executorId: interaction.user.id,
                fields: [
                    { name: 'Сервер', value: `${serverName} Altis`, inline: true },
                    { name: 'Файл', value: `\`${batPath}\``, inline: true }
                ]
            });
        });

        restartProcess.on('close', (code) => {
            console.log(`[${serverName}] Батник завершился с кодом: ${code}`);
        });
    }
};

export default handler;