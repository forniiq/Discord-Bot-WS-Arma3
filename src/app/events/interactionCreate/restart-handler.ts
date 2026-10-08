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

const RESTART_PATH = 'C:\\arma3server\\RESTAR WAS_Altis.bat'
const SHUTDOWN_PATH = 'C:\\arma3server\\stopws.bat'

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild || !interaction.isButton()) return;

    if (interaction.customId === 'btn_restart') {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ ПОДТВЕРЖДЕНИЕ РЕСТАРТА')
            .setDescription(`Вы действительно хотите запустить **перезапуск сервера**?`)
            .setColor('#fee75c');

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_restart`)
                .setLabel('Подтвердить рестарт')
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

    if (interaction.customId === 'btn_shutdown') {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ ПОДТВЕРЖДЕНИЕ ВЫКЛЮЧЕНИЯ')
            .setDescription(
                'Вы действительно хотите **выключить сервер**?'
            )
            .setColor('#ed4245');

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_shutdown')
                .setLabel('Выключить Сервер')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⛔️'),

            new ButtonBuilder()
                .setCustomId('cancel_shutdown')
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

    // 2. Отмена
    if (interaction.customId === 'cancel_restart') {
        return void interaction.update({
            content: '❌ **Перезапуск сервера отменен.**',
            embeds: [],
            components: []
        });
    }

    if (interaction.customId === 'cancel_shutdown') {
        return void interaction.update({
            content: '❌ **Выключение сервера отменено.**',
            embeds: [],
            components: []
        });
    }

    // 3. Подтверждение рестарта
    if (interaction.customId === 'confirm_restart') {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        // Обновляем сообщение администратора
        await interaction.update({
            content: `⏳ **Запускается процесс рестарта сервера...**`,
            embeds: [],
            components: []
        });

        // Пути
        const batDir = path.dirname(RESTART_PATH);
        const batFile = path.basename(RESTART_PATH);

        const cmdPath =
            process.env.ComSpec ??
            'C:\\Windows\\System32\\cmd.exe';

        console.log(`[ArmaRestart] CMD: ${cmdPath}`);
        console.log(`[ArmaRestart] CWD: ${batDir}`);
        console.log(`[ArmaRestart] BAT: ${batFile}`);

        // Запускаем BAT
        const restartProcess = spawn(
            cmdPath,
            ['/d', '/c', batFile],
            {
                cwd: batDir,
                windowsHide: false
            }
        );

        restartProcess.on('error', async (error) => {
            console.error(
                `[ArmaRestart] Ошибка запуска:`,
                error
            );

            await sendLog(
                'ERROR',
                'Arma3Restart',
                `Ошибка запуска батника: ${error.message}`
            );

            await interaction.followUp({
                content:
                    `❌ **Не удалось запустить рестарт:**\n` +
                    `\`${error.message}\``,
                ephemeral: true
            }).catch(() => null);
        });

        restartProcess.stdout?.on('data', (data) => {
            console.log(
                `[Server] ${data.toString()}`
            );
        });

        restartProcess.stderr?.on('data', (data) => {
            console.error(
                `[Server] ${data.toString()}`
            );
        });

        try {
            const ANNOUNCE_CHANNEL_ID =
                SERVER_CONFIG.discord.channels.restartAnnounce;

            if (ANNOUNCE_CHANNEL_ID) {
                const announceChannel =
                    interaction.guild.channels.cache.get(
                        ANNOUNCE_CHANNEL_ID
                    ) ||
                    await interaction.guild.channels.fetch(
                        ANNOUNCE_CHANNEL_ID
                    );

                if (
                    announceChannel &&
                    announceChannel.isTextBased() &&
                    'send' in announceChannel
                ) {
                    const restartMessage =
                        getRandomRestartMessage(
                            `<@${interaction.user.id}>`
                        );

                    const publicEmbed = new EmbedBuilder()
                        .setTitle(restartMessage.title)
                        .setDescription(restartMessage.description)
                        .setColor('#2ecc71')
                        .setFooter({
                            text: 'War Spectra'
                        })
                        .setTimestamp();

                    await announceChannel.send({
                        content: '@here',
                        embeds: [publicEmbed]
                    });

                    console.log(
                        `[ArmaRestart] Анонс отправлен.`
                    );
                }
            }
        } catch (error) {
            console.error(
                `[ArmaRestart] Ошибка отправки анонса:`,
                error
            );

            await sendLog(
                'ERROR',
                'ArmaRestart',
                `Не удалось отправить анонс: ${error}`
            );
        }

        await sendAdminLog({
            title: '🔄 Рестарт сервера',

            description:
                `Администратор <@${interaction.user.id}> ` +
                `запустил рестарт сервера.`,

            color: '#57f287',

            executorId: interaction.user.id,

            fields: [
                {
                    name: 'Сервер',
                    value: `WarSpectra Altis`,
                    inline: true
                },
                {
                    name: 'Файл',
                    value: `\`${RESTART_PATH}\``,
                    inline: true
                }
            ]
        });

        restartProcess.on('close', (code) => {
            console.log(
                `[Server] Батник завершился с кодом: ${code}`
            );
        });
    }

    if (interaction.customId === 'confirm_shutdown') {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        // Обновляем сообщение администратора
        await interaction.update({
            content: '⏳ **Выключается сервер...**',
            embeds: [],
            components: []
        });

        const batDir = path.dirname(SHUTDOWN_PATH);
        const batFile = path.basename(SHUTDOWN_PATH);

        const cmdPath =
            process.env.ComSpec ??
            'C:\\Windows\\System32\\cmd.exe';

        console.log(`[ArmaShutdown] CMD: ${cmdPath}`);
        console.log(`[ArmaShutdown] CWD: ${batDir}`);
        console.log(`[ArmaShutdown] BAT: ${batFile}`);

        const shutdownProcess = spawn(
            cmdPath,
            ['/d', '/c', batFile],
            {
                cwd: batDir,
                windowsHide: false
            }
        );

        shutdownProcess.on('error', async (error) => {
            console.error(
                '[ArmaShutdown] Ошибка выключения сервера:',
                error
            );

            await sendLog(
                'ERROR',
                'Arma3Shutdown',
                `Ошибка запуска stopws.bat: ${error.message}`
            );

            await interaction.followUp({
                content:
                    `❌ **Не удалось выключить сервер:**\n` +
                    `\`${error.message}\``,
                ephemeral: true
            }).catch(() => null);
        });

        shutdownProcess.stdout?.on('data', (data) => {
            console.log(
                `[Server Shutdown] ${data.toString()}`
            );
        });

        shutdownProcess.stderr?.on('data', (data) => {
            console.error(
                `[Server Shutdown] ${data.toString()}`
            );
        });

        await sendAdminLog({
            title: '⛔ Выключение сервера',

            description:
                `Администратор <@${interaction.user.id}> ` +
                `запустил выключение сервера.`,

            color: '#ed4245',

            executorId: interaction.user.id,

            fields: [
                {
                    name: 'Сервер',
                    value: 'WarSpectra Altis',
                    inline: true
                },
                {
                    name: 'Файл',
                    value: `\`${SHUTDOWN_PATH}\``,
                    inline: true
                }
            ]
        });

        shutdownProcess.on('close', (code) => {
            console.log(
                `[Server Shutdown] Батник завершился с кодом: ${code}`
            );
        });
    }
};

export default handler;