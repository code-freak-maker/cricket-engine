const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

async function handleToss(interaction, teamA, teamB, stadium, matchMessage) {

  let content = `🏏 **${teamA.teamName} vs ${teamB.teamName}**
📍 Stadium: ${stadium.name} (${stadium.type})
🌍 Location: ${stadium.country}

🎲 **TOSS TIME!**
${teamB.teamName}, choose Heads or Tails.
`;

  const tossButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("heads").setLabel("🪙 HEADS").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tails").setLabel("🪙 TAILS").setStyle(ButtonStyle.Primary)
  );

  await matchMessage.edit({ content, components: [tossButtons] });

  let tossWinnerTeam;
  let tossDecision;
  let selectedBy = "Unknown";

  try {
    let tossResolved = false;

    const tossInteraction = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30000,
      filter: i => {
        if (tossResolved) {
          i.reply({ content: "⛔ Toss already decided!", ephemeral: true }).catch(() => { });
          return false;
        }
        return true;
      }
    });
    tossResolved = true;

    selectedBy = tossInteraction.user.username;
    const userChoice = tossInteraction.customId;

    const coinFlip = Math.random() < 0.5 ? "heads" : "tails";

    tossWinnerTeam = userChoice === coinFlip ? teamB : teamA;

    content = `🏏 **${teamA.teamName} vs ${teamB.teamName}**
📍 Stadium: ${stadium.name} (${stadium.type})
🌍 Location: ${stadium.country}

🎲 **TOSS TIME!**
🪙 Coin landed on **${coinFlip.toUpperCase()}**!
**${tossWinnerTeam.teamName}** wins the toss! (selected by **${selectedBy}**)
`;

    await tossInteraction.update({ content, components: [] });

  } catch (e) {
    const coinFlip = Math.random() < 0.5 ? "heads" : "tails";
    tossWinnerTeam = Math.random() < 0.5 ? teamA : teamB;

    content = `🏏 **${teamA.teamName} vs ${teamB.teamName}**
📍 Stadium: ${stadium.name} (${stadium.type})
🌍 Location: ${stadium.country}

🎲 **TOSS TIME!**
⏰ Auto toss: **${coinFlip.toUpperCase()}**
**${tossWinnerTeam.teamName}** wins the toss!
`;

    await matchMessage.edit({ content, components: [] });
  }

  // BAT / BOWL
  const decisionButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bat").setLabel("🏏 BAT FIRST").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("bowl").setLabel("🧤 BOWL FIRST").setStyle(ButtonStyle.Primary)
  );

  content += `\n${tossWinnerTeam.teamName}, choose to bat or bowl.\n`;

  await matchMessage.edit({ content, components: [decisionButtons] });

  try {
    const decisionInteraction = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 30000
    });

    const selectedByDecision = decisionInteraction.user.username;
    tossDecision = decisionInteraction.customId;

    content += `\n**${tossWinnerTeam.teamName}** chooses to **${tossDecision === "bat" ? "BAT FIRST" : "BOWL FIRST"}** (selected by **${selectedByDecision}**)`;

    await decisionInteraction.update({ content, components: [] });

  } catch (e) {
    tossDecision = "bat";
    content += `\n⏰ Auto-selected: **BAT FIRST**`;
    await matchMessage.edit({ content, components: [] });
  }

  return { tossWinnerTeam, tossDecision };
}

module.exports = { handleToss };