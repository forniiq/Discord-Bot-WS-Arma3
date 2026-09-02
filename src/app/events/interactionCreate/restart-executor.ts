import { Interaction, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { exec } from 'child_process';
import { sendLog, sendAdminLog } from '@/utils/logger.utils';

// Конфигурация путей к батникам
const BATCH_PATHS = {
    pve: 'C:\\arma3server\\RESTAR WAS_Altis.bat',
    pvp: 'D:\\arma3serverPVP\\RESTAR WAS_Altis.bat'
};

export default async function handleRestartConfirm(interaction: Interaction) {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'confirm_restart_pve' || interaction.customId === 'confirm_restart_pvp') {
        // Проверка прав администратора
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({
                content: '❌ У вас нет прав на выполнение данной операции.',
                ephemeral: true
            });
        }

        const type = interaction.customId === 'confirm_restart_pve' ? 'pve' : 'pvp';
        const isPvE = type === 'pve';
        const batPath = BATCH_PATHS[type];

        // Уведомляем нажавшего о старте процесса
        await interaction.update({
            content: `⏳ Запуск скрипта рестарта ${isPvE ? 'PvE' : 'PvP'} сервера...`,
            embeds: [],
            components: []
        });

        // 1. Вызов локального .bat файла
        exec(`"${batPath}"`, async (error) => {
            if (error) {
                await sendLog('ERROR', 'ServerRestart', `Ошибка запуска ${type.toUpperCase()} скрипта: ${error.message}`);
                return;
            }
            await sendLog('INFO', 'ServerRestart', `Скрипт ${type.toUpperCase()} успешно отработал.`);
        });

        // 2. Отправка красочного объявление в канал от лица бота
        const publicEmbed = new EmbedBuilder()
            .setTitle(isPvE ? '🛡️ [PvE] Перезагрузка Сервера' : '⚔️ [PvP] Перезагрузка Сервера')
            .setDescription(
                '### 🚨 Внимание, оперативники!\n\n' +
                `Инициирована плановая техническая перезагрузка **${isPvE ? 'PvE (Altis)' : 'PvP (Altis)'}** сервера.\n\n` +
                '```gdb\n' +
                'Сохранение данных профилей... [ОК]\n' +
                'Очистка оперативной памяти... [В ПРОЦЕССЕ]\n' +
                'Перезапуск миссии...         [ОЖИДАНИЕ]\n' +
                '```\n' +
                '⏱️ **Сервер будет доступен через 3-5 минут.** Приносим извинения за временные неудобства.'
            )
            .setColor(isPvE ? '#2ecc71' : '#e74c3c')
            .setImage('https://i.imgur.com/v8S98S9.png') // Ссылка на тематический баннер Arma 3 (по желанию)
            .setFooter({ text: 'War Spectra • Система автоматического обслуживания' })
            .setTimestamp();

        if (interaction.channel && 'send' in interaction.channel) {
            await interaction.channel.send({
                content: '@here',
                embeds: [publicEmbed]
            });
        }

        // 3. Логирование действий в системный логгер и аудит
        await sendAdminLog({
            title: '🔄 Рестарт сервера Arma 3',
            description: `Администратор заставил перезапуститься **${type.toUpperCase()}** сервер.`,
            color: isPvE ? '#57f287' : '#ed4245',
            executorId: interaction.user.id,
            fields: [
                { name: 'Сервер', value: isPvE ? 'PvE Altis' : 'PvP Altis', inline: true },
                { name: 'Путь к файлу', value: `\`${batPath}\``, inline: true }
            ]
        });
    }
}