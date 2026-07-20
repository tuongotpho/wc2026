import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Coins, 
  Settings as SettingsIcon, 
  Lock, 
  Unlock, 
  UserCheck, 
  LogOut, 
  Eye, 
  Plus, 
  Check,
  CheckCircle,
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  TrendingDown, 
  Search, 
  Save, 
  Upload, 
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import initialData from './data.json';
import { db, isFirebaseConfigured } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  updateDoc 
} from 'firebase/firestore';

// Stages display names
const STAGE_NAMES = {
  vong_bang: 'Vòng bảng',
  vong_32: 'Vòng 1/32',
  vong_16: 'Vòng 1/16',
  vong_8: 'Vòng tứ kết (1/8)',
  ban_ket: 'Bán kết',
  chung_ket: 'Tranh 3/4 & Chung kết'
};

function App() {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [championBets, setChampionBets] = useState({});
  const [finalistBets, setFinalistBets] = useState({});
  
  const [currentUser, setCurrentUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [isRegisteringPin, setIsRegisteringPin] = useState(false);
  const [pinsMap, setPinsMap] = useState({}); // name -> pin

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(localStorage.getItem('wc26_admin_logged') === 'true');

  // Filters for Match Center
  const [selectedStage, setSelectedStage] = useState('all');
  const [teamSearch, setTeamSearch] = useState('');

  // Player view filters
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [expenseLogs, setExpenseLogs] = useState([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState('expense');
  const [memberContributions, setMemberContributions] = useState({}); // { playerName: { amount: number, paid: boolean } }

  // Popup predictions view
  const [selectedMatch, setSelectedMatch] = useState(null);

  // App settings/rules
  const [rules, setRules] = useState({
    vong_bang: 10000,
    vong_32: 15000,
    vong_16: 20000,
    vong_8: 25000,
    ban_ket: 30000,
    chung_ket: 50000
  });

  // Loading & Toasts
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [isOnlineMode, setIsOnlineMode] = useState(false);

  // Trigger toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Initial Data Loading & Smart Database Sync
  useEffect(() => {
    const initializeData = async () => {
      setIsSyncing(true);
      if (isFirebaseConfigured && db) {
        try {
          setIsOnlineMode(true);
          
          // Try loading rules
          const rulesDoc = await getDoc(doc(db, 'config', 'rules'));
          let currentRules = rules;
          if (rulesDoc.exists()) {
            currentRules = rulesDoc.data();
            setRules(currentRules);
          } else {
            // Seed rules
            await setDoc(doc(db, 'config', 'rules'), rules);
          }

          // Try loading players & matches
          const metaDoc = await getDoc(doc(db, 'config', 'metadata'));
          if (metaDoc.exists()) {
            // Firestore already populated. Load matches, players, pins, expenses
            const matchesSnapshot = await getDocs(collection(db, 'matches'));
            const loadedMatches = matchesSnapshot.docs.map(doc => doc.data());
            // Sort matches by ID
            loadedMatches.sort((a, b) => a.id - b.id);
            setMatches(loadedMatches);
            localStorage.setItem('wc26_matches', JSON.stringify(loadedMatches));

            const playersDoc = await getDoc(doc(db, 'config', 'players_list'));
            const loadedPlayers = playersDoc.data()?.names || [];
            setPlayers(loadedPlayers);

            const betsDoc = await getDoc(doc(db, 'config', 'bets'));
            if (betsDoc.exists()) {
              setChampionBets(betsDoc.data().championBets || {});
              setFinalistBets(betsDoc.data().finalistBets || {});
            }

            const pinsDoc = await getDoc(doc(db, 'config', 'pins'));
            if (pinsDoc.exists()) {
              setPinsMap(pinsDoc.data().pins || {});
            }

            const expensesSnapshot = await getDocs(collection(db, 'expenses'));
            const loadedExpenses = expensesSnapshot.docs.map(doc => doc.data());
            loadedExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            setExpenseLogs(loadedExpenses);

            const contribDoc = await getDoc(doc(db, 'config', 'contributions'));
            if (contribDoc.exists()) {
              setMemberContributions(contribDoc.data());  
            }

            console.log("Loaded all data from Firestore.");
          } else {
            // First-time database seed. Upload data.json contents to Firestore
            showToast("Đang đồng bộ dữ liệu ban đầu lên Firestore...", "info");
            
            // Upload matches
            for (const match of initialData.matches) {
              await setDoc(doc(db, 'matches', String(match.id)), match);
            }
            
            // Upload metadata
            await setDoc(doc(db, 'config', 'metadata'), { seededAt: new Date().toISOString() });
            await setDoc(doc(db, 'config', 'players_list'), { names: initialData.players });
            await setDoc(doc(db, 'config', 'bets'), {
              championBets: initialData.championBets || {},
              finalistBets: initialData.finalistBets || {}
            });
            await setDoc(doc(db, 'config', 'pins'), { pins: {} });

            setPlayers(initialData.players);
            setMatches(initialData.matches);
            setChampionBets(initialData.championBets || {});
            setFinalistBets(initialData.finalistBets || {});
            
            showToast("Đã đồng bộ dữ liệu Excel lên Cloud thành công!", "success");
          }
        } catch (error) {
          console.error("Firebase sync failed, falling back to LocalStorage:", error);
          setIsOnlineMode(false);
          loadFromLocalStorage();
        }
      } else {
        // Fallback to local storage
        setIsOnlineMode(false);
        loadFromLocalStorage();
      }
      setIsSyncing(false);
    };

    initializeData();
  }, []);

  const loadFromLocalStorage = () => {
    const localMatches = localStorage.getItem('wc26_matches');
    const localPlayers = localStorage.getItem('wc26_players');
    const localChampionBets = localStorage.getItem('wc26_champion_bets');
    const localFinalistBets = localStorage.getItem('wc26_finalist_bets');
    const localPins = localStorage.getItem('wc26_pins');
    const localExpenses = localStorage.getItem('wc26_expenses');
    const localRules = localStorage.getItem('wc26_rules');
    const localContributions = localStorage.getItem('wc26_contributions');

    if (localMatches && localPlayers) {
      setMatches(JSON.parse(localMatches));
      setPlayers(JSON.parse(localPlayers));
      setChampionBets(JSON.parse(localChampionBets || '{}'));
      setFinalistBets(JSON.parse(localFinalistBets || '{}'));
      setPinsMap(JSON.parse(localPins || '{}'));
      setExpenseLogs(JSON.parse(localExpenses || '[]'));
      setRules(JSON.parse(localRules || JSON.stringify(rules)));
      setMemberContributions(JSON.parse(localContributions || '{}'));
    } else {
      // Seed local storage with initialData
      localStorage.setItem('wc26_matches', JSON.stringify(initialData.matches));
      localStorage.setItem('wc26_players', JSON.stringify(initialData.players));
      localStorage.setItem('wc26_champion_bets', JSON.stringify(initialData.championBets || {}));
      localStorage.setItem('wc26_finalist_bets', JSON.stringify(initialData.finalistBets || {}));
      localStorage.setItem('wc26_pins', JSON.stringify({}));
      localStorage.setItem('wc26_expenses', JSON.stringify([]));
      localStorage.setItem('wc26_contributions', JSON.stringify({}));
      localStorage.setItem('wc26_rules', JSON.stringify(rules));

      setMatches(initialData.matches);
      setPlayers(initialData.players);
      setChampionBets(initialData.championBets || {});
      setFinalistBets(initialData.finalistBets || {});
    }
    showToast("Đang chạy ở chế độ Local (Offline)", "info");
  };

  // Sync state changes to Firestore/LocalStorage
  const saveMatchesState = async (updatedMatches) => {
    setMatches(updatedMatches);
    if (isOnlineMode && db) {
      try {
        // Update Firestore in background
        setIsSyncing(true);
        // Find which matches were changed and update those docs specifically
        // To keep it simple, we save only the modified match in functions
      } catch (e) {
        console.error(e);
      } finally {
        setIsSyncing(false);
      }
    } else {
      localStorage.setItem('wc26_matches', JSON.stringify(updatedMatches));
    }
  };

  // 2. Penalty Fine Calculator Logic (Excel formula replication)
  const calculateFine = (match, prediction, currentRules) => {
    const { homeScore, awayScore, stage } = match;
    const { homeScore: predHome, awayScore: predAway } = prediction || {};
    
    // Rule limits
    const maxFine = currentRules[stage] || 10000;

    // If match is not played yet (actual score is missing), fine is 0
    if (homeScore === null || awayScore === null) {
      return 0;
    }
    // If prediction is missing
    if (predHome === null || predAway === null || predHome === undefined || predAway === undefined) {
      return maxFine; // missing prediction is treated as fully wrong
    }

    const isActualDraw = homeScore === awayScore;
    const isPredDraw = predHome === predAway;

    if (isActualDraw) {
      if (isActualDraw && !isPredDraw) {
        return maxFine; // Predicted winner in a draw match -> WRONG
      }
      if (homeScore === predHome) {
        return 0; // Correct exact draw score (e.g. 2-2 vs 2-2) -> CORRECT
      }
      return 0.5 * maxFine; // Predicted draw but different score (e.g. 1-1 vs 2-2) -> RIGHT DIRECTION
    } else {
      // Actual is Win/Loss
      if (homeScore === predHome && awayScore === predAway) {
        return 0; // Exact score -> CORRECT
      }
      const actualWinnerSign = homeScore - awayScore;
      const predWinnerSign = predHome - predAway;
      
      if (actualWinnerSign * predWinnerSign > 0) {
        return 0.5 * maxFine; // Correct winner, wrong score -> RIGHT DIRECTION
      }
      return maxFine; // Wrong winner or predicted draw -> WRONG
    }
  };

  // Sort state for leaderboard table
  const [leaderboardSort, setLeaderboardSort] = useState({
    key: 'totalFine',
    direction: 'desc'
  });

  // Tooltip state for rank fluctuation chart
  const [activeChartTooltip, setActiveChartTooltip] = useState(null);

  const handleSort = (key) => {
    setLeaderboardSort(prev => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'desc' ? 'asc' : 'desc'
        };
      }
      const defaultDirection = (key === 'rank' || key === 'name') ? 'asc' : 'desc';
      return {
        key,
        direction: defaultDirection
      };
    });
  };

  const renderSortIcon = (key) => {
    if (leaderboardSort.key !== key) {
      return <ArrowUpDown size={12} style={{ marginLeft: '4px', opacity: 0.4, verticalAlign: 'middle' }} />;
    }
    return leaderboardSort.direction === 'asc' 
      ? <ArrowUp size={12} style={{ marginLeft: '4px', color: 'var(--color-gold)', verticalAlign: 'middle' }} />
      : <ArrowDown size={12} style={{ marginLeft: '4px', color: 'var(--color-gold)', verticalAlign: 'middle' }} />;
  };

  // 3. Aggregate Player statistics
  const leaderboard = useMemo(() => {
    if (players.length === 0 || matches.length === 0) return [];

    const stats = players.map(name => {
      let totalFine = 0;
      let correctScores = 0;
      let correctOutcomes = 0;
      let wrongOutcomes = 0;

      matches.forEach(match => {
        const pred = match.predictions[name];
        if (match.homeScore !== null && match.awayScore !== null) {
          const fine = calculateFine(match, pred, rules);
          totalFine += fine;

          if (fine === 0) {
            correctScores++;
          } else if (fine === 0.5 * (rules[match.stage] || 10000)) {
            correctOutcomes++;
          } else {
            wrongOutcomes++;
          }
        }
      });

      return {
        name,
        totalFine,
        correctScores,
        correctOutcomes,
        wrongOutcomes
      };
    });

    // Sort players by totalFine descending (most fine/donations first!)
    stats.sort((a, b) => b.totalFine - a.totalFine || a.correctScores - b.correctScores);
    return stats.map((player, idx) => ({ ...player, originalRank: idx + 1 }));
  }, [players, matches, rules]);

  const sortedLeaderboard = useMemo(() => {
    const { key, direction } = leaderboardSort;
    const sorted = [...leaderboard];
    
    sorted.sort((a, b) => {
      let valA, valB;
      if (key === 'rank') {
        valA = a.originalRank;
        valB = b.originalRank;
      } else {
        valA = a[key];
        valB = b[key];
      }
      
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      
      // Fallback stable sorting
      if (key !== 'totalFine') {
        if (a.totalFine !== b.totalFine) {
          return b.totalFine - a.totalFine; // default to higher fine first
        }
      }
      return a.originalRank - b.originalRank;
    });
    
    return sorted;
  }, [leaderboard, leaderboardSort]);

  // Selected Player details computed info
  const selectedPlayerStats = useMemo(() => {
    if (!selectedPlayer) return null;
    
    let totalFine = 0;
    let correctScores = 0;
    let correctOutcomes = 0;
    let wrongOutcomes = 0;
    const matchDetails = [];

    matches.forEach(match => {
      const pred = match.predictions[selectedPlayer];
      const fine = calculateFine(match, pred, rules);
      const isPlayed = match.homeScore !== null && match.awayScore !== null;
      
      if (isPlayed) {
        totalFine += fine;
        if (fine === 0) correctScores++;
        else if (fine === 0.5 * (rules[match.stage] || 10000)) correctOutcomes++;
        else wrongOutcomes++;
      }

      matchDetails.push({
        match,
        prediction: pred,
        fine,
        isPlayed
      });
    });

    return {
      name: selectedPlayer,
      totalFine,
      correctScores,
      correctOutcomes,
      wrongOutcomes,
      matchDetails,
      champion: championBets[selectedPlayer] || 'Chưa chọn',
      finalists: finalistBets[selectedPlayer] || 'Chưa chọn'
    };
  }, [selectedPlayer, matches, rules, championBets, finalistBets]);

  // Rank history over time for selected player
  const playerRankHistory = useMemo(() => {
    if (!selectedPlayer || players.length === 0 || matches.length === 0) return [];

    // Filter matches that have been played (chronological order by id)
    const playedMatches = [...matches]
      .filter(m => m.homeScore !== null && m.awayScore !== null)
      .sort((a, b) => a.id - b.id);
    
    if (playedMatches.length === 0) return [];

    const runningStats = {};
    players.forEach(p => {
      runningStats[p] = { fine: 0, correctScores: 0 };
    });

    const history = [];

    playedMatches.forEach((match, index) => {
      // Calculate and accumulate stats for all players
      players.forEach(p => {
        const pred = match.predictions[p];
        const fine = calculateFine(match, pred, rules);
        runningStats[p].fine += fine;
        if (fine === 0) {
          runningStats[p].correctScores += 1;
        }
      });

      // Sort players by the exact leaderboard criteria
      const sortedPlayers = [...players]
        .map(p => ({
          name: p,
          fine: runningStats[p].fine,
          correctScores: runningStats[p].correctScores
        }))
        .sort((a, b) => b.fine - a.fine || b.correctScores - a.correctScores);

      const rank = sortedPlayers.findIndex(p => p.name === selectedPlayer) + 1;
      
      history.push({
        matchNumber: index + 1,
        matchId: match.id,
        matchLabel: `Trận ${match.id}: ${match.homeTeam} - ${match.awayTeam}`,
        rank: rank,
        fine: runningStats[selectedPlayer].fine
      });
    });

    return history;
  }, [selectedPlayer, players, matches, rules]);

  // Achievements & Badges calculation
  const playerAchievements = useMemo(() => {
    if (players.length === 0 || matches.length === 0) return { byPlayer: {}, overview: {} };

    // 1. Initialize stats for each player
    const stats = {};
    players.forEach(p => {
      stats[p] = {
        name: p,
        correctScores: 0,
        correctOutcomes: 0,
        wrongOutcomes: 0,
        totalFine: 0,
        contrarianPoints: 0,
        currentStreak: 0,
        maxStreak: 0
      };
    });

    // 2. Sort matches by id to calculate streaks chronologically
    const playedMatches = [...matches]
      .filter(m => m.homeScore !== null && m.awayScore !== null)
      .sort((a, b) => a.id - b.id);

    playedMatches.forEach(match => {
      // Find the majority prediction outcome for this match (Consensus)
      const predOutcomes = [];
      const matchPreds = Object.entries(match.predictions || {});
      
      matchPreds.forEach(([name, pred]) => {
        if (pred && pred.homeScore !== null && pred.awayScore !== null) {
          const diff = Number(pred.homeScore) - Number(pred.awayScore);
          if (diff > 0) predOutcomes.push('home');
          else if (diff < 0) predOutcomes.push('away');
          else predOutcomes.push('draw');
        }
      });

      // Find the majority outcome
      let majorityOutcome = null;
      if (predOutcomes.length > 0) {
        const counts = { home: 0, draw: 0, away: 0 };
        predOutcomes.forEach(o => counts[o]++);
        let maxCount = -1;
        Object.entries(counts).forEach(([outcome, count]) => {
          if (count > maxCount) {
            maxCount = count;
            majorityOutcome = outcome;
          }
        });
      }

      // Calculate stats and update for each player
      players.forEach(p => {
        const pred = match.predictions[p];
        const fine = calculateFine(match, pred, rules);
        const playerStats = stats[p];

        playerStats.totalFine += fine;

        if (fine === 0) {
          playerStats.correctScores++;
        } else if (fine === 0.5 * (rules[match.stage] || 10000)) {
          playerStats.correctOutcomes++;
        } else {
          playerStats.wrongOutcomes++;
        }

        // Check if correct (either score or outcome, i.e. fine < maxFine)
        const maxFine = rules[match.stage] || 10000;
        const isCorrectOutcome = fine < maxFine;
        
        if (isCorrectOutcome) {
          playerStats.currentStreak++;
          if (playerStats.currentStreak > playerStats.maxStreak) {
            playerStats.maxStreak = playerStats.currentStreak;
          }
        } else {
          playerStats.currentStreak = 0;
        }

        // Contrarian check: player prediction was different from the group majority
        if (pred && pred.homeScore !== null && pred.awayScore !== null && majorityOutcome) {
          const playerDiff = Number(pred.homeScore) - Number(pred.awayScore);
          let playerOutcome = 'draw';
          if (playerDiff > 0) playerOutcome = 'home';
          else if (playerDiff < 0) playerOutcome = 'away';

          if (playerOutcome !== majorityOutcome) {
            playerStats.contrarianPoints++;
          }
        }
      });
    });

    // 3. Find the maximum values for each badge
    const badgeWinners = {
      vua_ti_so: { players: [], count: 0, emoji: '👑', label: 'Vua Tỉ Số', desc: 'Đoán trúng tỉ số chính xác nhiều nhất' },
      tien_tri: { players: [], count: 0, emoji: '🔮', label: 'Tiên Tri Vũ Trụ', desc: 'Đoán trúng hướng thắng/thua/hòa nhiều nhất' },
      sai_bet: { players: [], count: 0, emoji: '🤡', label: 'Kiện Tướng Sai Bét', desc: 'Đoán sai bét nhiều trận nhất' },
      dai_gia: { players: [], count: 0, emoji: '💰', label: 'Nhà Tài Trợ Vàng', desc: 'Đóng góp tiền phạt nhiều nhất' },
      co_doc: { players: [], count: 0, emoji: '🐺', label: 'Kẻ Cô Độc', desc: 'Thường xuyên đoán ngược hướng với đa số cả nhóm' },
      huy_diet: { players: [], count: 0, emoji: '🔥', label: 'Kẻ Hủy Diệt', desc: 'Chuỗi đoán trúng hướng liên tục dài nhất' }
    };

    // Helper to find max and assign
    players.forEach(p => {
      const ps = stats[p];
      // Vua ti so
      if (ps.correctScores > badgeWinners.vua_ti_so.count) {
        badgeWinners.vua_ti_so.count = ps.correctScores;
        badgeWinners.vua_ti_so.players = [p];
      } else if (ps.correctScores === badgeWinners.vua_ti_so.count && ps.correctScores > 0) {
        badgeWinners.vua_ti_so.players.push(p);
      }

      // Tiên tri
      if (ps.correctOutcomes > badgeWinners.tien_tri.count) {
        badgeWinners.tien_tri.count = ps.correctOutcomes;
        badgeWinners.tien_tri.players = [p];
      } else if (ps.correctOutcomes === badgeWinners.tien_tri.count && ps.correctOutcomes > 0) {
        badgeWinners.tien_tri.players.push(p);
      }

      // Sai bét
      if (ps.wrongOutcomes > badgeWinners.sai_bet.count) {
        badgeWinners.sai_bet.count = ps.wrongOutcomes;
        badgeWinners.sai_bet.players = [p];
      } else if (ps.wrongOutcomes === badgeWinners.sai_bet.count && ps.wrongOutcomes > 0) {
        badgeWinners.sai_bet.players.push(p);
      }

      // Đại gia
      if (ps.totalFine > badgeWinners.dai_gia.count) {
        badgeWinners.dai_gia.count = ps.totalFine;
        badgeWinners.dai_gia.players = [p];
      } else if (ps.totalFine === badgeWinners.dai_gia.count && ps.totalFine > 0) {
        badgeWinners.dai_gia.players.push(p);
      }

      // Cô độc
      if (ps.contrarianPoints > badgeWinners.co_doc.count) {
        badgeWinners.co_doc.count = ps.contrarianPoints;
        badgeWinners.co_doc.players = [p];
      } else if (ps.contrarianPoints === badgeWinners.co_doc.count && ps.contrarianPoints > 0) {
        badgeWinners.co_doc.players.push(p);
      }

      // Hủy diệt
      if (ps.maxStreak > badgeWinners.huy_diet.count) {
        badgeWinners.huy_diet.count = ps.maxStreak;
        badgeWinners.huy_diet.players = [p];
      } else if (ps.maxStreak === badgeWinners.huy_diet.count && ps.maxStreak > 0) {
        badgeWinners.huy_diet.players.push(p);
      }
    });

    // 4. Map back to easy lookup by player name
    const playerBadges = {};
    players.forEach(p => {
      playerBadges[p] = [];
    });

    Object.entries(badgeWinners).forEach(([key, info]) => {
      if (info.count > 0 && info.players.length > 0) {
        info.players.forEach(p => {
          playerBadges[p].push({
            key,
            emoji: info.emoji,
            label: info.label,
            desc: info.desc,
            count: info.count
          });
        });
      }
    });

    return {
      byPlayer: playerBadges,
      overview: badgeWinners
    };
  }, [players, matches, rules]);

  // Expenses management computations
  const totalFinesAll = useMemo(() => {
    return leaderboard.reduce((acc, player) => {
      const gtgt = memberContributions[player.name]?.gtgt || 0;
      return acc + player.totalFine + gtgt;
    }, 0);
  }, [leaderboard, memberContributions]);

  const totalFinesCollected = useMemo(() => {
    return leaderboard.reduce((acc, player) => {
      if (memberContributions[player.name]?.paid) {
        const gtgt = memberContributions[player.name]?.gtgt || 0;
        return acc + player.totalFine + gtgt;
      }
      return acc;
    }, 0);
  }, [leaderboard, memberContributions]);

  const expensesSummary = useMemo(() => {
    let income = totalFinesCollected;
    let spent = 0;

    expenseLogs.forEach(log => {
      if (log.type === 'expense') {
        spent += log.amount;
      } else {
        income += log.amount; // Extra sponsor or other income
      }
    });

    return {
      income,
      spent,
      balance: income - spent
    };
  }, [totalFinesCollected, expenseLogs]);

  // Combined logs for Nhật Ký Chi Liên Hoan (includes paid member contributions + manual expense logs)
  const combinedExpenseLogs = useMemo(() => {
    const paidContributionLogs = leaderboard
      .filter(player => memberContributions[player.name]?.paid)
      .map(player => {
        const contrib = memberContributions[player.name];
        const gtgt = contrib?.gtgt || 0;
        const totalAmount = player.totalFine + gtgt;
        return {
          id: `contrib_${player.name}`,
          date: contrib?.paidAt || new Date().toISOString(),
          description: `Thu quỹ phạt + GTGT - ${player.name}`,
          type: 'income',
          amount: totalAmount,
          isContribution: true,
          playerName: player.name
        };
      });

    const manualLogs = expenseLogs.map((log, index) => ({
      ...log,
      id: log.id || `manual_log_${index}`
    }));

    const combined = [...paidContributionLogs, ...manualLogs];
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    return combined;
  }, [leaderboard, memberContributions, expenseLogs]);

  // Initialise selectedPlayer default
  useEffect(() => {
    if (players.length > 0 && !selectedPlayer) {
      setSelectedPlayer(players[0]);
    }
  }, [players, selectedPlayer]);

  // 4. Handle PIN login/registration
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (pinInput.length !== 4 || isNaN(Number(pinInput))) {
      showToast("Mã PIN phải gồm 4 chữ số!", "error");
      return;
    }

    const existingPin = pinsMap[currentUser];

    if (!existingPin) {
      // Register PIN
      const updatedPins = { ...pinsMap, [currentUser]: pinInput };
      setPinsMap(updatedPins);
      if (isOnlineMode && db) {
        await setDoc(doc(db, 'config', 'pins'), { pins: updatedPins });
      } else {
        localStorage.setItem('wc26_pins', JSON.stringify(updatedPins));
      }
      showToast(`Thiết lập mã PIN cho ${currentUser} thành công!`, "success");
      setIsRegisteringPin(false);
    } else {
      // Login validation
      if (existingPin === pinInput) {
        showToast(`Chào mừng ${currentUser} quay trở lại!`, "success");
        // Pin is correct, save session
        localStorage.setItem('wc26_logged_user', currentUser);
        setPinInput('');
      } else {
        showToast("Mã PIN không chính xác. Vui lòng nhập lại!", "error");
      }
    }
  };

  const handleUserSelect = (name) => {
    setCurrentUser(name);
    setPinInput('');
    const hasPin = !!pinsMap[name];
    setIsRegisteringPin(!hasPin);
  };

  const handleLogout = () => {
    localStorage.removeItem('wc26_logged_user');
    setCurrentUser(null);
    setPinInput('');
    setIsRegisteringPin(false);
    showToast("Đã đăng xuất tài khoản.", "info");
  };

  // Check login session on load
  useEffect(() => {
    const savedUser = localStorage.getItem('wc26_logged_user');
    if (savedUser && players.includes(savedUser)) {
      setCurrentUser(savedUser);
    }
  }, [players]);

  // Admin login handling
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'KTAT2026') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('wc26_admin_logged', 'true');
      showToast("Đăng nhập quyền Admin thành công!", "success");
      setAdminPassword('');
    } else {
      showToast("Mật khẩu Admin sai!", "error");
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setIsAdmin(false);
    localStorage.removeItem('wc26_admin_logged');
    showToast("Đã đăng xuất quyền Admin", "info");
  };

  // 5. Update match prediction from player
  const handleSavePrediction = async (matchId, homeScore, awayScore) => {
    const loggedUser = localStorage.getItem('wc26_logged_user');
    if (!loggedUser) {
      showToast("Bạn cần đăng nhập để dự đoán!", "error");
      return;
    }

    // Check if match already started
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const matchTime = new Date(match.datetime);
    if (matchTime <= new Date()) {
      showToast("Trận đấu đã diễn ra, không thể thay đổi dự đoán!", "error");
      return;
    }

    // Save prediction
    const updatedMatches = matches.map(m => {
      if (m.id === matchId) {
        const updatedPreds = {
          ...m.predictions,
          [loggedUser]: {
            homeScore: homeScore === '' ? null : parseInt(homeScore),
            awayScore: awayScore === '' ? null : parseInt(awayScore)
          }
        };
        return { ...m, predictions: updatedPreds };
      }
      return m;
    });

    await saveMatchesState(updatedMatches);
    
    // Save to firebase
    if (isOnlineMode && db) {
      const targetMatch = updatedMatches.find(m => m.id === matchId);
      await setDoc(doc(db, 'matches', String(matchId)), targetMatch);
    }
    showToast("Đã lưu dự đoán của bạn!", "success");
  };

  // 6. Admin update actual scores
  const handleUpdateActualScore = async (matchId, homeScore, awayScore) => {
    const updatedMatches = matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          homeScore: homeScore === '' ? null : parseInt(homeScore),
          awayScore: awayScore === '' ? null : parseInt(awayScore)
        };
      }
      return m;
    });

    setMatches(updatedMatches);
    if (isOnlineMode && db) {
      const targetMatch = updatedMatches.find(m => m.id === matchId);
      await setDoc(doc(db, 'matches', String(matchId)), targetMatch);
    } else {
      localStorage.setItem('wc26_matches', JSON.stringify(updatedMatches));
    }
    showToast(`Đã cập nhật tỷ số trận đấu #${matchId}`, "success");
  };

  // 6b. Sync actual scores AND player predictions from Google Sheet (with silent background sync support)
  const syncWithGoogleSheet = async (isSilent = false) => {
    if (!isSilent) {
      setIsSyncing(true);
      showToast("Đang đồng bộ tỉ số & dự đoán từ Google Sheet...", "info");
    }
    const sheetUrl = "https://docs.google.com/spreadsheets/d/14YaeCAFpXI9rYDPNSOQ_lnxkTElaz6Keu6frp6DWgWU/export?format=csv&gid=327062778";
    
    try {
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error("Không thể tải dữ liệu từ Google Sheet");
      
      const csvText = await response.text();
      const lines = csvText.split(/\r?\n/);
      
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

      // Find player columns from header row (Row 3)
      let headerLine = null;
      for (const line of lines) {
        const parts = parseCSVLine(line);
        if (parts.includes('Ngày giờ thi đấu')) {
          headerLine = parts;
          break;
        }
      }

      if (!headerLine) {
        throw new Error("Không tìm thấy tiêu đề trong Google Sheet!");
      }

      // Read players list from Google Sheet (even columns starting from 8, stop when empty)
      const sheetPlayers = [];
      for (let c = 8; ; c += 2) {
        const name = headerLine[c];
        if (!name || name.trim() === '') {
          break;
        }
        sheetPlayers.push(name.trim());
      }

      // Detect renames and additions
      const renamedMap = {}; // oldName -> newName
      const addedPlayers = [];
      for (let i = 0; i < sheetPlayers.length; i++) {
        const sheetName = sheetPlayers[i];
        if (i < players.length) {
          const currentName = players[i];
          if (currentName !== sheetName) {
            renamedMap[currentName] = sheetName;
          }
        } else {
          addedPlayers.push(sheetName);
        }
      }

      const hasNameChanges = Object.keys(renamedMap).length > 0 || addedPlayers.length > 0;
      let nextPlayers = [...players];
      let nextPinsMap = { ...pinsMap };
      let nextChampionBets = { ...championBets };
      let nextFinalistBets = { ...finalistBets };

      if (hasNameChanges) {
        nextPlayers = [...sheetPlayers];
        
        // Update pins
        Object.keys(renamedMap).forEach(oldName => {
          const newName = renamedMap[oldName];
          if (nextPinsMap[oldName] !== undefined) {
            nextPinsMap[newName] = nextPinsMap[oldName];
            delete nextPinsMap[oldName];
          }
        });

        // Update bets
        Object.keys(renamedMap).forEach(oldName => {
          const newName = renamedMap[oldName];
          if (nextChampionBets[oldName] !== undefined) {
            nextChampionBets[newName] = nextChampionBets[oldName];
            delete nextChampionBets[oldName];
          }
          if (nextFinalistBets[oldName] !== undefined) {
            nextFinalistBets[newName] = nextFinalistBets[oldName];
            delete nextFinalistBets[oldName];
          }
        });

        // Update currentUser session
        let nextCurrentUser = currentUser;
        Object.keys(renamedMap).forEach(oldName => {
          const newName = renamedMap[oldName];
          if (currentUser === oldName) {
            nextCurrentUser = newName;
          }
        });

        // Set states immediately so following code uses the correct values
        setPlayers(nextPlayers);
        setPinsMap(nextPinsMap);
        setChampionBets(nextChampionBets);
        setFinalistBets(nextFinalistBets);
        if (nextCurrentUser !== currentUser) {
          setCurrentUser(nextCurrentUser);
          localStorage.setItem('wc26_logged_user', nextCurrentUser);
        }

        // Save player lists & metadata to Firestore / LocalStorage
        if (isOnlineMode && db) {
          await setDoc(doc(db, 'config', 'players_list'), { names: nextPlayers });
          await setDoc(doc(db, 'config', 'pins'), { pins: nextPinsMap });
          await setDoc(doc(db, 'config', 'bets'), {
            championBets: nextChampionBets,
            finalistBets: nextFinalistBets
          });
        } else {
          localStorage.setItem('wc26_players', JSON.stringify(nextPlayers));
          localStorage.setItem('wc26_pins', JSON.stringify(nextPinsMap));
          localStorage.setItem('wc26_champion_bets', JSON.stringify(nextChampionBets));
          localStorage.setItem('wc26_finalist_bets', JSON.stringify(nextFinalistBets));
        }
      }

      // Map colIndex -> playerName (using new players list)
      const playerColMap = {};
      for (let c = 8; c < 8 + sheetPlayers.length * 2; c += 2) {
        playerColMap[c] = sheetPlayers[(c - 8) / 2];
      }

      const updatedMatches = [...matches];
      let updatedCount = 0;
      
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = parseCSVLine(line);
        if (parts.length < 8) continue;
        
        const mIdStr = parts[1];
        if (!mIdStr || isNaN(Number(mIdStr))) continue;
        const mId = parseInt(mIdStr);
        
        const homeTeam = parts[4] ? parts[4].trim() : '';
        const awayTeam = parts[7] ? parts[7].trim() : '';

        const homeScoreStr = parts[5];
        const awayScoreStr = parts[6];
        
        const homeScore = (homeScoreStr !== "" && !isNaN(Number(homeScoreStr))) ? parseInt(homeScoreStr) : null;
        const awayScore = (awayScoreStr !== "" && !isNaN(Number(awayScoreStr))) ? parseInt(awayScoreStr) : null;
        
        // Parse predictions
        const matchPredictions = {};
        Object.keys(playerColMap).forEach(colIdx => {
          const c = parseInt(colIdx);
          const playerName = playerColMap[c];
          
          const pHomeStr = parts[c];
          const pAwayStr = parts[c + 1];
          
          const pHome = (pHomeStr !== undefined && pHomeStr !== "" && !isNaN(Number(pHomeStr))) ? parseInt(pHomeStr) : null;
          const pAway = (pAwayStr !== undefined && pAwayStr !== "" && !isNaN(Number(pAwayStr))) ? parseInt(pAwayStr) : null;
          
          matchPredictions[playerName] = {
            homeScore: pHome,
            awayScore: pAway
          };
        });

        // Find match
        const matchIdx = updatedMatches.findIndex(m => m.id === mId);
        if (matchIdx !== -1) {
          const match = updatedMatches[matchIdx];
          
          // Smart merge predictions: Google Sheet predictions overwrite App predictions,
          // but if Google Sheet is empty and App has a prediction, we keep the App's prediction.
          // First, rename the keys of existing predictions according to the renamed Map, or initialize added players.
          const renamedPredictions = {};
          Object.keys(match.predictions).forEach(pName => {
            const newName = renamedMap[pName] || pName;
            renamedPredictions[newName] = match.predictions[pName];
          });
          addedPlayers.forEach(addedName => {
            if (renamedPredictions[addedName] === undefined) {
              renamedPredictions[addedName] = { homeScore: null, awayScore: null };
            }
          });

          const mergedPredictions = { ...renamedPredictions };
          Object.keys(playerColMap).forEach(colIdx => {
            const pName = playerColMap[colIdx];
            const sheetPred = matchPredictions[pName];
            const appPred = renamedPredictions[pName];
            
            if (sheetPred && sheetPred.homeScore !== null && sheetPred.awayScore !== null) {
              mergedPredictions[pName] = sheetPred;
            } else if (appPred && appPred.homeScore !== null && appPred.awayScore !== null) {
              // Keep appPred, do not overwrite with null
            } else {
              mergedPredictions[pName] = { homeScore: null, awayScore: null };
            }
          });

          // Check if actual score, team names, or predictions changed
          let isChanged = false;
          if (match.homeScore !== homeScore || match.awayScore !== awayScore) {
            isChanged = true;
          } else if (homeTeam && awayTeam && (match.homeTeam !== homeTeam || match.awayTeam !== awayTeam)) {
            isChanged = true;
          } else if (hasNameChanges) {
            isChanged = true; // Always save matches if name changes occurred to update keys
          } else {
            for (const pName of Object.values(playerColMap)) {
              const prevP = match.predictions[pName];
              const newP = mergedPredictions[pName];
              if (!prevP || !newP || prevP.homeScore !== newP.homeScore || prevP.awayScore !== newP.awayScore) {
                isChanged = true;
                break;
              }
            }
          }
          
          if (isChanged) {
            updatedMatches[matchIdx] = {
              ...match,
              homeTeam: homeTeam || match.homeTeam,
              awayTeam: awayTeam || match.awayTeam,
              homeScore,
              awayScore,
              predictions: mergedPredictions
            };
            updatedCount++;
            
            // Sync to Firebase if online
            if (isOnlineMode && db) {
              await setDoc(doc(db, 'matches', String(mId)), updatedMatches[matchIdx]);
            }
          }
        }
      }
      
      if (updatedCount > 0) {
        setMatches(updatedMatches);
        localStorage.setItem('wc26_matches', JSON.stringify(updatedMatches));
        
        // Update metadata synced time in Cloud if online
        if (isOnlineMode && db) {
          await setDoc(doc(db, 'config', 'metadata'), { lastSyncedAt: new Date().toISOString() });
        }
        
        if (!isSilent) showToast(`Đồng bộ thành công! Đã cập nhật tỉ số & dự đoán của ${updatedCount} trận.`, "success");
      } else {
        if (!isSilent) showToast("Mọi tỉ số và dự đoán đã đồng bộ khớp hoàn toàn với Google Sheet!", "success");
      }
    } catch (error) {
      console.error(error);
      if (!isSilent) showToast("Lỗi đồng bộ dữ liệu Google Sheet!", "error");
    } finally {
      if (!isSilent) setIsSyncing(false);
    }
  };

  // 6c. Automatic background sync refs & effect (Runs every 10 mins & triggers at next kickoff)
  const nextMatchTimerRef = useRef(null);
  const autoSyncIntervalRef = useRef(null);

  useEffect(() => {
    const triggerAutoSync = async () => {
      if (matches.length === 0) return;
      
      const now = new Date();
      const localLastSync = localStorage.getItem('wc26_last_sync_time');
      let shouldSync = false;

      const hasEmptyKnockoutTeams = matches.some(m => 
        (m.stage && m.stage !== 'vong_bang') && (!m.homeTeam || !m.awayTeam)
      );

      if (!localLastSync) {
        shouldSync = true;
      } else {
        const lastSyncDate = new Date(localLastSync);
        const diffMinutes = (now - lastSyncDate) / (1000 * 60);
        const throttleMinutes = hasEmptyKnockoutTeams ? 1 : 10;
        if (diffMinutes >= throttleMinutes) {
          shouldSync = true;
        }
      }

      if (shouldSync) {
        // If we are online, coordinate with Firestore metadata to avoid duplicate writes
        if (isOnlineMode && db) {
          try {
            const metaDoc = await getDoc(doc(db, 'config', 'metadata'));
            if (metaDoc.exists()) {
              const cloudLastSync = metaDoc.data().lastSyncedAt;
              if (cloudLastSync) {
                const cloudSyncDate = new Date(cloudLastSync);
                const diffCloudMinutes = (now - cloudSyncDate) / (1000 * 60);
                if (diffCloudMinutes < 10) {
                  // Already synced by someone else recently, just update local timestamp
                  localStorage.setItem('wc26_last_sync_time', now.toISOString());
                  return;
                }
              }
            }
          } catch (e) {
            console.error("Failed to read metadata for auto-sync:", e);
          }
        }
        
        // Trigger silent background sync
        console.log("Triggering silent background sync with Google Sheet...");
        localStorage.setItem('wc26_last_sync_time', now.toISOString());
        await syncWithGoogleSheet(true);
      }
    };

    // Kickoff-based scheduler to run sync at exact start of next match
    const scheduleNextMatchSync = () => {
      if (matches.length === 0) return;

      if (nextMatchTimerRef.current) {
        clearTimeout(nextMatchTimerRef.current);
        nextMatchTimerRef.current = null;
      }

      const now = new Date();
      // Find matches starting in the future
      const futureMatches = matches
        .map(m => ({ id: m.id, time: new Date(m.datetime) }))
        .filter(m => m.time > now)
        .sort((a, b) => a.time - b.time);

      if (futureMatches.length > 0) {
        const nextMatch = futureMatches[0];
        const delay = nextMatch.time.getTime() - now.getTime();
        console.log(`Scheduling auto-sync for Match #${nextMatch.id} at ${nextMatch.time.toISOString()} (in ${Math.round(delay/1000)} seconds)`);

        nextMatchTimerRef.current = setTimeout(async () => {
          console.log(`Match #${nextMatch.id} kicked off! Running automatic kickoff sync...`);
          localStorage.setItem('wc26_last_sync_time', new Date().toISOString());
          await syncWithGoogleSheet(true);
          // Reschedule for the subsequent match
          scheduleNextMatchSync();
        }, delay);
      }
    };

    // Delay auto-sync check slightly after mount
    const timer = setTimeout(() => {
      triggerAutoSync();
      scheduleNextMatchSync();
    }, 4000);

    // Set up periodic interval check (every 10 minutes)
    if (!autoSyncIntervalRef.current) {
      autoSyncIntervalRef.current = setInterval(() => {
        console.log("Periodic 10-minute background sync check...");
        triggerAutoSync();
      }, 10 * 60 * 1000);
    }

    return () => {
      clearTimeout(timer);
      if (nextMatchTimerRef.current) {
        clearTimeout(nextMatchTimerRef.current);
      }
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
        autoSyncIntervalRef.current = null;
      }
    };
  }, [matches.length, isOnlineMode]);

  // 7. Add expense log
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount) return;

    const newLog = {
      date: new Date().toISOString(),
      description: expenseDesc,
      amount: parseInt(expenseAmount),
      type: expenseType
    };

    const updatedExpenses = [newLog, ...expenseLogs];
    setExpenseLogs(updatedExpenses);

    if (isOnlineMode && db) {
      await setDoc(doc(collection(db, 'expenses')), newLog);
    } else {
      localStorage.setItem('wc26_expenses', JSON.stringify(updatedExpenses));
    }

    setExpenseDesc('');
    setExpenseAmount('');
    showToast("Đã thêm khoản chi tiêu liên hoan!", "success");
  };

  // Toggle member contribution paid status
  const handleToggleContribution = async (playerName) => {
    if (!isAdminLoggedIn) return;
    const current = memberContributions[playerName] || { paid: false, gtgt: 0 };
    const nextPaid = !current.paid;
    const updated = {
      ...memberContributions,
      [playerName]: {
        ...current,
        paid: nextPaid,
        paidAt: nextPaid ? new Date().toISOString() : null
      }
    };
    setMemberContributions(updated);
    if (isOnlineMode && db) {
      await setDoc(doc(db, 'config', 'contributions'), updated);
    } else {
      localStorage.setItem('wc26_contributions', JSON.stringify(updated));
    }
  };

  // Update GTGT amount for a player
  const handleUpdateGtgt = async (playerName, newAmount) => {
    const current = memberContributions[playerName] || { paid: false, gtgt: 0 };
    const updated = { ...memberContributions, [playerName]: { ...current, gtgt: parseInt(newAmount) || 0 } };
    setMemberContributions(updated);
    if (isOnlineMode && db) {
      await setDoc(doc(db, 'config', 'contributions'), updated);
    } else {
      localStorage.setItem('wc26_contributions', JSON.stringify(updated));
    }
  };

  // Filter matches based on selected filters
  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      const matchStage = selectedStage === 'all' || match.stage === selectedStage;
      const matchTeam = teamSearch === '' || 
        match.homeTeam.toLowerCase().includes(teamSearch.toLowerCase()) ||
        match.awayTeam.toLowerCase().includes(teamSearch.toLowerCase());
      return matchStage && matchTeam;
    });
  }, [matches, selectedStage, teamSearch]);

  // Export JSON Database
  const handleExportData = () => {
    const databaseExport = {
      players,
      matches,
      championBets,
      finalistBets,
      pinsMap,
      expenseLogs,
      rules,
      memberContributions
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(databaseExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wc26_database_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Đã tải về file sao lưu dữ liệu!", "success");
  };

  // Import JSON Database
  const handleImportData = (e) => {
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.matches && imported.players) {
          setMatches(imported.matches);
          setPlayers(imported.players);
          setChampionBets(imported.championBets || {});
          setFinalistBets(imported.finalistBets || {});
          setPinsMap(imported.pinsMap || {});
          setExpenseLogs(imported.expenseLogs || []);
          setRules(imported.rules || rules);
          setMemberContributions(imported.memberContributions || {});

          if (isOnlineMode && db) {
            // Upload everything to firebase
            setIsSyncing(true);
            showToast("Đang tải dữ liệu import lên Cloud...", "info");
            for (const match of imported.matches) {
              await setDoc(doc(db, 'matches', String(match.id)), match);
            }
            await setDoc(doc(db, 'config', 'players_list'), { names: imported.players });
            await setDoc(doc(db, 'config', 'bets'), {
              championBets: imported.championBets || {},
              finalistBets: imported.finalistBets || {}
            });
            await setDoc(doc(db, 'config', 'pins'), { pins: imported.pinsMap || {} });
            await setDoc(doc(db, 'config', 'rules'), imported.rules || rules);
            
            // Re-import expenses
            // Note: Simplification just sets state, sync in database
            showToast("Đã khôi phục dữ liệu lên Cloud thành công!", "success");
          } else {
            localStorage.setItem('wc26_matches', JSON.stringify(imported.matches));
            localStorage.setItem('wc26_players', JSON.stringify(imported.players));
            localStorage.setItem('wc26_champion_bets', JSON.stringify(imported.championBets || {}));
            localStorage.setItem('wc26_finalist_bets', JSON.stringify(imported.finalistBets || {}));
            localStorage.setItem('wc26_pins', JSON.stringify(imported.pinsMap || {}));
            localStorage.setItem('wc26_expenses', JSON.stringify(imported.expenseLogs || []));
            localStorage.setItem('wc26_rules', JSON.stringify(imported.rules || rules));
            localStorage.setItem('wc26_contributions', JSON.stringify(imported.memberContributions || {}));
            showToast("Đã khôi phục dữ liệu Local thành công!", "success");
          }
        } else {
          showToast("File không đúng cấu trúc!", "error");
        }
      } catch (err) {
        showToast("Lỗi khi đọc file backup!", "error");
      }
    };
    if (e.target.files[0]) {
      fileReader.readAsText(e.target.files[0]);
    }
  };

  return (
    <div className="app-container">
      {/* Toast notifications */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <Trophy className="logo-icon" size={36} />
          <div className="app-title-container">
            <h1>Dự Đoán World Cup 2026</h1>
            <p>Giải dự đoán tỉ số vui vẻ • Nhóm KTAT</p>
          </div>
        </div>

        {/* User login & session status */}
        <div className="user-session-panel">
          {currentUser && localStorage.getItem('wc26_logged_user') ? (
            <div className="logged-in-badge glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UserCheck size={18} className="text-success" style={{ color: 'var(--color-success)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser}</span>
              <button onClick={handleLogout} className="logout-btn" title="Đăng xuất" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="login-trigger-wrapper" style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="select-input" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: 'auto' }}
                onChange={(e) => handleUserSelect(e.target.value)}
                value={currentUser || ''}
              >
                <option value="">-- Đăng nhập Người chơi --</option>
                {players.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {currentUser && (
                <form onSubmit={handlePinSubmit} style={{ display: 'flex', gap: '0.25rem' }}>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder={isRegisteringPin ? "Tạo PIN 4 số" : "Nhập PIN"}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="text-input"
                    style={{ padding: '0.4rem 0.8rem', width: '100px', fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="primary-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {isRegisteringPin ? "Đăng ký" : "Vào"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Stats Banner */}
      <section className="stats-banner">
        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <Coins size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Tổng Quỹ Phạt</span>
            <span className="stat-value" style={{ color: 'var(--color-warning)' }}>
              {totalFinesAll.toLocaleString()}đ
            </span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <Trophy size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Số Dư Quỹ</span>
            <span className="stat-value" style={{ color: 'var(--color-success)' }}>
              {expensesSummary.balance.toLocaleString()}đ
            </span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Trận Đã Đá</span>
            <span className="stat-value">
              {matches.filter(m => m.homeScore !== null).length} / 104
            </span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Người Tham Gia</span>
            <span className="stat-value">{players.length}</span>
          </div>
        </div>
      </section>

      {/* Nav Tabs */}
      <nav className="app-nav" style={{ marginBottom: '2rem' }}>
        <button 
          className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <Trophy size={18} />
          Bảng Xếp Hạng
        </button>
        <button 
          className={`nav-tab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <Calendar size={18} />
          Trận Đấu & Dự Đoán
        </button>
        <button 
          className={`nav-tab ${activeTab === 'player' ? 'active' : ''}`}
          onClick={() => setActiveTab('player')}
        >
          <Users size={18} />
          Xem Theo Người
        </button>
        <button 
          className={`nav-tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <Coins size={18} />
          Quỹ Liên Hoan
        </button>
        <button 
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={18} />
          Thiết Lập
        </button>
      </nav>

      {/* Tab Contents */}
      <main style={{ flex: 1 }}>
        {isSyncing && (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <RefreshCw className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} size={16} />
            <span>Đang cập nhật dữ liệu...</span>
          </div>
        )}

        {/* 1. Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="leaderboard-section">
            {/* Podium (Top 3) */}
            {leaderboard.length >= 3 && (
              <div className="podium-container">
                {/* Rank 2 */}
                <div className="podium-item podium-2">
                  <div className="podium-avatar-wrapper">
                    <div className="podium-avatar">🥈</div>
                  </div>
                  <div className="podium-name">{leaderboard[1].name}</div>
                  <div className="podium-value">{leaderboard[1].totalFine.toLocaleString()}đ</div>
                  <div className="podium-pedestal">2</div>
                </div>

                {/* Rank 1 */}
                <div className="podium-item podium-1">
                  <div className="podium-avatar-wrapper">
                    <Trophy className="podium-crown" size={32} />
                    <div className="podium-avatar">🥇</div>
                  </div>
                  <div className="podium-name">{leaderboard[0].name}</div>
                  <div className="podium-value">{leaderboard[0].totalFine.toLocaleString()}đ</div>
                  <div className="podium-pedestal">1</div>
                </div>

                {/* Rank 3 */}
                <div className="podium-item podium-3">
                  <div className="podium-avatar-wrapper">
                    <div className="podium-avatar">🥉</div>
                  </div>
                  <div className="podium-name">{leaderboard[2].name}</div>
                  <div className="podium-value">{leaderboard[2].totalFine.toLocaleString()}đ</div>
                  <div className="podium-pedestal">3</div>
                </div>
              </div>
            )}

            {/* Bảng Vinh Danh & Danh Hiệu Hài Hước */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎖️ Bảng Vinh Danh & Danh Hiệu Hài Hước
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {Object.entries(playerAchievements.overview || {}).map(([key, info]) => {
                  if (info.players.length === 0) return null;
                  return (
                    <div 
                      key={key} 
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        padding: '1rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem'
                      }}
                      className="achievement-card"
                    >
                      <div style={{ fontSize: '2rem' }}>{info.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-gold)' }}>{info.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{info.desc}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          🏆 {info.players.join(', ')} 
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.25rem' }}>
                            ({key === 'dai_gia' ? `${info.count.toLocaleString()}đ` : `${info.count} trận`})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Leaderboard Table */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Đóng Quỹ Liên Hoan</h3>
              <div className="table-container">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => handleSort('rank')}>
                        Hạng {renderSortIcon('rank')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('name')}>
                        Người chơi {renderSortIcon('name')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('totalFine')}>
                        Tổng tiền phạt {renderSortIcon('totalFine')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('correctScores')}>
                        Đúng Tỉ Số (0k) {renderSortIcon('correctScores')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('correctOutcomes')}>
                        Đúng Hướng (50%) {renderSortIcon('correctOutcomes')}
                      </th>
                      <th className="sortable" onClick={() => handleSort('wrongOutcomes')}>
                        Sai Bét {renderSortIcon('wrongOutcomes')}
                      </th>
                      <th>GTGT</th>
                      <th>Tổng Cộng</th>
                      <th>Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLeaderboard.map((player, idx) => {
                      const isLogged = player.name === currentUser;
                      const matchesPlayed = player.correctScores + player.correctOutcomes + player.wrongOutcomes;
                      return (
                        <tr key={player.name} className={`leaderboard-row ${isLogged ? 'current-user' : ''}`}>
                          <td>
                            <span className={`rank-badge rank-${player.originalRank}`}>{player.originalRank}</span>
                          </td>
                          <td>
                            <div className="player-name-cell">
                              {player.name}
                              {player.name === "E Sơn" && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-gold)' }}>🤖 Iron Man</span>}
                              {isLogged && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>Bạn</span>}
                              {playerAchievements.byPlayer[player.name]?.map(badge => (
                                <span 
                                  key={badge.key} 
                                  title={`${badge.label}: ${badge.desc} (${badge.key === 'dai_gia' ? badge.count.toLocaleString() + 'đ' : badge.count + ' trận'})`}
                                  style={{ cursor: 'help', fontSize: '0.9rem', marginLeft: '0.15rem' }}
                                >
                                  {badge.emoji}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="fine-amount danger" style={{ color: player.totalFine > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {player.totalFine.toLocaleString()}đ
                          </td>
                          <td>
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{player.correctScores}</span>
                          </td>
                          <td>
                            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{player.correctOutcomes}</span>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{player.wrongOutcomes}</span>
                          </td>
                          <td>
                            {isAdminLoggedIn ? (
                              <input
                                type="number"
                                value={memberContributions[player.name]?.gtgt || 0}
                                min={0}
                                step={10000}
                                onChange={(e) => handleUpdateGtgt(player.name, e.target.value)}
                                className="text-input"
                                style={{ width: '100px', padding: '0.3rem 0.5rem', textAlign: 'right', fontSize: '0.85rem' }}
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{(memberContributions[player.name]?.gtgt || 0).toLocaleString()}đ</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>
                              {(player.totalFine + (memberContributions[player.name]?.gtgt || 0)).toLocaleString()}đ
                            </span>
                          </td>
                          <td>
                            {isAdminLoggedIn ? (
                              <button
                                onClick={() => handleToggleContribution(player.name)}
                                className="contribution-toggle-btn"
                                style={{
                                  background: memberContributions[player.name]?.paid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: memberContributions[player.name]?.paid ? 'var(--color-success)' : 'var(--color-danger)',
                                  border: `1px solid ${memberContributions[player.name]?.paid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                {memberContributions[player.name]?.paid ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                {memberContributions[player.name]?.paid ? 'Đã đóng' : 'Chưa đóng'}
                              </button>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                color: memberContributions[player.name]?.paid ? 'var(--color-success)' : 'var(--color-danger)'
                              }}>
                                {memberContributions[player.name]?.paid ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                {memberContributions[player.name]?.paid ? 'Đã đóng' : 'Chưa đóng'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. Match Center Tab */}
        {activeTab === 'matches' && (
          <div className="match-center-section">
            <div className="match-filters glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              {/* Filter rounds */}
              <div className="round-selectors">
                <button 
                  className={`round-btn ${selectedStage === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedStage('all')}
                >
                  Tất cả các vòng
                </button>
                {Object.keys(STAGE_NAMES).map(stage => (
                  <button 
                    key={stage}
                    className={`round-btn ${selectedStage === stage ? 'active' : ''}`}
                    onClick={() => setSelectedStage(stage)}
                  >
                    {STAGE_NAMES[stage]}
                  </button>
                ))}
              </div>

              {/* Search teams */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', width: '240px' }}>
                <Search size={16} className="text-secondary" />
                <input 
                  type="text" 
                  placeholder="Tìm đội bóng..." 
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  style={{ fontSize: '0.85rem', width: '100%' }}
                />
              </div>

              {/* Admin Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!isAdminLoggedIn ? (
                  <form onSubmit={handleAdminLogin} style={{ display: 'flex', gap: '0.25rem' }}>
                    <input 
                      type="password"
                      placeholder="Mật khẩu Admin"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="text-input"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: '120px' }}
                    />
                    <button type="submit" className="primary-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'var(--color-danger)', color: '#fff', boxShadow: 'none' }}>
                      Admin
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button 
                      onClick={syncWithGoogleSheet}
                      className="admin-toggle-btn"
                      disabled={isSyncing}
                      style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                    >
                      <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none', display: 'inline' }} />
                      Đồng bộ
                    </button>
                    <button 
                      className="admin-toggle-btn active"
                      onClick={() => { setIsAdmin(!isAdmin); showToast(isAdmin ? "Tắt chế độ chỉnh sửa tỉ số" : "Đã bật chế độ chỉnh sửa tỉ số", "info"); }}
                    >
                      {isAdmin ? <Lock size={14} /> : <Unlock size={14} />}
                      {isAdmin ? "Khóa" : "Sửa"}
                    </button>
                    <button 
                      onClick={handleAdminLogout}
                      className="admin-toggle-btn"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Matches Grid */}
            <div className="match-grid">
              {filteredMatches.map(match => {
                const isPlayed = match.homeScore !== null && match.awayScore !== null;
                // Get prediction of currently logged in user
                const loggedUser = localStorage.getItem('wc26_logged_user');
                const userPred = loggedUser ? match.predictions[loggedUser] : null;
                const matchTime = new Date(match.datetime);
                const isLocked = matchTime <= new Date();

                // Calculate consensus statistics
                const predictionsList = Object.values(match.predictions || {}).filter(
                  p => p && p.homeScore !== null && p.awayScore !== null && p.homeScore !== undefined && p.awayScore !== undefined
                );
                const totalPreds = predictionsList.length;
                let homeWinCount = 0;
                let drawCount = 0;
                let awayWinCount = 0;
                let sumHomeScore = 0;
                let sumAwayScore = 0;

                predictionsList.forEach(p => {
                  sumHomeScore += Number(p.homeScore);
                  sumAwayScore += Number(p.awayScore);
                  if (Number(p.homeScore) > Number(p.awayScore)) homeWinCount++;
                  else if (Number(p.homeScore) < Number(p.awayScore)) awayWinCount++;
                  else drawCount++;
                });

                const homeWinPercent = totalPreds > 0 ? Math.round((homeWinCount / totalPreds) * 100) : 0;
                const drawPercent = totalPreds > 0 ? Math.round((drawCount / totalPreds) * 100) : 0;
                const awayWinPercent = totalPreds > 0 ? 100 - homeWinPercent - drawPercent : 0; // Ensure exactly 100% sum
                const avgHomeScore = totalPreds > 0 ? (sumHomeScore / totalPreds).toFixed(1) : 0;
                const avgAwayScore = totalPreds > 0 ? (sumAwayScore / totalPreds).toFixed(1) : 0;

                return (
                  <div key={match.id} className="match-card glass-panel">
                    <span className="match-id">#{match.id}</span>
                    
                    <div className="match-time">
                      {matchTime.toLocaleDateString('vi-VN', { 
                        weekday: 'short', 
                        month: 'numeric', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    <div className="match-teams">
                      <div className="team-info">
                        <span className="team-name">{match.homeTeam || "Chưa xác định"}</span>
                      </div>

                      {/* Score interface */}
                      {isAdmin && isAdminLoggedIn ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                          <div className="score-display" style={{ gap: '0.25rem' }}>
                            <input 
                              type="number"
                              min={0}
                              placeholder="-"
                              value={match.homeScore === null ? '' : match.homeScore}
                              onChange={(e) => handleUpdateActualScore(match.id, e.target.value, match.awayScore)}
                              className="score-input"
                            />
                            <span className="score-dash">:</span>
                            <input 
                              type="number"
                              min={0}
                              placeholder="-"
                              value={match.awayScore === null ? '' : match.awayScore}
                              onChange={(e) => handleUpdateActualScore(match.id, match.homeScore, e.target.value)}
                              className="score-input"
                            />
                          </div>
                          {isPlayed && (
                            <button 
                              onClick={() => handleUpdateActualScore(match.id, '', '')}
                              style={{ 
                                fontSize: '0.65rem', 
                                color: 'var(--color-danger)', 
                                cursor: 'pointer',
                                background: 'rgba(239, 68, 68, 0.1)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontWeight: 700
                              }}
                            >
                              Reset tỉ số
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="score-display">
                          <span>{match.homeScore !== null ? match.homeScore : '-'}</span>
                          <span className="score-dash">:</span>
                          <span>{match.awayScore !== null ? match.awayScore : '-'}</span>
                        </div>
                      )}

                      <div className="team-info">
                        <span className="team-name">{match.awayTeam || "Chưa xác định"}</span>
                      </div>
                    </div>

                    {/* Consensus display */}
                    {totalPreds > 0 && (
                      <div className="consensus-container" style={{ margin: '0.75rem 0', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.015)', borderRadius: '6px', border: '1px dashed var(--border-color)', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontSize: '0.7rem', fontWeight: 600 }}>
                          <span>ĐỒNG THUẬN CẢ NHÓM</span>
                          <span style={{ color: 'var(--color-gold)' }}>Dự kiến TB: {avgHomeScore} - {avgAwayScore}</span>
                        </div>
                        {/* Visual Segment Bar */}
                        <div style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', display: 'flex', background: 'var(--bg-secondary)', marginBottom: '0.25rem' }}>
                          {homeWinPercent > 0 && (
                            <div style={{ width: `${homeWinPercent}%`, background: 'var(--color-success)', height: '100%' }} title={`Chủ nhà thắng: ${homeWinPercent}%`} />
                          )}
                          {drawPercent > 0 && (
                            <div style={{ width: `${drawPercent}%`, background: 'var(--color-warning)', height: '100%' }} title={`Hòa: ${drawPercent}%`} />
                          )}
                          {awayWinPercent > 0 && (
                            <div style={{ width: `${awayWinPercent}%`, background: 'var(--color-danger)', height: '100%' }} title={`Khách thắng: ${awayWinPercent}%`} />
                          )}
                        </div>
                        {/* Legend */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: homeWinPercent > 0 ? 'var(--color-success)' : 'inherit' }}>Chủ: {homeWinPercent}%</span>
                          <span style={{ color: drawPercent > 0 ? 'var(--color-warning)' : 'inherit' }}>Hòa: {drawPercent}%</span>
                          <span style={{ color: awayWinPercent > 0 ? 'var(--color-danger)' : 'inherit' }}>Khách: {awayWinPercent}%</span>
                        </div>
                      </div>
                    )}

                    {/* Bottom Prediction interface */}
                    <div className="match-prediction-summary">
                      {/* Detailed predictions modal trigger */}
                      <button 
                        className="pred-btn" 
                        onClick={() => setSelectedMatch(match)}
                      >
                        <Eye size={14} />
                        Dự đoán ({Object.keys(match.predictions).filter(name => match.predictions[name]?.homeScore !== null).length})
                      </button>

                      {/* Logged in user prediction entry */}
                      {loggedUser && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bạn đoán:</span>
                          {isLocked ? (
                            <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>
                              {userPred && userPred.homeScore !== null ? `${userPred.homeScore}-${userPred.awayScore}` : 'N/A'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <input 
                                type="number"
                                min={0}
                                placeholder="-"
                                value={userPred && userPred.homeScore !== null ? userPred.homeScore : ''}
                                onChange={(e) => handleSavePrediction(match.id, e.target.value, userPred?.awayScore ?? '')}
                                className="score-input"
                                style={{ width: '32px', height: '26px', fontSize: '0.8rem', padding: 0 }}
                              />
                              <span>-</span>
                              <input 
                                type="number"
                                min={0}
                                placeholder="-"
                                value={userPred && userPred.awayScore !== null ? userPred.awayScore : ''}
                                onChange={(e) => handleSavePrediction(match.id, userPred?.homeScore ?? '', e.target.value)}
                                className="score-input"
                                style={{ width: '32px', height: '26px', fontSize: '0.8rem', padding: 0 }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Player Details Tab */}
        {activeTab === 'player' && (
          <div className="player-details-section">
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Chọn người chơi xem chi tiết:</span>
              <select 
                className="select-input" 
                style={{ width: '240px' }}
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
              >
                {players.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {selectedPlayerStats && (
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
                {/* Left Card: Summary Stats */}
                <div className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-secondary)', border: '2px solid var(--color-gold)', display: 'flex', alignItems: 'center', justifyContents: 'center', fontSize: '1.5rem', margin: '0 auto 0.75rem auto' }}>
                      ⚽
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedPlayerStats.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Thành viên KTAT Pool</p>
                    {playerAchievements.byPlayer[selectedPlayer]?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
                        {playerAchievements.byPlayer[selectedPlayer].map(badge => (
                          <span 
                            key={badge.key}
                            title={`${badge.label}: ${badge.desc}`}
                            style={{ 
                              background: 'rgba(245, 158, 11, 0.1)', 
                              color: 'var(--color-gold)', 
                              fontSize: '0.7rem', 
                              padding: '0.15rem 0.4rem', 
                              borderRadius: '4px', 
                              fontWeight: 600,
                              cursor: 'help',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            <span>{badge.emoji}</span>
                            <span>{badge.label}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span className="text-secondary">Tổng tiền phạt:</span>
                      <span className="fine-amount danger" style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                        {selectedPlayerStats.totalFine.toLocaleString()}đ
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span className="text-secondary">Trúng tỉ số (0k):</span>
                      <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{selectedPlayerStats.correctScores} trận</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span className="text-secondary">Đúng hướng (50%):</span>
                      <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>{selectedPlayerStats.correctOutcomes} trận</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                      <span className="text-secondary">Đoán sai bét:</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{selectedPlayerStats.wrongOutcomes} trận</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                      <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Dự đoán Vô Địch:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{selectedPlayerStats.champion}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Dự đoán 2 đội Chung kết:</span>
                      <span style={{ fontWeight: 700 }}>{selectedPlayerStats.finalists}</span>
                    </div>

                    {/* Prediction Outcome Ratio Bar */}
                    {(() => {
                      const total = selectedPlayerStats.correctScores + selectedPlayerStats.correctOutcomes + selectedPlayerStats.wrongOutcomes;
                      if (total === 0) return null;
                      const csPct = Math.round((selectedPlayerStats.correctScores / total) * 100);
                      const coPct = Math.round((selectedPlayerStats.correctOutcomes / total) * 100);
                      const woPct = 100 - csPct - coPct;

                      return (
                        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỉ Lệ Kết Quả Dự Đoán</h4>
                          {/* Stacked bar */}
                          <div style={{ height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', background: 'var(--bg-secondary)', marginBottom: '0.5rem' }}>
                            {csPct > 0 && (
                              <div style={{ width: `${csPct}%`, background: 'var(--color-success)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#000', fontWeight: 800 }} title={`Đúng tỉ số: ${csPct}%`}>
                                {csPct > 12 && `${csPct}%`}
                              </div>
                            )}
                            {coPct > 0 && (
                              <div style={{ width: `${coPct}%`, background: 'var(--color-warning)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#000', fontWeight: 800 }} title={`Đúng hướng: ${coPct}%`}>
                                {coPct > 12 && `${coPct}%`}
                              </div>
                            )}
                            {woPct > 0 && (
                              <div style={{ width: `${woPct}%`, background: 'var(--text-muted)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff', fontWeight: 800 }} title={`Sai bét: ${woPct}%`}>
                                {woPct > 12 && `${woPct}%`}
                              </div>
                            )}
                          </div>
                          {/* Legend */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>Đúng tỉ số:</span>
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>{selectedPlayerStats.correctScores} ({csPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-warning)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>Đúng hướng:</span>
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{selectedPlayerStats.correctOutcomes} ({coPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>Sai bét:</span>
                              </div>
                              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedPlayerStats.wrongOutcomes} ({woPct}%)</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right: History Grid */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  {/* Rank Fluctuation Line Chart */}
                  {(() => {
                    if (playerRankHistory.length === 0) return null;
                    const leftPadding = 30;
                    const rightPadding = 15;
                    const topPadding = 15;
                    const bottomPadding = 20;
                    const chartWidth = 550 - leftPadding - rightPadding;
                    const chartHeight = 160 - topPadding - bottomPadding;
                    const totalPlayers = players.length;

                    const points = playerRankHistory.map((pt, idx) => {
                      const x = leftPadding + (idx / Math.max(1, playerRankHistory.length - 1)) * chartWidth;
                      const y = topPadding + ((pt.rank - 1) / Math.max(1, totalPlayers - 1)) * chartHeight;
                      return { ...pt, x, y };
                    });

                    return (
                      <div style={{ position: 'relative', width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Biến Động Thứ Hạng</h4>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hạng 1 ở đỉnh biểu đồ • Hover xem chi tiết</span>
                        </div>
                        <div style={{ width: '100%', overflowX: 'auto' }}>
                          <svg viewBox="0 0 550 160" width="100%" height="160" style={{ display: 'block', overflow: 'visible' }}>
                            {/* Grid lines */}
                            {[1, Math.round(totalPlayers / 3), Math.round(2 * totalPlayers / 3), totalPlayers].map((r, i) => {
                              const yVal = topPadding + ((r - 1) / Math.max(1, totalPlayers - 1)) * chartHeight;
                              return (
                                <g key={i}>
                                  <line x1={leftPadding} y1={yVal} x2={550 - rightPadding} y2={yVal} stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
                                  <text x={leftPadding - 8} y={yVal + 3} fill="var(--text-muted)" fontSize="9" textAnchor="end">{r}</text>
                                </g>
                              );
                            })}
                            
                            {/* Trend Line */}
                            <path 
                              d={points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')} 
                              fill="none" 
                              stroke="var(--color-gold)" 
                              strokeWidth="2.5" 
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Dots */}
                            {points.map((pt, idx) => (
                              <circle
                                key={idx}
                                cx={pt.x}
                                cy={pt.y}
                                r={3.5}
                                fill="var(--bg-secondary)"
                                stroke="var(--color-gold)"
                                strokeWidth="2"
                                className="chart-dot"
                                onMouseEnter={(e) => {
                                  const rect = e.target.getBoundingClientRect();
                                  const parentRect = e.currentTarget.ownerSVGElement.parentElement.parentElement.getBoundingClientRect();
                                  setActiveChartTooltip({
                                    x: rect.left - parentRect.left + rect.width / 2,
                                    y: rect.top - parentRect.top,
                                    matchLabel: pt.matchLabel,
                                    rank: pt.rank,
                                    fine: pt.fine
                                  });
                                }}
                                onMouseLeave={() => setActiveChartTooltip(null)}
                              />
                            ))}
                          </svg>
                        </div>
                        {activeChartTooltip && (
                          <div 
                            className="chart-tooltip" 
                            style={{ 
                              left: `${activeChartTooltip.x}px`, 
                              top: `${activeChartTooltip.y}px` 
                            }}
                          >
                            <span className="chart-tooltip-header">{activeChartTooltip.matchLabel}</span>
                            <span>Thứ hạng: <strong style={{ color: 'var(--color-gold)' }}>#{activeChartTooltip.rank}</strong></span>
                            <span>Phạt lũy kế: <strong>{activeChartTooltip.fine.toLocaleString()}đ</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 700 }}>Lịch Sử Dự Đoán & Tiền Phạt</h3>
                  <div className="table-container" style={{ maxHeight: '550px', overflowY: 'auto' }}>
                    <table className="leaderboard-table">
                      <thead>
                        <tr>
                          <th>Trận</th>
                          <th>Cặp đấu</th>
                          <th>Tỉ số thực tế</th>
                          <th>Dự đoán của {selectedPlayerStats.name}</th>
                          <th>Tiền phạt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPlayerStats.matchDetails.map(({ match, prediction, fine, isPlayed }) => (
                          <tr key={match.id} className="leaderboard-row">
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>#{match.id}</td>
                            <td style={{ fontWeight: 600 }}>{match.homeTeam} vs {match.awayTeam}</td>
                            <td style={{ fontWeight: 700 }}>
                              {isPlayed ? `${match.homeScore} - ${match.awayScore}` : 'Chưa diễn ra'}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {prediction && prediction.homeScore !== null ? `${prediction.homeScore} - ${prediction.awayScore}` : '-'}
                            </td>
                            <td>
                              {isPlayed ? (
                                <span style={{ 
                                  fontWeight: 700, 
                                  color: fine === 0 ? 'var(--color-success)' : fine === 0.5 * (rules[match.stage] || 10000) ? 'var(--color-warning)' : 'var(--color-danger)'
                                }}>
                                  {fine > 0 ? `${fine.toLocaleString()}đ` : '0đ'}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Expenses Tab */}
        {activeTab === 'expenses' && (
          <div className="expenses-section">
            <div className="expense-summary">
              <div className="stat-card glass-panel">
                <div className="stat-icon-wrapper" style={{ color: 'var(--color-success)' }}>
                  <Coins size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Tổng Quỹ Phạt Đã Thu (gồm GTGT)</span>
                  <span className="stat-value" style={{ color: 'var(--color-success)' }}>
                    {totalFinesCollected.toLocaleString()}đ
                  </span>
                </div>
              </div>

              <div className="stat-card glass-panel">
                <div className="stat-icon-wrapper" style={{ color: 'var(--color-danger)' }}>
                  <TrendingDown size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Tổng Chi Tiêu Liên Hoan</span>
                  <span className="stat-value" style={{ color: 'var(--color-danger)' }}>
                    {expensesSummary.spent.toLocaleString()}đ
                  </span>
                </div>
              </div>

              <div className="stat-card glass-panel">
                <div className="stat-icon-wrapper" style={{ color: 'var(--color-gold)' }}>
                  <Trophy size={24} />
                </div>
                <div className="stat-info">
                  <span className="stat-label">Số Dư Quỹ Hiện Tại</span>
                  <span className="stat-value" style={{ color: 'var(--color-gold)' }}>
                    {expensesSummary.balance.toLocaleString()}đ
                  </span>
                </div>
              </div>
            </div>

            {/* Expense entries list */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Nhật Ký Chi Liên Hoan</h3>
                
                {/* Admin insert expense */}
                {isAdminLoggedIn && (
                  <form onSubmit={handleAddExpense} className="expense-form">
                    <div className="form-group">
                      <label>Nội dung chi/thu</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ví dụ: Mua bia, đồ ăn nhẹ..." 
                        value={expenseDesc} 
                        onChange={(e) => setExpenseDesc(e.target.value)} 
                        className="text-input" 
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Số tiền (VNĐ)</label>
                      <input 
                        type="number" 
                        required
                        min={0}
                        placeholder="Số tiền" 
                        value={expenseAmount} 
                        onChange={(e) => setExpenseAmount(e.target.value)} 
                        className="text-input" 
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Loại</label>
                      <select 
                        value={expenseType} 
                        onChange={(e) => setExpenseType(e.target.value)} 
                        className="select-input" 
                        style={{ padding: '0.45rem', fontSize: '0.85rem' }}
                      >
                        <option value="expense">Chi ra</option>
                        <option value="income">Thu thêm vào quỹ</option>
                      </select>
                    </div>
                    <button type="submit" className="primary-btn" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                      <Plus size={16} style={{ display: 'inline', marginRight: '0.2rem' }} /> Thêm
                    </button>
                  </form>
                )}
              </div>

              {/* Expenses table */}
              <div className="table-container">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Thời Gian / Ngày</th>
                      <th>Khoản mục</th>
                      <th>Thu/Chi</th>
                      <th>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedExpenseLogs.length === 0 ? (
                      <tr className="leaderboard-row">
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                          Chưa có nhật ký thu chi nào
                        </td>
                      </tr>
                    ) : (
                      combinedExpenseLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="leaderboard-row">
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {log.date ? new Date(log.date).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            }) : '-'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{log.description}</td>
                          <td style={{ color: log.type === 'expense' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {log.type === 'expense' ? 'Chi ra' : 'Thu vào'}
                          </td>
                          <td style={{ fontWeight: 700, color: log.type === 'expense' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {log.type === 'expense' ? '-' : '+'}{log.amount.toLocaleString()}đ
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-section glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Thiết Lập Hệ Thống & Cấu Hình Luật</h3>
            
            <div className="settings-grid">
              {/* Rules Configuration */}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-gold)' }}>Quy Định Mức Phạt Các Vòng</h4>
                <div className="rules-config-list">
                  {Object.keys(STAGE_NAMES).map(stage => (
                    <div key={stage} className="rule-config-item">
                      <span>{STAGE_NAMES[stage]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isAdminLoggedIn ? (
                          <input 
                            type="number"
                            value={rules[stage]}
                            step={1000}
                            onChange={(e) => {
                              const newRules = { ...rules, [stage]: parseInt(e.target.value) };
                              setRules(newRules);
                              if (isOnlineMode && db) {
                                setDoc(doc(db, 'config', 'rules'), newRules);
                              } else {
                                localStorage.setItem('wc26_rules', JSON.stringify(newRules));
                              }
                            }}
                            className="text-input"
                            style={{ width: '120px', padding: '0.35rem 0.5rem', textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{ fontWeight: 700 }}>{rules[stage].toLocaleString()}đ</span>
                        )}
                        <span>VNĐ</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DB Backups & Admin Credentials */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Admin Access Card */}
                <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-gold)' }}>Quyền Admin</h4>
                  {isAdminLoggedIn ? (
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Đang đăng nhập quyền Admin. Bạn có quyền cập nhật tỉ số thực tế, chỉnh sửa luật và cấu hình.
                      </p>
                      <button 
                        onClick={handleAdminLogout} 
                        className="primary-btn" 
                        style={{ background: 'var(--color-danger)', color: '#fff', fontSize: '0.85rem', width: '100%' }}
                      >
                        Đăng xuất Admin
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Nhập mật khẩu để đăng nhập quyền Admin.
                      </p>
                      <form onSubmit={handleAdminLogin} style={{ display: 'flex', gap: '0.35rem' }}>
                        <input 
                          type="password"
                          placeholder="Mật khẩu Admin"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="text-input"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', flex: 1 }}
                        />
                        <button type="submit" className="primary-btn" style={{ background: 'var(--color-danger)', color: '#fff', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                          Admin
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-gold)' }}>Backup & Restore Dữ Liệu</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Tải về toàn bộ trạng thái database bao gồm lịch thi đấu, dự đoán, mã PIN người chơi, và chi phí liên hoan để lưu trữ dự phòng.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={handleExportData} className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
                      <Download size={16} /> Export JSON
                    </button>
                    
                    {isAdminLoggedIn && (
                      <label className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <Upload size={16} /> Import JSON
                        <input 
                          type="file" 
                          accept=".json" 
                          onChange={handleImportData}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                  <h5 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Trạng thái kết nối</h5>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOnlineMode ? 'var(--color-success)' : 'var(--color-warning)' }} />
                    <span>
                      {isOnlineMode ? "Đang kết nối Firebase Cloud (Online)" : "Chạy cục bộ LocalStorage (Offline)"}
                    </span>
                  </div>
                  {!isOnlineMode && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Cung cấp các biến môi trường Firebase trong file `.env` để kích hoạt kết nối Cloud đồng bộ cho nhóm chơi.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{ marginTop: '3rem', padding: '1rem 0', borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        © 2026 World Cup Predictor app • KTAT Group • Chúc mọi người xem bóng vui vẻ! ⚽🏆
      </footer>

      {/* 6. MODAL: Detailed Match Predictions List */}
      {selectedMatch && (
        <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Dự Đoán Trận #{selectedMatch.id}: {selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</span>
              <button className="close-btn" onClick={() => setSelectedMatch(null)}>X</button>
            </div>
            
            <div className="predictions-list">
              {players.map(name => {
                const pred = selectedMatch.predictions[name];
                const fine = calculateFine(selectedMatch, pred, rules);
                const hasScore = selectedMatch.homeScore !== null && selectedMatch.awayScore !== null;
                const predDisplay = pred && pred.homeScore !== null ? `${pred.homeScore} - ${pred.awayScore}` : 'Chưa đoán';
                
                return (
                  <div key={name} className="player-pred-card">
                    <div className="player-pred-info">
                      <span className="player-pred-name">
                        {name} {name === "E Sơn" && "🤖"}
                      </span>
                      {hasScore && (
                        <span className={`player-pred-fine-badge ${
                          fine === 0 ? 'f-0' : fine === 0.5 * (rules[selectedMatch.stage] || 10000) ? 'f-half' : 'f-full'
                        }`}>
                          {fine === 0 ? 'Đúng tỷ số' : fine === 0.5 * (rules[selectedMatch.stage] || 10000) ? 'Đúng hướng (-50%)' : 'Đoán sai'}
                        </span>
                      )}
                    </div>
                    <div className="player-pred-score">
                      {predDisplay}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
