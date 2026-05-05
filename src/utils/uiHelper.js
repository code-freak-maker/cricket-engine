const { EmbedBuilder } = require("discord.js");

function createInningsScorecardEmbed(inningNumber, teamName, runs, wickets, overs, batsmanStats, bowlerStats, target = null) {
  const embed = new EmbedBuilder()
    .setTitle(`🏏 ${inningNumber === 1 ? 'FIRST' : 'SECOND'} INNINGS - ${teamName}`)
    .setColor(inningNumber === 1 ? 0x00AE86 : 0xFF6B6B)
    .setTimestamp();

  // Score header
  let scoreText = `**${runs}/${wickets}** (${overs} overs)`;
  if (target && inningNumber === 2) {
    const required = target - runs;
    if (required <= 0) {
      scoreText += `\n✅ **Target achieved!**`;
    } else {
      scoreText += `\n🎯 Need **${required}** runs to win`;
    }
  }
  embed.setDescription(scoreText);

  // BATTING TABLE - Only show batsmen who actually batted
  let battingText = "```\n";
  battingText += "┌────────────────────────────────────────────────────────────┐\n";
  battingText += "│ Batsman                      │ Runs│ Bls│ 4s│ 6s│ SR      │\n";
  battingText += "├────────────────────────────────────────────────────────────┤\n";
  
  // Get only batsmen who have faced balls OR scored runs
  const battedPlayers = Object.values(batsmanStats)
    .filter(b => b.balls > 0 || b.runs > 0)
    .sort((a, b) => b.runs - a.runs);
  
  for (const batsman of battedPlayers) {
    const sr = batsman.balls > 0 ? ((batsman.runs / batsman.balls) * 100).toFixed(1) : "0.0";
    const name = batsman.name.length > 25 ? batsman.name.substring(0, 22) + "..." : batsman.name;
    const dismissal = batsman.dismissed ? "†" : "*";
    
    battingText += `│ ${(name + dismissal).padEnd(25)} │ ${batsman.runs.toString().padStart(3)} │ ${batsman.balls.toString().padStart(3)} │ ${batsman.fours.toString().padStart(2)} │ ${batsman.sixes.toString().padStart(2)} │ ${sr.padStart(6)} │\n`;
  }
  
  // Add separator and "Did Not Bat" section if there are unused players
  const didNotBat = Object.values(batsmanStats)
    .filter(b => b.balls === 0 && b.runs === 0)
    .map(b => b.name);
  
  if (didNotBat.length > 0 && battedPlayers.length < 11) {
    battingText += "├────────────────────────────────────────────────────────────┤\n";
    battingText += "│ 📋 DID NOT BAT                                              │\n";
    // Format as bullet points in a single line or multiple lines
    const dnbs = didNotBat.join(", ");
    if (dnbs.length > 46) {
      // Split into multiple lines if too long
      const chunks = dnbs.match(/.{1,46}/g) || [];
      for (const chunk of chunks) {
        battingText += `│ ${chunk.padEnd(46)} │\n`;
      }
    } else {
      battingText += `│ ${dnbs.padEnd(46)} │\n`;
    }
  }
  
  battingText += "└────────────────────────────────────────────────────────────┘\n```";
  embed.addFields({ name: "📊 BATTING", value: battingText, inline: false });

  // BOWLING TABLE
  let bowlingText = "```\n";
  bowlingText += "┌────────────────────────────────────────────────────────────┐\n";
  bowlingText += "│ Bowler                       │ Overs│ Runs│ Wkts│ Econ    │\n";
  bowlingText += "├────────────────────────────────────────────────────────────┤\n";
  
  const bowlersWhoBowled = Array.from(bowlerStats.values())
    .filter(b => b.overs > 0)
    .sort((a, b) => b.wickets - a.wickets);
  
  for (const bowler of bowlersWhoBowled) {
    const econ = bowler.overs > 0 ? (bowler.runs / bowler.overs).toFixed(2) : "0.00";
    const name = bowler.name.length > 25 ? bowler.name.substring(0, 22) + "..." : bowler.name;
    bowlingText += `│ ${name.padEnd(25)} │ ${bowler.overs.toString().padStart(4)} │ ${bowler.runs.toString().padStart(4)} │ ${bowler.wickets.toString().padStart(4)} │ ${econ.padStart(7)} │\n`;
  }
  
  // Show bowlers who didn't bowl
  const bowlersWhoDidNotBowl = Array.from(bowlerStats.values())
    .filter(b => b.overs === 0)
    .map(b => b.name);
  
  if (bowlersWhoDidNotBowl.length > 0 && bowlersWhoBowled.length < 11) {
    bowlingText += "├────────────────────────────────────────────────────────────┤\n";
    bowlingText += "│ 🎯 DID NOT BOWL                                             │\n";
    const dnbs = bowlersWhoDidNotBowl.join(", ");
    if (dnbs.length > 46) {
      const chunks = dnbs.match(/.{1,46}/g) || [];
      for (const chunk of chunks) {
        bowlingText += `│ ${chunk.padEnd(46)} │\n`;
      }
    } else {
      bowlingText += `│ ${dnbs.padEnd(46)} │\n`;
    }
  }
  
  bowlingText += "└────────────────────────────────────────────────────────────┘\n```";
  embed.addFields({ name: "🎯 BOWLING", value: bowlingText, inline: false });

  return embed;
}

function createMatchSummaryEmbed(innings1Stats, innings2Stats, teamA, teamB, winner, wonBy, stadium) {
  const embed = new EmbedBuilder()
    .setTitle("🏆 MATCH SUMMARY 🏆")
    .setColor(0xFFD700)
    .setDescription(`**${winner}** won by **${wonBy}**`)
    .setTimestamp();

  // Innings 1 Summary
  let innings1Text = `**${teamA.teamName}** - ${innings1Stats.runs}/${innings1Stats.wickets} (${innings1Stats.overs} overs)\n`;
  
  // Top 3 batters from innings 1
  const topBatters1 = Object.values(innings1Stats.batsmanStats)
    .filter(b => b.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 3);
  
  if (topBatters1.length > 0) {
    innings1Text += `\n**🏏 Top Batters:**\n`;
    topBatters1.forEach((b, i) => {
      innings1Text += `${i+1}. ${b.name} - ${b.runs}(${b.balls}b, ${b.fours}×4, ${b.sixes}×6)\n`;
    });
  }
  
  // Top 3 bowlers from innings 1
  const topBowlers1 = Array.from(innings1Stats.bowlerStats.values())
    .filter(b => b.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 3);
  
  if (topBowlers1.length > 0) {
    innings1Text += `\n**🎯 Top Bowlers:**\n`;
    topBowlers1.forEach((b, i) => {
      const econ = (b.runs / b.overs).toFixed(2);
      innings1Text += `${i+1}. ${b.name} - ${b.wickets}/${b.runs} (${b.overs} overs, Econ: ${econ})\n`;
    });
  }

  embed.addFields({ name: "📊 FIRST INNINGS", value: innings1Text, inline: true });

  // Innings 2 Summary
  let innings2Text = `**${teamB.teamName}** - ${innings2Stats.runs}/${innings2Stats.wickets} (${innings2Stats.overs} overs)\n`;
  
  // Top 3 batters from innings 2
  const topBatters2 = Object.values(innings2Stats.batsmanStats)
    .filter(b => b.runs > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 3);
  
  if (topBatters2.length > 0) {
    innings2Text += `\n**🏏 Top Batters:**\n`;
    topBatters2.forEach((b, i) => {
      innings2Text += `${i+1}. ${b.name} - ${b.runs}(${b.balls}b, ${b.fours}×4, ${b.sixes}×6)\n`;
    });
  }
  
  // Top 3 bowlers from innings 2
  const topBowlers2 = Array.from(innings2Stats.bowlerStats.values())
    .filter(b => b.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 3);
  
  if (topBowlers2.length > 0) {
    innings2Text += `\n**🎯 Top Bowlers:**\n`;
    topBowlers2.forEach((b, i) => {
      const econ = (b.runs / b.overs).toFixed(2);
      innings2Text += `${i+1}. ${b.name} - ${b.wickets}/${b.runs} (${b.overs} overs, Econ: ${econ})\n`;
    });
  }

  embed.addFields({ name: "📊 SECOND INNINGS", value: innings2Text, inline: true });

  // Match Stats
  let matchStats = `🏟️ **Venue:** ${stadium.name}\n`;
  matchStats += `🏆 **Winner:** ${winner}\n`;
  matchStats += `📈 **Margin:** ${wonBy}\n`;
  
  // Man of the match (highest scorer from winning team or best bowler)
  let motm = null;
  let motmScore = 0;
  
  if (winner === teamA.teamName) {
    // Check batters from team A
    for (const batsman of Object.values(innings1Stats.batsmanStats)) {
      if (batsman.runs > motmScore) {
        motmScore = batsman.runs;
        motm = batsman;
      }
    }
    // Check bowlers from team A
    for (const bowler of Array.from(innings1Stats.bowlerStats.values())) {
      if (bowler.wickets * 20 > motmScore) {
        motmScore = bowler.wickets * 20;
        motm = { name: bowler.name, runs: bowler.wickets, type: "wickets" };
      }
    }
  } else {
    for (const batsman of Object.values(innings2Stats.batsmanStats)) {
      if (batsman.runs > motmScore) {
        motmScore = batsman.runs;
        motm = batsman;
      }
    }
    for (const bowler of Array.from(innings2Stats.bowlerStats.values())) {
      if (bowler.wickets * 20 > motmScore) {
        motmScore = bowler.wickets * 20;
        motm = { name: bowler.name, runs: bowler.wickets, type: "wickets" };
      }
    }
  }
  
  if (motm) {
    if (motm.type === "wickets") {
      matchStats += `⭐ **Player of the Match:** ${motm.name} (${motm.runs} wickets)\n`;
    } else {
      matchStats += `⭐ **Player of the Match:** ${motm.name} (${motm.runs} runs)\n`;
    }
  }
  
  embed.addFields({ name: "📈 MATCH STATS", value: matchStats, inline: false });
  embed.setFooter({ text: `Match completed at ${new Date().toLocaleString()}` });

  return embed;
}

function createCurrentPartnershipEmbed(matchState) {
  const striker = matchState.battingOrder[matchState.strikerIdx];
  const nonStriker = matchState.battingOrder[matchState.nonStrikerIdx];
  const strikerStats = matchState.batsmanStats[striker.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStrikerStats = matchState.batsmanStats[nonStriker.toLowerCase().trim()] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
  
  // Convert internal 0-based over number to display 1-based over number
  const displayOverNumber = (matchState.currentOver || 0) + 1;
  console.log('displayOverNumber', displayOverNumber)
  console.log('matchState.currentOver', matchState.currentOver)
  const embed = new EmbedBuilder()
    .setTitle("🏏 CURRENT PARTNERSHIP")
    .setColor(0x00AE86)
    .addFields(
      { 
        name: `🔥 ${striker}`, 
        value: `${strikerStats.runs} runs (${strikerStats.balls} balls) | ${strikerStats.fours} fours | ${strikerStats.sixes} sixes`,
        inline: false 
      },
      { 
        name: `🔄 ${nonStriker}`, 
        value: `${nonStrikerStats.runs} runs (${nonStrikerStats.balls} balls) | ${nonStrikerStats.fours} fours | ${nonStrikerStats.sixes} sixes`,
        inline: false 
      },
      { 
        name: "🤝 Partnership", 
        value: `${matchState.partnershipRuns} runs (${matchState.partnershipBalls} balls)`,
        inline: true 
      },
      { 
        name: "📊 Score", 
        value: `${matchState.runs}/${matchState.wickets}`,
        inline: true 
      }
    )
    .setFooter({ text: `Over ${displayOverNumber} • Innings ${matchState.currentInnings}` });
  
  return embed;
}

module.exports = {
  createInningsScorecardEmbed,
  createMatchSummaryEmbed,
  createCurrentPartnershipEmbed
};