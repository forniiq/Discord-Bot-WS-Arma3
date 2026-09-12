import { EventHandler } from 'commandkit';
import { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { findPlayer, updatePlayerField } from '@/database/queries';
import { buildPlayerDashboard } from '@/utils/dashboard.utils';
import {
    TOGGLE_CATEGORIES,
    RANKS,
    UNITS,
    PRESET_COLORS,
    ADMIN_LEVELS,
    ADMIN_PANEL_OPTIONS
} from '@/config/edit-сategories';
import { parseArmaArray, selectedValuesToArmaArray } from '@/utils/array-parser.utils';
import { sendLog } from '@/utils/logger.utils';
import { syncPlayerProfile } from '@/services/player-sync.service';
import { requireOperator } from '@/utils/operator.utils';

const handler: EventHandler<"interactionCreate"> = async (interaction) => {
    if (!interaction.guild) return;

    if (
        !interaction.isStringSelectMenu() &&
        !interaction.isButton() &&
        !interaction.isModalSubmit()
    ) return;

    // 1. Выбор категории из главного меню
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("edit_select_category:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }


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
        if (selectedCategory === "admin") {
            const adminArray = parseArmaArray(player.pAdmin);

            const currentAdminLevel = adminArray[0] ?? 0;
            const currentAdminPanel = adminArray[1] ?? 0;
            const currentExpBonus = adminArray[3] ?? 0;

            // SelectMenu уровня администрации
            const adminLevelMenu = new StringSelectMenuBuilder()
                .setCustomId(`save_admin_level:${pUID}`)
                .setPlaceholder("Выберите уровень администрации");

            Object.entries(ADMIN_LEVELS).forEach(([value, label]) => {
                adminLevelMenu.addOptions({
                    label,
                    value,
                    default: Number(value) === currentAdminLevel
                });
            });

            // SelectMenu доступа к ВП-панели
            const adminPanelMenu = new StringSelectMenuBuilder()
                .setCustomId(`save_admin_panel:${pUID}`)
                .setPlaceholder("Доступ к ВП-панели");

            Object.entries(ADMIN_PANEL_OPTIONS).forEach(([value, label]) => {
                adminPanelMenu.addOptions({
                    label,
                    value,
                    default: Number(value) === currentAdminPanel
                });
            });

            // Кнопка изменения бонуса к опыту
            const bonusButton = new ButtonBuilder()
                .setCustomId(`edit_admin_bonus:${pUID}`)
                .setLabel("✏️ Изменить бонус к опыту")
                .setStyle(ButtonStyle.Secondary);

            return void await interaction.update({
                content:
                    `🛡️ **Редактирование админ-прав игрока:** ${player.pName}\n\n` +
                    `**Текущие значения:**\n` +
                    `• Уровень администрации: ${ADMIN_LEVELS[String(currentAdminLevel)] ?? "Неизвестно"}\n` +
                    `• ВП-панель: ${currentAdminPanel === 1 ? "Есть доступ" : "Нет доступа"}\n` +
                    `• Бонус к опыту: ${currentExpBonus}\n\n` +
                    `Выберите, что хотите изменить:`,
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(adminLevelMenu),
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(adminPanelMenu),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(bonusButton)
                ]
            });
        }

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

        // Д) Выбор изменения префикса (pTitle)
        if (selectedCategory === "edit_title") {
            const colorMenu = new StringSelectMenuBuilder()
                .setCustomId(`preset_title_color:${pUID}`)
                .setPlaceholder("🎨 Выберите готовый цвет префикса...");

            PRESET_COLORS.forEach(preset => {
                colorMenu.addOptions({
                    label: preset.label,
                    value: preset.value,
                    emoji: preset.emoji
                });
            });

            const manualButton = new ButtonBuilder()
                .setCustomId(`manual_title_prompt:${pUID}`)
                .setLabel("✍️ Ввести свой HEX вручную")
                .setStyle(ButtonStyle.Secondary);

            const rowMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(colorMenu);
            const rowButton = new ActionRowBuilder<ButtonBuilder>().addComponents(manualButton);

            return void await interaction.update({
                content: "🏷️ **Настройка кастомного префикса (pTitle)**\nВыберите готовый цвет из списка ниже или нажмите кнопку ручного ввода для указания своего HEX-кода:",
                components: [rowMenu, rowButton]
            });
        }
    }

    // 2. Сохранение Звания / Отряда
    if (interaction.isStringSelectMenu() && (interaction.customId.startsWith("save_rank:") || interaction.customId.startsWith("save_unit:"))) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

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
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("save_admin_level:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];

        if (!pUID) return;

        const newAdminLevel = Number(interaction.values[0]);

        if (!Number.isInteger(newAdminLevel) || newAdminLevel < 0 || newAdminLevel > 7) {
            return void interaction.reply({
                content: "❌ Некорректный уровень администрации.",
                ephemeral: true
            });
        }

        const player = await findPlayer({ steamId: pUID });

        if (!player) {
            return void interaction.reply({
                content: "❌ Игрок не найден в базе данных.",
                ephemeral: true
            });
        }

        const adminArray = parseArmaArray(player.pAdmin);

        while (adminArray.length < 4) {
            adminArray.push(0);
        }

        // Меняем только индекс 0
        adminArray[0] = newAdminLevel;

        await updatePlayerField(
            pUID,
            "pAdmin",
            JSON.stringify(adminArray)
        );

        let updatedPlayer = await findPlayer({ steamId: pUID });

        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);

        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog(
            'INFO',
            'AdminEdit',
            `Администратор \`${interaction.user.tag}\` изменил уровень администрации игроку \`${updatedPlayer.pName}\` на **${ADMIN_LEVELS[String(newAdminLevel)]}**`
        );

        const dashboard = buildPlayerDashboard(updatedPlayer);

        return void await interaction.update({
            content: "✅ Уровень администрации обновлён и роли синхронизированы!",
            ...dashboard
        });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("save_admin_panel:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];

        if (!pUID) return;

        const newAdminPanel = Number(interaction.values[0]);

        if (newAdminPanel !== 0 && newAdminPanel !== 1) {
            return void interaction.reply({
                content: "❌ Некорректное значение ВП-панели.",
                ephemeral: true
            });
        }

        const player = await findPlayer({ steamId: pUID });

        if (!player) {
            return void interaction.reply({
                content: "❌ Игрок не найден в базе данных.",
                ephemeral: true
            });
        }

        const adminArray = parseArmaArray(player.pAdmin);

        while (adminArray.length < 4) {
            adminArray.push(0);
        }

        // Меняем только индекс 1
        adminArray[1] = newAdminPanel;

        await updatePlayerField(
            pUID,
            "pAdmin",
            JSON.stringify(adminArray)
        );

        let updatedPlayer = await findPlayer({ steamId: pUID });

        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);

        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog(
            'INFO',
            'AdminEdit',
            `Администратор \`${interaction.user.tag}\` изменил доступ к ВП-панели игроку \`${updatedPlayer.pName}\` на **${newAdminPanel === 1 ? "включён" : "выключен"}**`
        );

        const dashboard = buildPlayerDashboard(updatedPlayer);

        return void await interaction.update({
            content: "✅ Доступ к ВП-панели обновлён и роли синхронизированы!",
            ...dashboard
        });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("save_toggles:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

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
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

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

    // 5. Обработка выбора цвета из готового пресета (выпадающий список)
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("preset_title_color:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];
        const selectedHex = interaction.values[0]; 
        if (!pUID) return;

        const modal = new ModalBuilder()
            .setCustomId(`modal_save_preset_title:${pUID}:${selectedHex}`)
            .setTitle(`Ввод текста префикса`);

        const textInput = new TextInputBuilder()
            .setCustomId("titleText")
            .setLabel("Текст префикса (оставьте пустым для сброса)")
            .setPlaceholder("Например: Старший Администратор")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
        return void await interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId.startsWith("edit_admin_bonus:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];

        if (!pUID) return;

        const player = await findPlayer({ steamId: pUID });

        if (!player) {
            return void interaction.reply({
                content: "❌ Игрок не найден в базе данных.",
                ephemeral: true
            });
        }

        const adminArray = parseArmaArray(player.pAdmin);
        const currentExpBonus = adminArray[3] ?? 0;

        const modal = new ModalBuilder()
            .setCustomId(`modal_save_admin_bonus:${pUID}`)
            .setTitle("Изменение бонуса к опыту");

        const bonusInput = new TextInputBuilder()
            .setCustomId("expBonus")
            .setLabel("Бонус к опыту")
            .setPlaceholder("Например: 0.3, 1, 1.2")
            .setValue(String(currentExpBonus))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(bonusInput)
        );

        return void await interaction.showModal(modal);
    }

    // 6. Обработка нажатия на кнопку "Ввести свой HEX вручную"
    if (interaction.isButton() && interaction.customId.startsWith("manual_title_prompt:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];
        if (!pUID) return;

        const modal = new ModalBuilder()
            .setCustomId(`modal_save_custom_title:${pUID}`)
            .setTitle(`Ручной ввод префикса и цвета`);

        const textInput = new TextInputBuilder()
            .setCustomId("titleText")
            .setLabel("Текст префикса")
            .setPlaceholder("Например: Табакошка")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const colorInput = new TextInputBuilder()
            .setCustomId("titleHex")
            .setLabel("HEX цвет (Пример: #FF1493)")
            .setValue("#FFFFFF")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(textInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput)
        );

        return void await interaction.showModal(modal);
    }

    // 7. Сохранение префикса (после выбора цвета из пресета)
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_save_preset_title:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const [, pUID, hexColor] = interaction.customId.split(":");
        const text = interaction.fields.getTextInputValue("titleText").trim();
        if (!pUID) return;

        // Если текст пустой — очищаем префикс, иначе записываем в формате #FF1493FFТекст
        const finalTitle = text ? `${hexColor}FF${text}` : "";

        await updatePlayerField(pUID, "pTitle", finalTitle);

        let updatedPlayer = await findPlayer({ steamId: pUID });
        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);
        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog('INFO', 'AdminEdit', `Администратор \`${interaction.user.tag}\` установил префикс игроку \`${updatedPlayer.pName}\`: \`${finalTitle}\``);

        await interaction.deferUpdate();
        const dashboard = buildPlayerDashboard(updatedPlayer);
        return void await interaction.editReply({ content: "✅ Кастомный префикс успешно обновлен!", ...dashboard });
    }

    // 8. Сохранение префикса (после ручного ввода HEX)
    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_save_custom_title:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];
        const text = interaction.fields.getTextInputValue("titleText").trim();
        let hex = interaction.fields.getTextInputValue("titleHex").trim();
        if (!pUID) return;

        if (!hex.startsWith("#")) {
            hex = `#${hex}`;
        }

        const finalTitle = text ? `${hex}FF${text}` : "";

        await updatePlayerField(pUID, "pTitle", finalTitle);

        let updatedPlayer = await findPlayer({ steamId: pUID });
        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);
        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog('INFO', 'AdminEdit', `Администратор \`${interaction.user.tag}\` установил ручной префикс игроку \`${updatedPlayer.pName}\`: \`${finalTitle}\``);

        await interaction.deferUpdate();
        const dashboard = buildPlayerDashboard(updatedPlayer);
        return void await interaction.editReply({ content: "✅ Кастомный префикс (ручной ввод) успешно обновлен!", ...dashboard });
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_save_admin_bonus:")) {
        if (!(await requireOperator(interaction.user.id))) {
            return void interaction.reply({
                content: '❌ У вас нет доступа к этому действию.',
                ephemeral: true
            });
        }

        const pUID = interaction.customId.split(":")[1];

        if (!pUID) return;

        const bonusText = interaction.fields
            .getTextInputValue("expBonus")
            .trim();

        if (!bonusText) {
            return void interaction.reply({
                content: "❌ Введите бонус к опыту.",
                ephemeral: true
            });
        }

        const newExpBonus = Number(bonusText);

        if (!Number.isFinite(newExpBonus) || newExpBonus < 0) {
            return void interaction.reply({
                content: "❌ Некорректный бонус к опыту. Введите число, например `0.3`, `1` или `1.2`.",
                ephemeral: true
            });
        }

        if (!Number.isFinite(newExpBonus) || newExpBonus < 0) {
            return void interaction.reply({
                content: "❌ Некорректный бонус к опыту. Введите число, например `0.3`, `1` или `1.2`.",
                ephemeral: true
            });
        }

        const player = await findPlayer({ steamId: pUID });

        if (!player) {
            return void interaction.reply({
                content: "❌ Игрок не найден в базе данных.",
                ephemeral: true
            });
        }

        const adminArray = parseArmaArray(player.pAdmin);

        while (adminArray.length < 4) {
            adminArray.push(0);
        }

        // Меняем только индекс 3
        adminArray[3] = newExpBonus;

        await updatePlayerField(
            pUID,
            "pAdmin",
            JSON.stringify(adminArray)
        );

        let updatedPlayer = await findPlayer({ steamId: pUID });

        if (!updatedPlayer) return;

        await syncPlayerProfile(interaction.guild as any, updatedPlayer);

        updatedPlayer = (await findPlayer({ steamId: pUID })) || updatedPlayer;

        await sendLog(
            'INFO',
            'AdminEdit',
            `Администратор \`${interaction.user.tag}\` изменил бонус к опыту игроку \`${updatedPlayer.pName}\` на **${newExpBonus}**`
        );

        await interaction.deferUpdate();

        const dashboard = buildPlayerDashboard(updatedPlayer);

        return void await interaction.editReply({
            content: "✅ Бонус к опыту обновлён и роли синхронизированы!",
            ...dashboard
        });
    }
};

export default handler;