// utils/validator.js
const { matchPlayers } = require("../services/sheets");

function getPlayerCategory(role) {
  const r = role.toLowerCase();
  if (r.includes("wicketkeeper") || r === "wicket keeper") return "wk";
  if (r.includes("fast bowler")) return "bowler";
  if (r.includes("spin bowler")) return "bowler";
  if (r.includes("fast allrounder")) return "allrounder";
  if (r.includes("spin allrounder")) return "allrounder";
  if (r.includes("batsman")) return "batsman";
  return "other";
}

async function validateTeam(team, playersList) {
  // 1. Must have exactly 11 players
  if (!team.players || team.players.length !== 11) {
    return { 
      ok: false, 
      reason: `Team must have exactly 11 players (has ${team.players?.length || 0})`,
      matchResults: null
    };
  }

  // 2. Match all players against database
  const matchResults = matchPlayers(playersList, team.players);
  
  // 3. Check for unfound players
  if (matchResults.notFound.length > 0) {
    return { 
      ok: false, 
      reason: `❌ The following players were NOT found in the database:\n${matchResults.notFound.map(p => `   • ${p}`).join("\n")}\n\nPlease use the exact names as in the Players Database.`,
      matchResults
    };
  }

  // 4. Check team composition rules
  let wicketkeepers = 0;
  let bowlerAllrounderCount = 0;
  
  for (const match of matchResults.matched) {
    const category = getPlayerCategory(match.role);
    if (category === "wk") wicketkeepers++;
    if (category === "bowler" || category === "allrounder") bowlerAllrounderCount++;
  }

  // 5. At least one wicketkeeper
  if (wicketkeepers === 0) {
    return { 
      ok: false, 
      reason: "❌ Team must contain at least one WICKETKEEPER",
      matchResults
    };
  }

  // 6. MINIMUM 5 bowlers + allrounders
  if (bowlerAllrounderCount < 5) {
    return { 
      ok: false, 
      reason: `❌ Team must have exactly 5 BOWLERS + ALLROUNDERS (has ${bowlerAllrounderCount})`,
      matchResults
    };
  }

  return { ok: true, matchResults };
}

module.exports = { validateTeam, getPlayerCategory };