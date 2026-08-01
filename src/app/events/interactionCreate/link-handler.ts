import { EventHandler } from 'commandkit';
import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder 
} from 'discord.js';
import { findPlayer, updatePlayerField } from '@/database/queries';
import { syncPlayerProfile } from '@/services/playerSyncService';
import { sendLog } from '@/utils/logger';

// ID роли "Привязан"
const LINKED_ROLE_ID = process.env.LINKED_ROLE_ID;

// Вспомогательная функция для проверки валидности привязанного DiscID
function isDiscIdLinked(discId: string | number | null | undefined): boolean {
    if (!discId) return false;
    const str = String(discId).trim();
    return str !== '' && str !== '0';
}

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild) return;

    // 1. Нажатие на кнопку "Привязать аккаунт"
    if (interaction.isButton() && interaction.customId === "btn_link_steam") {
        const existingPlayer = await findPlayer({ discordId: interaction.user.id });
        
        if (existingPlayer) {
            return void interaction.reply({
                content: `⚠️ Ваш Discord уже привязан к игроку **${existingPlayer.pName}** (pUID: \`${existingPlayer.pUID}\`).\nЕсли это ошибка, обратитесь к администрации.`,
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId("modal_link_steam")
            .setTitle("Привязка Steam / Arma 3");

        const steamIdInput = new TextInputBuilder()
            .setCustomId("steam_id")
            .setLabel("Введите ваш SteamID64 (или pUID)")
            .setPlaceholder("Пример: 76561198000000000 (Узнать: steamid.pro)")
            .setStyle(TextInputStyle.Short)
            .setMinLength(15)
            .setMaxLength(20)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(steamIdInput));
        return void await interaction.showModal(modal);
    }

    // 2. Обработка ввода SteamID из Модального окна
    if (interaction.isModalSubmit() && interaction.customId === "modal_link_steam") {
        const inputSteamId = interaction.fields.getTextInputValue("steam_id").trim();

        const player = await findPlayer({ steamId: inputSteamId });

        if (!player) {
            return void interaction.reply({
                content: `❌ Игрок с SteamID \`${inputSteamId}\` не найден в базе данных сервера. Убедитесь, что вы заходили на сервер.`,
                ephemeral: true
            });
        }

        if (isDiscIdLinked(player.DiscID) && String(player.DiscID) !== interaction.user.id) {
            return void interaction.reply({
                content: `❌ Данный игровой аккаунт (**${player.pName}**) уже привязан к другому пользователю Discord!`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // Обновление базы данных
        await updatePlayerField(player.pUID, 'pDiscord', 1);
        await updatePlayerField(player.pUID, 'DiscID', interaction.user.id);

        // Выдача роли "Привязан"
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (member && LINKED_ROLE_ID && LINKED_ROLE_ID !== 'ВАШED_ROLE_ID_ЗДЕСЬ') {
                await member.roles.add(LINKED_ROLE_ID);
            }
        } catch (roleError) {
            console.error('Ошибка при выдаче роли "Привязан":', roleError);
        }

        // Синхронизация всех остальных ролей и никнейма
        const updatedPlayer = await findPlayer({ steamId: inputSteamId });
        if (updatedPlayer) {
            await syncPlayerProfile(interaction.guild as any, updatedPlayer);
        }

        await sendLog('INFO', 'Auth', `Пользователь \`${interaction.user.tag}\` (${interaction.user.id}) успешно привязал аккаунт **${player.pName}** (pUID: \`${player.pUID}\`)`);

        return void interaction.editReply({
            content: `🎉 **Успешно!** Ваш Discord-аккаунт привязан к персонажу **${player.pName}**.\nВам выдана роль привязки, а также обновлены ваши звания и никнейм!`
        });
    }

    // 3. Нажатие на кнопку "Синхронизировать роли"
    if (interaction.isButton() && interaction.customId === "btn_sync_roles") {
        await interaction.deferReply({ ephemeral: true });

        const player = await findPlayer({ discordId: interaction.user.id });

        if (!player || !isDiscIdLinked(player.DiscID)) {
            return void interaction.editReply({
                content: '❌ Ваш Discord-аккаунт еще не привязан ни к одному игровому профилю.\nНажмите кнопку **«Привязать аккаунт»**.'
            });
        }

        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (member && LINKED_ROLE_ID && !member.roles.cache.has(LINKED_ROLE_ID)) {
                await member.roles.add(LINKED_ROLE_ID);
            }
        } catch (e) {

        }

        // Синхронизация ролей и никнейма
        const { roleSuccess, nameSuccess } = await syncPlayerProfile(interaction.guild as any, player);

        await sendLog('INFO', 'Sync', `Пользователь \`${interaction.user.tag}\` запустил ручную синхронизацию ролей для **${player.pName}**.`);

        return void interaction.editReply({
            content: `✅ **Синхронизация завершена!**\n- Статус ролей: ${roleSuccess ? 'Обновлены ✅' : 'Ошибка / Без изменений ⚠️'}\n- Статус никнейма: ${nameSuccess ? 'Обновлен ✅' : 'Без изменений / Недостаточно прав ⚠️'}`
        });
    }
};

export default handler;