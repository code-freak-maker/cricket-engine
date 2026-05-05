// match/inningsHandler.js
const { playOver } = require("./overHandler");
const { createInningsScorecardEmbed } = require("../utils/uiHelper");
const matchManager = require("../managers/matchManager");

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function simulateInnings(interaction, matchState, playersMap, stadium, inningNumber, target = null) {
  const { channelId, maxOvers } = matchState;

  let inningsMessage = `\n🏏 **INNINGS ${inningNumber}** 🏏\n`;
  inningsMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  inningsMessage += `📋 **${matchState.battingTeam.teamName} Batting**\n`;
  inningsMessage += `👥 Openers: **${matchState.battingOrder[0]}** ★ **${matchState.battingOrder[1]}**\n`;
  if (target) {
    inningsMessage += `🎯 Target: **${target}** runs to win\n`;
  } else {
    inningsMessage += `🎯 Target: Set a score\n`;
  }
  inningsMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  await interaction.channel.send(inningsMessage);
  await sleep(2000);

  let overCompleted = 0;
  
  for (let overNumber = 0; overNumber < maxOvers; overNumber++) {
    let currentMatch = matchManager.getMatch(channelId);
    if (!currentMatch || !currentMatch.isActive || currentMatch.stopped) {
      const displayOversCompleted = overCompleted + 1;

      return { 
        runs: matchState.runs, 
        wickets: matchState.wickets, 
        overs: displayOversCompleted,
        batsmanStats: matchState.batsmanStats,
        bowlerStats: matchState.bowlerStats
      };
    }
    if (matchState.wickets >= 10) break;
    if (target && matchState.runs >= target) break;

    matchState.currentOver = overNumber;

    const result = await playOver(
      interaction, matchState, playersMap, stadium, 
      overNumber, inningNumber, target, channelId
    );
    
    overCompleted = overNumber;
    
    if (result?.endReason === "match_stopped") {
      const displayOversCompleted = overCompleted + 1;
      return { 
        runs: matchState.runs, 
        wickets: matchState.wickets, 
        overs: displayOversCompleted,
        batsmanStats: matchState.batsmanStats,
        bowlerStats: matchState.bowlerStats
      };
    }
    
    if (matchState.wickets >= 10 || (target && matchState.runs >= target)) {
      break;
    }
    
    await sleep(2000);
  }

  const displayOversCompleted = overCompleted + 1;

  // End of innings message
  let endMessage = `\n🏁 **END OF INNINGS ${inningNumber}** 🏁\n`;
  endMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  endMessage += `📊 **${matchState.battingTeam.teamName}:** ${matchState.runs}/${matchState.wickets} (${displayOversCompleted} overs)\n`;
  if (overCompleted > 0) {
    endMessage += `📈 Run Rate: ${(matchState.runs / displayOversCompleted).toFixed(2)}\n`;
  }
  endMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  await interaction.channel.send(endMessage);
  await sleep(2000);

  // Show FULL SCORECARD only after innings is complete
  const finalScorecardEmbed = createInningsScorecardEmbed(
    inningNumber, 
    matchState.battingTeam.teamName, 
    matchState.runs, 
    matchState.wickets, 
    displayOversCompleted,
    matchState.batsmanStats, 
    matchState.bowlerStats, 
    target
  );
  await interaction.channel.send({ embeds: [finalScorecardEmbed] });
  await sleep(2000);

  return { 
    runs: matchState.runs, 
    wickets: matchState.wickets, 
    overs: displayOversCompleted,
    batsmanStats: matchState.batsmanStats,
    bowlerStats: matchState.bowlerStats
  };
}

module.exports = { simulateInnings };