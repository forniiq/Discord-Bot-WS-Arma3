import { EventHandler } from 'commandkit';
import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle
} from 'discord.js';
import { sendLog, sendAdminLog } from '@/utils/logger.utils';
import { spawn } from 'child_process';
import path from 'path';
import { requireOperator } from '@/utils/operator.utils';
import { getRandomRestartMessage } from '@/config/restart-messages';
import { SERVER_CONFIG } from '@/config/server.config';

// Пути к батникам рестарта
const BATCH_PATHS = {
    pve: 'C:\\arma3server\\RESTAR WAS_Altis.bat',
    pvp: 'D:\\arma3serverPVP\\RESTAR WAS_Altis.bat'
};

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild || !interaction.isButton()) return;

    // 1. Первичное нажатие на кнопки "Рестарт PvE" или "Рестарт PvP"
    if (interaction.customId === 'btn_restart_pve' || interaction.customId === 'btn_restart_pvp') {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

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
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
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

        const cmdPath =
            process.env.ComSpec ||
            process.env.COMSPEC ||
            'C:\\Windows\\System32\\cmd.exe';

        console.log(`[ArmaRestart] CMD: ${cmdPath}`);
        console.log(`[ArmaRestart] CWD: ${batDir}`);
        console.log(`[ArmaRestart] BAT: ${batFile}`);

        const restartProcess = spawn(
            'C:\\Windows\\System32\\cmd.exe',
            ['/d', '/c', batPath],
            {
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
            // Отправка анонса игрокам при успешном запуске скрипта
            const ANNOUNCE_CHANNEL_ID = SERVER_CONFIG.discord.channels.restartAnnounce;

            if (ANNOUNCE_CHANNEL_ID) {
                try {
                    const announceChannel = interaction.guild?.channels.cache.get(ANNOUNCE_CHANNEL_ID) 
                        || await interaction.guild?.channels.fetch(ANNOUNCE_CHANNEL_ID);

                    if (announceChannel && announceChannel.isTextBased() && 'send' in announceChannel) {
                        const restartMessage = getRandomRestartMessage(
                            serverName,
                            `<@${interaction.user.id}>`
                        );

                        const publicEmbed = new EmbedBuilder()
                            .setTitle(restartMessage.title)
                            .setDescription(restartMessage.description)
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