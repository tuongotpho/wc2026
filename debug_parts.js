import fs from 'fs';

const sheetUrl = "https://docs.google.com/spreadsheets/d/14YaeCAFpXI9rYDPNSOQ_lnxkTElaz6Keu6frp6DWgWU/export?format=csv&gid=327062778";

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

async function debug() {
  const res = await fetch(sheetUrl);
  const csvText = await res.text();
  const lines = csvText.split(/\r?\n/);
  
  let headerLine = null;
  let lineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.includes('Ngày giờ thi đấu')) {
      headerLine = parts;
      lineIdx = i;
      break;
    }
  }

  if (headerLine) {
    console.log(`=== Header Line (Row ${lineIdx + 1}) Elements ===`);
    headerLine.forEach((val, idx) => {
      if (val) {
        console.log(`Index ${idx}: '${val}'`);
      }
    });
  }
}

debug().catch(console.error);
