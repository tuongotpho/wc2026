import fs from 'fs';

const sheetUrl = "https://docs.google.com/spreadsheets/d/14YaeCAFpXI9rYDPNSOQ_lnxkTElaz6Keu6frp6DWgWU/export?format=csv&gid=327062778";

// Load data.json to get players list
const data = JSON.parse(fs.readFileSync('./src/data.json', 'utf8'));
const players = data.players;

const parseCSVLine = (text) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

async function test() {
  const res = await fetch(sheetUrl);
  const csvText = await res.text();
  const lines = csvText.split(/\r?\n/);
  
  let headerLine = null;
  for (const line of lines) {
    const parts = parseCSVLine(line);
    // ONLY check for 'Ngày giờ thi đấu' to avoid matching row 2 which has player names in columns 65+
    if (parts.includes('Ngày giờ thi đấu')) {
      headerLine = parts;
      break;
    }
  }

  if (!headerLine) {
    console.log("Error: Header line not found!");
    return;
  }

  console.log("=== Matching Players ===");
  const playerColMap = {};
  for (let c = 8; c <= 60; c += 2) {
    const name = headerLine[c];
    if (name) {
      const matchedPlayer = players.find(p => p.trim() === name.trim());
      if (matchedPlayer) {
        playerColMap[c] = matchedPlayer;
        console.log(`Col ${c} -> ${matchedPlayer} (Excel Name: '${name}')`);
      } else {
        console.log(`Col ${c} -> NO MATCH for Excel Name: '${name}'`);
      }
    } else {
      console.log(`Col ${c} -> Empty`);
    }
  }

  console.log(`\nFound ${Object.keys(playerColMap).length} mapped players.`);
  
  // Test Match 1 parsing
  console.log("\n=== Parsing Match 1 ===");
  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length > 1 && parts[1] === "1") {
      const mId = parseInt(parts[1]);
      const homeTeam = parts[4];
      const homeScore = parts[5];
      const awayScore = parts[6];
      const awayTeam = parts[7];
      console.log(`Match #${mId}: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`);
      
      console.log("Predictions (first 5 players):");
      Object.keys(playerColMap).slice(0, 5).forEach(colIdx => {
        const c = parseInt(colIdx);
        const name = playerColMap[c];
        const pHome = parts[c];
        const pAway = parts[c+1];
        console.log(`  ${name}: ${pHome} - ${pAway}`);
      });
    }
  }
}

test().catch(console.error);
