import { 
    Interaction, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    PermissionsBitField,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { getAllPromocodes, getPromocode, deletePromocode } from '../../../database/queries/promo.queries';

export default async function (interaction: Interaction) {
    // 1. ОБРАБОТКА ВЫПАДАЮЩЕГО СПИСКА
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_promo_manage') {
        const selectedName = interaction.values[0];

        if (!selectedName) return;

        const promo = await getPromocode(selectedName);

        if (!promo) {
            return void interaction.reply({ content: '❌ Промокод не найден.', ephemeral: true });
        }

        let activationsCount = 0;
        if (promo.UsedUsers) {
            try {
                activationsCount = JSON.parse(promo.UsedUsers).length;
            } catch {
                activationsCount = 0;
            }
        }

        let expireStr = '♾️ Бессрочно';
        if (promo.ExpiresAt) {
            const expDate = new Date(promo.ExpiresAt);
            const timestamp = Math.floor(expDate.getTime() / 1000);
            expireStr = `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Управление промокодом: ${promo.Name}`)
            .setColor('#3b82f6')
            .addFields(
                { name: '🗝️ Название', value: `\`${promo.Name}\``, inline: true },
                { name: '⭐ Награда', value: `+${promo.PromoEXP} EXP`, inline: true },
                { name: '👥 Доступно активаций', value: `${promo.PromoActiv}`, inline: true },
                { name: '📊 Успешно использовали', value: `${activationsCount} чел.`, inline: true },
                { name: '⏳ Срок действия', value: expireStr, inline: false }
            )
            .setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_edit_promo:${promo.Name}`)
                .setLabel('Редактировать')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`btn_delete_promo:${promo.Name}`)
                .setLabel('Удалить')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger)
        );

        return void interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
    }

    if (!interaction.isButton()) return;

    // 2. ОТКРЫТИЕ ОКНА СОЗДАНИЯ ПРОМОКОДА
    if (interaction.customId === 'btn_create_promo') {
        const modal = new ModalBuilder()
            .setCustomId('modal_create_promo')
            .setTitle('Создание нового промокода');

        const nameInput = new TextInputBuilder()
            .setCustomId('promo_name')
            .setLabel('Название промокода')
            .setPlaceholder('Например: WarSpectra2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const expInput = new TextInputBuilder()
            .setCustomId('promo_exp')
            .setLabel('Количество EXP')
            .setPlaceholder('Например: 1000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const activInput = new TextInputBuilder()
            .setCustomId('promo_activations')
            .setLabel('Максимум активаций')
            .setPlaceholder('Например: 50')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const expiresInput = new TextInputBuilder()
            .setCustomId('promo_expires')
            .setLabel('Дата окончания (ДД.ММ.ГГГГ ЧЧ:ММ) или пусто')
            .setPlaceholder('Например: 31.12.2026 23:59 (пусто = бессрочно)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(expInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(activInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(expiresInput)
        );

        return await interaction.showModal(modal);
    }

    // 3. КНОПКА «СПИСОК ПРОМОКОДОВ»
    if (interaction.customId === 'btn_list_promo') {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на просмотр списка промокодов.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const promos = await getAllPromocodes();

        if (promos.length === 0) {
            return void interaction.editReply({ content: '📜 В базе данных пока нет промокодов.' });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_promo_manage')
            .setPlaceholder('Выберите промокод для управления...');

        for (const promo of promos.slice(0, 25)) {
            selectMenu.addOptions({
                label: promo.Name,
                description: `+${promo.PromoEXP} EXP | Ост: ${promo.PromoActiv}`,
                value: promo.Name,
                emoji: '🗝️'
            });
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        return void interaction.editReply({ 
            content: '📋 **Выберите промокод из списка ниже для редактирования или удаления:**', 
            components: [row] 
        });
    }

    // 4. КНОПКА «РЕДАКТИРОВАТЬ»
    if (interaction.customId.startsWith('btn_edit_promo:')) {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на изменение промокодов.', ephemeral: true });
        }

        // Разделяем id безопасным образом, гарантируя получение строки
        const promoName = interaction.customId.split(':')[1] ?? '';
        const promo = await getPromocode(promoName);

        if (!promo) {
            return void interaction.reply({ content: '❌ Промокод не найден.', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId(`modal_edit_promo:${promo.Name}`)
            .setTitle(`Редактирование: ${promo.Name}`);

        const expInput = new TextInputBuilder()
            .setCustomId('promo_exp')
            .setLabel('Количество EXP')
            .setValue(String(promo.PromoEXP))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const activInput = new TextInputBuilder()
            .setCustomId('promo_activations')
            .setLabel('Максимум активаций (остаток)')
            .setValue(String(promo.PromoActiv))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        let dateFormatted = '';
        if (promo.ExpiresAt) {
            const d = new Date(promo.ExpiresAt);
            const pad = (n: number) => String(n).padStart(2, '0');
            dateFormatted = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        const expiresInput = new TextInputBuilder()
            .setCustomId('promo_expires')
            .setLabel('Дата окончания (ДД.ММ.ГГГГ ЧЧ:ММ) или пусто')
            .setValue(dateFormatted)
            .setPlaceholder('Например: 31.12.2026 23:59')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(expInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(activInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(expiresInput)
        );

        return await interaction.showModal(modal);
    }

    // 5. КНОПКА «УДАЛИТЬ»
    if (interaction.customId.startsWith('btn_delete_promo:')) {
        if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
            return void interaction.reply({ content: '❌ У вас нет прав на удаление промокодов.', ephemeral: true });
        }

        // Защищаем тип через fallback на пустую строку
        const promoName = interaction.customId.split(':')[1] ?? '';
        const deleted = await deletePromocode(promoName);

        if (deleted) {
            return void interaction.reply({ 
                content: `✅ Промокод **${promoName}** успешно удалён из базы данных!`, 
                ephemeral: true 
            });
        } else {
            return void interaction.reply({ 
                content: `❌ Ошибка при удалении промокода **${promoName}**.`, 
                ephemeral: true 
            });
        }
    }

    // 6. КНОПКА «ВВЕСТИ ПРОМОКОД»
    if (interaction.customId === 'btn_open_promo') {
        const modal = new ModalBuilder()
            .setCustomId('modal_use_promo')
            .setTitle('Активация промокода');

        const codeInput = new TextInputBuilder()
            .setCustomId('promo_code')
            .setLabel('Введите ваш промокод')
            .setPlaceholder('Например: WarSpectra2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput)
        );

        return await interaction.showModal(modal);
    }
}