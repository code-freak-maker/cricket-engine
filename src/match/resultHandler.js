// match/resultHandler.js
const { createMatchSummaryEmbed, createInningsScorecardEmbed } = require("../utils/uiHelper");

async function saveAndAnnounceResult(interaction, matchState, innings1Stats, innings2Stats, target) {
  const { teamA, teamB, stadium } = matchState;

  let teamABattedFirst = matchState.teamABattedFirst;

  if (teamABattedFirst === undefined || teamABattedFirst === null) {
    // Fallback: Check if battingOrder in innings 1 contains teamA players
    const innings1FirstBatsman = Object.keys(innings1Stats.batsmanStats)[0];
    const isTeamABatsman = teamA.players.some(p => p.toLowerCase() === innings1FirstBatsman?.toLowerCase());
    teamABattedFirst = isTeamABatsman;
  }

  const innings1BattingTeam = teamABattedFirst ? teamA.teamName : teamB.teamName;
  const innings2BattingTeam = teamABattedFirst ? teamB.teamName : teamA.teamName;

  let winner, wonBy;
  let runsMargin, wicketsLeft;

  if (innings2Stats.runs >= target) {
    winner = innings2BattingTeam
    const wicketsLeft = 10 - innings2Stats.wickets;
    wonBy = `${wicketsLeft} wickets`;
  } else {
    winner = innings1BattingTeam;
    runsMargin = target - 1 - innings2Stats.runs;
    wonBy = `${runsMargin} runs`;
  }

  // Show both innings scorecards before match summary
  const innings1ScorecardEmbed = createInningsScorecardEmbed(
    1,
    innings1BattingTeam,
    innings1Stats.runs,
    innings1Stats.wickets,
    innings1Stats.overs,
    innings1Stats.batsmanStats,
    innings1Stats.bowlerStats
  );

  const innings2ScorecardEmbed = createInningsScorecardEmbed(
    2,
    innings2BattingTeam,
    innings2Stats.runs,
    innings2Stats.wickets,
    innings2Stats.overs,
    innings2Stats.batsmanStats,
    innings2Stats.bowlerStats,
    target
  );

  await interaction.channel.send({ embeds: [innings1ScorecardEmbed] });
  await interaction.channel.send({ embeds: [innings2ScorecardEmbed] });

  const teamAObj = { teamName: innings1BattingTeam };
  const teamBObj = { teamName: innings2BattingTeam };

  // Create and send match summary embed with top performers
  const matchSummaryEmbed = createMatchSummaryEmbed(
    innings1Stats, innings2Stats, teamAObj, teamBObj, winner, wonBy, stadium
  );

  await interaction.channel.send({ embeds: [matchSummaryEmbed] });

  // Send winner announcement
  let winnerMessage = `\n🏆 **${winner} WINS!** 🏆\n`;
  winnerMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  winnerMessage += `✅ **${winner}** won by **${wonBy}**\n`;
  winnerMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  await interaction.channel.send(winnerMessage);

  return { winner, wonBy };
}

module.exports = {
  saveAndAnnounceResult
};