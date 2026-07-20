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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);
    const hasAHoa = parts.includes('A.Hòa');
    const hasNgayGio = parts.includes('Ngày giờ thi đấu');
    
    if (hasAHoa || hasNgayGio) {
      console.log(`Line ${i+1} matched! hasAHoa=${hasAHoa}, hasNgayGio=${hasNgayGio}`);
      console.log(`  Length: ${parts.length}`);
      console.log(`  Index 1: '${parts[1]}'`);
      console.log(`  Index 8: '${parts[8]}'`);
      console.log(`  Line snippet: ${line.substring(0, 100)}`);
      break;
    }
  }
}

debug().catch(console.error);
