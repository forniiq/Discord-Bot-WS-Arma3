import { EventHandler } from 'commandkit';
import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    StringSelectMenuBuilder
} from 'discord.js';
import { findPlayer, updatePlayerField } from '@/database/queries';
import { buildPlayerDashboard } from '@/utils/dashboard';
import { TOGGLE_CATEGORIES, RANKS, UNITS } from '@/config/editCategories';
import { parseArmaArray, selectedValuesToArmaArray } from '@/utils/arrayParser';
import { sendLog } from '@/utils/logger';
import { syncPlayerProfile } from '@/services/playerSyncService';

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild) return;

    // 1. Выбор категории из главного меню
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("edit_select_category:")) {
        const pUID = interaction.customId.split(":")[1];
        if (!pUID) return;

        const selectedCategory = interaction.values[0];
        const player = await findPlayer({ steamId: pUID });
        if (!player) {
            return void interaction.reply({ content: "❌ Игрок не найден в базе данных.", ephemeral: true });
        }

        // А) Модальное окно (Ник, Опыт, Карма)
        if (selectedCategory === "modal_main") {
            const modal = new ModalBuilder()
                .setCustomId(`modal_save_main:${pUID}`)
                .setTitle(`Редактирование: ${player.pName}`);

            const cleanName = player.pName.replace(/^\[.*?\]\s*/, '').trim();

            const nameInput = new TextInputBuilder()
                .setCustomId("pName")
                .setLabel("Никнейм игрока")
                .setValue(cleanName)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const expInput = new TextInputBuilder()
                .setCustomId("pExp")
                .setLabel("Количество опыта (pExp)")
                .setValue(String(player.pExp ?? 0))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const karmaInput = new TextInputBuilder()
                .setCustomId("pKarma")
                .setLabel("Карма (pKarma)")
                .setValue(String(player.pKarma ?? 0))
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(expInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(karmaInput)
            );

            return void await interaction.showModal(modal);
        }

        // Б) Выбор звания
        if (selectedCategory === "select_rank") {
            const rankMenu = new StringSelectMenuBuilder()
                .setCustomId(`save_rank:${pUID}`)
                .setPlaceholder("Выберите новое звание");

            RANKS.forEach((rank, idx) => {
                rankMenu.addOptions({
                    label: rank,
                    value: String(idx),
                    default: String(idx) === String(player.pLvl)
                });
            });

            return void await interaction.update({
                content: "🪖 Выберите новое звание для игрока:",
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(rankMenu)]
            });
        }

        // В) Выбор отряда
        if (selectedCategory === "select_unit") {
            const unitMenu = new StringSelectMenuBuilder()
                .setCustomId(`save_unit:${pUID}`)
                .setPlaceholder("Выберите отряд");

            Object.entries(UNITS).forEach(([id, name]) => {
                unitMenu.addOptions({
                    label: name,
                    value: id,
                    default: id === player.pUnits
                });
            });

            return void await interaction.update({
                content: "📡 Выберите отряд для игрока:",
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(unitMenu)]
            });
        }

        // Г) Флажки / Допуски
        const categoryConfig = TOGGLE_CATEGORIES[selectedCategory as keyof typeof TOGGLE_CATEGORIES];
        if (categoryConfig) {
            const currentArray = parseArmaArray((player as any)[categoryConfig.dbColumn]);
            
            const toggleMenu = new StringSelectMenuBuilder()
                .setCustomId(`save_toggles:${pUID}:${categoryConfig.dbColumn}`)
                .setPlaceholder(`Отметьте галочками (${categoryConfig.title})`)
                .setMinValues(0)
                .setMaxValues(categoryConfig.options.length);

            categoryConfig.options.forEach((optName, index) => {
                toggleMenu.addOptions({
                    label: optName,
                    value: String(index),
                    default: currentArray[index] === 1
                });
            });

            return void await interaction.update({
                content: `☑️ **Отметьте нужные допуски для категории ${categoryConfig.title}:**`,
                components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(toggleMenu)]
            });
        }
    }

    // 2. Сохранение Звания / Отряда
    if (interaction.isStringSelectMenu() && (interaction.customId.startsWith("save_rank:") || interaction.customId.startsWith("save_unit:"))) {
        const parts = interaction.customId.split(":");
        const action = parts[0];
        const pUID = parts[1];
        if (!pUID) return;

        const selectedVal = interaction.values[0];
        const field = action === "save_rank" ? "pLvl" : "pUnits";

        await updatePlayerField(pUID, field, selectedVal);
        let updatedPlayer = await findPlayer({ steamId: pUID });
        if (!updatedPlayer) return;

        // Синхронизируем роли и никнейм в Discord (гильдия передается как any для предотвращения TS ошибки)
        await syncPlayerProfile(interaction.guild as any, updatedPlayer);
        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        // Логирование
        const fieldName = field === "pLvl" ? "Звание" : "Отряд";
        await sendLog('INFO', 'AdminEdit', `Администратор \`${interaction.user.tag}\` изменил **${fieldName}** игроку \`${updatedPlayer.pName}\` (pUID: ${pUID})`);

        const dashboard = buildPlayerDashboard(updatedPlayer);
        return void await interaction.update({ content: "✅ Изменения сохранены и роли синхронизированы!", ...dashboard });
    }

    // 3. Сохранение Флажков / Допусков
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("save_toggles:")) {
        const parts = interaction.customId.split(":");
        const pUID = parts[1];
        const dbColumn = parts[2];
        if (!pUID || !dbColumn) return;

        const selectedIndexes = interaction.values;
        const category = Object.values(TOGGLE_CATEGORIES).find(c => c.dbColumn === dbColumn);
        if (!category) return;

        const newArmaString = selectedValuesToArmaArray(selectedIndexes, category.options.length);
        await updatePlayerField(pUID, dbColumn, newArmaString);

        let updatedPlayer = await findPlayer({ steamId: pUID });
        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);
        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog('INFO', 'AdminEdit', `Администратор \`${interaction.user.tag}\` обновил категорию **${category.title}** игроку \`${updatedPlayer.pName}\``);

        const dashboard = buildPlayerDashboard(updatedPlayer);
        return void await interaction.update({ content: "✅ Допуски обновлены и роли синхронизированы!", ...dashboard });
    }

    // 4. Сохранение Модального Окна (Ручная смена никнейма, опыта, кармы)
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_save_main:")) {
        const pUID = interaction.customId.split(":")[1];
        if (!pUID) return;

        const newName = interaction.fields.getTextInputValue("pName");
        const newExp = parseInt(interaction.fields.getTextInputValue("pExp"), 10) || 0;
        const newKarma = parseInt(interaction.fields.getTextInputValue("pKarma"), 10) || 0;

        await updatePlayerField(pUID, "pName", newName);
        await updatePlayerField(pUID, "pExp", newExp);
        await updatePlayerField(pUID, "pKarma", newKarma);

        let updatedPlayer = await findPlayer({ steamId: pUID });
        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);
        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog('INFO', 'AdminEdit', `Администратор \`${interaction.user.tag}\` изменил общие данные (Ник/Опыт/Карма) игроку \`${updatedPlayer.pName}\``);

        await interaction.deferUpdate();
        const dashboard = buildPlayerDashboard(updatedPlayer);
        return void await interaction.editReply({ content: "✅ Данные обновлены!", ...dashboard });
    }
};

export default handler;