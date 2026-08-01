import { findPlayer } from '@/database/queries';
import { buildPlayerDashboard } from '@/utils/dashboard';

export async function openEditPanel(options: {
    interaction: any;
    targetDiscordUser?: any;
    pUID?: string;
}) {
    const interaction = options.interaction?.interaction || options.interaction;
    const { targetDiscordUser, pUID } = options;

    if (interaction?.deferReply && !interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
    }

    let player = null;

    if (targetDiscordUser) {
        player = await findPlayer({ discordId: targetDiscordUser.id });
    } else if (pUID) {
        player = await findPlayer({ steamId: pUID });
    }

    if (!player) {
        const messageContent = '❌ **Игрок не найден в базе данных.** Убедитесь, что у него привязан Discord или введен верный SteamID.';
        
        if (interaction.editReply) {
            return void await interaction.editReply({ content: messageContent });
        } else {
            return void await interaction.reply({ content: messageContent, ephemeral: true });
        }
    }

    const dashboard = buildPlayerDashboard(player);

    const replyData = {
        content: `🛠 **Панель управления игроком:** ${player.pName}`,
        ...dashboard
    };

    if (interaction.editReply) {
        return void await interaction.editReply(replyData);
    } else {
        return void await interaction.reply({ ...replyData, ephemeral: true });
    }
}