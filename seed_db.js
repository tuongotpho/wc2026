import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyCoOQGZqZFdA82V2EDIa07hXbmMW1ugQoo",
  authDomain: "studio-856395995-d843d.firebaseapp.com",
  projectId: "studio-856395995-d843d",
  storageBucket: "studio-856395995-d843d.firebasestorage.app",
  messagingSenderId: "106909967902",
  appId: "1:106909967902:web:d4716b6b7ee575b5b6700f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const data = JSON.parse(fs.readFileSync('./src/data.json', 'utf8'));

async function seed() {
  console.log("=== Bắt đầu tải dữ liệu lên Cloud Firestore ===");
  
  // Seed matches
  console.log(`1. Đang tải ${data.matches.length} trận đấu và dự đoán...`);
  for (const match of data.matches) {
    await setDoc(doc(db, 'matches', String(match.id)), match);
  }
  
  // Seed configurations
  console.log("2. Đang cấu hình cài đặt, danh sách người chơi và luật phạt...");
  await setDoc(doc(db, 'config', 'metadata'), { seededAt: new Date().toISOString() });
  await setDoc(doc(db, 'config', 'players_list'), { names: data.players });
  await setDoc(doc(db, 'config', 'bets'), {
    championBets: data.championBets || {},
    finalistBets: data.finalistBets || {}
  });
  await setDoc(doc(db, 'config', 'pins'), { pins: {} });
  await setDoc(doc(db, 'config', 'rules'), {
    vong_bang: 10000,
    vong_32: 15000,
    vong_16: 20000,
    vong_8: 25000,
    ban_ket: 30000,
    chung_ket: 50000
  });

  console.log("=== Đã tải dữ liệu lên Firestore thành công! ===");
  process.exit(0);
}

seed().catch(err => {
  console.error("Lỗi khi tải dữ liệu:", err);
  process.exit(1);
});
