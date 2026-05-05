// services/sheets.js
const { google } = require("googleapis");

if (!process.env.GOOGLE_CREDENTIALS) {
  throw new Error("GOOGLE_CREDENTIALS is missing in Render environment variables");
}

let credentials;

try {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (err) {
  throw new Error("GOOGLE_CREDENTIALS is not valid JSON");
}

credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// TWO DIFFERENT SPREADSHEETS
const PUBLIC_TEAMS_SPREADSHEET_ID = process.env.PUBLIC_TEAMS_SPREADSHEET_ID;
const PRIVATE_PLAYERS_SPREADSHEET_ID = process.env.PRIVATE_PLAYERS_SPREADSHEET_ID;

async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// ========== PRIVATE SHEETS (Database, Results, etc.) ==========
async function getAllPlayers() {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: "Player Database!A2:Q",
    });
    const rows = res.data.values || [];
    return rows.map(row => ({
      name: row[0] ? row[0].toString().trim() : "",
      country: row[1] ? row[1].toString().trim() : "",
      role: row[2] ? row[2].toString().trim() : "",
      technique: parseInt(row[3]) || 0,
      power: parseInt(row[4]) || 0,
      timing: parseInt(row[5]) || 0,
      againstPace: parseInt(row[6]) || 0,
      againstSpin: parseInt(row[7]) || 0,
      aggression: parseInt(row[8]) || 0,
      consistency: parseInt(row[9]) || 0,
      paceSkill: parseInt(row[10]) || 0,
      spinSkill: parseInt(row[11]) || 0,
      movement: parseInt(row[12]) || 0,
      control: parseInt(row[13]) || 0,
      economy: parseInt(row[14]) || 0,
      deathBowling: parseInt(row[15]) || 0,
      form: parseInt(row[16]) || 50,
    }));
  });
}

// Case-insensitive player matching
function findPlayerByName(players, searchName) {
  const searchLower = searchName.toLowerCase().trim();

  // 1. Exact match (case insensitive)
  let player = players.find(p => p.name.toLowerCase() === searchLower);
  if (player) return { player, matchType: "exact" };

  // 2. Partial match (searchName is inside player name)
  player = players.find(p => p.name.toLowerCase().includes(searchLower));
  if (player) return { player, matchType: "partial" };

  // 3. Player name is inside searchName
  player = players.find(p => searchLower.includes(p.name.toLowerCase()));
  if (player) return { player, matchType: "partial" };

  return null;
}

// Batch match multiple players
function matchPlayers(playersList, teamPlayerNames) {
  const results = {
    matched: [],
    notFound: [],
    partialMatches: []
  };

  for (const teamName of teamPlayerNames) {
    const trimmedName = teamName.toString().trim();
    const match = findPlayerByName(playersList, trimmedName);

    if (match) {
      results.matched.push({
        teamInput: trimmedName,
        dbName: match.player.name,
        role: match.player.role,
        matchType: match.matchType
      });
      if (match.matchType === "partial") {
        results.partialMatches.push({
          teamInput: trimmedName,
          dbName: match.player.name
        });
      }
    } else {
      results.notFound.push(trimmedName);
    }
  }

  return results;
}

// ========== PUBLIC SHEET (Teams only) ==========
async function getAllTeams() {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PUBLIC_TEAMS_SPREADSHEET_ID,
      range: "Teams!A2:Z",
    });
    return (res.data.values || []).filter(row => row.length > 0);
  });
}

async function getTeamByName(teamName) {
  const rows = await getAllTeams();
  for (const row of rows) {
    if (row.length < 3) continue;
    const name = row[0] ? row[0].toString().trim() : "";
    const owner = row[1] ? row[1].toString().trim() : "";
    const players = row.slice(2).filter(p => p && p.toString().trim() !== "");
    if (name.toLowerCase() === teamName.toLowerCase()) {
      return { teamName: name, owner, players };
    }
  }
  return null;
}

async function createTeam(teamName, ownerId) {
  return withRetry(async () => {
    const existing = await getTeamByName(teamName);
    if (existing) throw new Error("Team name already exists");

    await sheets.spreadsheets.values.append({
      spreadsheetId: PUBLIC_TEAMS_SPREADSHEET_ID,
      range: "Teams!A:C",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[teamName, ownerId]] },
    });
    return { success: true };
  });
}

async function updateTeamPlayers(teamName, players) {
  return withRetry(async () => {
    const rows = await getAllTeams();
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0]?.toString().trim().toLowerCase() === teamName.toLowerCase()) {
        rowIndex = i + 2;
        break;
      }
    }
    if (rowIndex === -1) throw new Error("Team not found");

    const team = rows[rowIndex - 2];
    const values = [[team[0], team[1], ...players.slice(0, 11)]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: PUBLIC_TEAMS_SPREADSHEET_ID,
      range: `Teams!A${rowIndex}:M${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { success: true };
  });
}

async function saveMatchResult(match) {
  return withRetry(async () => {
    await sheets.spreadsheets.values.append({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: "Results!A:G",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[Date.now(), match.teamA, match.teamB, match.scoreA, match.scoreB, match.winner, match.wonBy]],
      },
    });
  });
}

async function getPlayerStatsForAdmin(playerName) {
  const allPlayers = await getAllPlayers();
  const match = findPlayerByName(allPlayers, playerName);
  return match ? match.player : null;
}

async function getPlayerBasicInfo(playerNames) {
  const allPlayers = await getAllPlayers();
  const results = [];
  for (const name of playerNames) {
    const match = findPlayerByName(allPlayers, name);
    if (match) {
      results.push({
        inputName: name,
        actualName: match.player.name,
        role: match.player.role,
        matched: true
      });
    } else {
      results.push({
        inputName: name,
        actualName: null,
        role: null,
        matched: false
      });
    }
  }
  return results;
}

async function getAllStadiums() {
  return withRetry(async () => {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: PRIVATE_PLAYERS_SPREADSHEET_ID,
      range: "Stadium!A2:J", // A to I columns
    });
    const rows = res.data.values || [];
    return rows.map(row => ({
      name: row[0] ? row[0].toString().trim() : "",
      country: row[1] ? row[1].toString().trim() : "",
      pace: parseInt(row[2]) || 0,
      bounce: parseInt(row[3]) || 0,
      swing: parseInt(row[4]) || 0,
      turn: parseInt(row[5]) || 0,
      batting: parseInt(row[6]) || 0,
      boundarySize: parseInt(row[7]) || 0,
      dew: parseInt(row[8]) || 0,
      type: row[9] ? row[9].toString().trim() : "Neutral",
    }));
  });
}

async function getStadiumByName(stadiumName) {
  const stadiums = await getAllStadiums();
  return stadiums.find(s => s.name.toLowerCase() === stadiumName.toLowerCase()) || null;
}

async function getRandomStadium() {
  const stadiums = await getAllStadiums();
  // console.log('stadium from sheets', stadiums)
  // console.log('stadium from sheets random selected', stadiums[Math.floor(Math.random() * stadiums.length)])
  if (stadiums.length === 0) return null;
  return stadiums[Math.floor(Math.random() * stadiums.length)];
}

module.exports = {
  getAllPlayers,
  findPlayerByName,
  matchPlayers,
  getAllTeams,
  getTeamByName,
  createTeam,
  updateTeamPlayers,
  saveMatchResult,
  getPlayerStatsForAdmin,
  getPlayerBasicInfo,
  getAllStadiums,    // NEW
  getStadiumByName,
  getRandomStadium,
};