import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle, 
  RefreshCw, 
  TrendingDown, 
  Search, 
  Save, 
  Upload, 
  Download 
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
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Filters for Match Center
  const [selectedStage, setSelectedStage] = useState('all');
  const [teamSearch, setTeamSearch] = useState('');

  // Player view filters
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [expenseLogs, setExpenseLogs] = useState([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState('expense');

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

    if (localMatches && localPlayers) {
      setMatches(JSON.parse(localMatches));
      setPlayers(JSON.parse(localPlayers));
      setChampionBets(JSON.parse(localChampionBets || '{}'));
      setFinalistBets(JSON.parse(localFinalistBets || '{}'));
      setPinsMap(JSON.parse(localPins || '{}'));
      setExpenseLogs(JSON.parse(localExpenses || '[]'));
      setRules(JSON.parse(localRules || JSON.stringify(rules)));
    } else {
      // Seed local storage with initialData
      localStorage.setItem('wc26_matches', JSON.stringify(initialData.matches));
      localStorage.setItem('wc26_players', JSON.stringify(initialData.players));
      localStorage.setItem('wc26_champion_bets', JSON.stringify(initialData.championBets || {}));
      localStorage.setItem('wc26_finalist_bets', JSON.stringify(initialData.finalistBets || {}));
      localStorage.setItem('wc26_pins', JSON.stringify({}));
      localStorage.setItem('wc26_expenses', JSON.stringify([]));
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

    // Sort players by totalFine ascending (least fine wins!)
    stats.sort((a, b) => a.totalFine - b.totalFine || b.correctScores - a.correctScores);
    return stats;
  }, [players, matches, rules]);

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

  // Expenses management computations
  const totalFinesCollected = useMemo(() => {
    return leaderboard.reduce((acc, player) => acc + player.totalFine, 0);
  }, [leaderboard]);

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
      showToast("Đăng nhập quyền Admin thành công!", "success");
      setAdminPassword('');
    } else {
      showToast("Mật khẩu Admin sai!", "error");
    }
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
      rules
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
              {totalFinesCollected.toLocaleString()}đ
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

            {/* Detailed Leaderboard Table */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>Danh Sách Đóng Phạt Chi Tiết</h3>
              <div className="table-container">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>Người chơi</th>
                      <th>Tổng tiền phạt</th>
                      <th>Đúng Tỉ Số (0k)</th>
                      <th>Đúng Hướng (50%)</th>
                      <th>Sai Bét</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, idx) => {
                      const isLogged = player.name === currentUser;
                      const matchesPlayed = player.correctScores + player.correctOutcomes + player.wrongOutcomes;
                      return (
                        <tr key={player.name} className={`leaderboard-row ${isLogged ? 'current-user' : ''}`}>
                          <td>
                            <span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span>
                          </td>
                          <td>
                            <div className="player-name-cell">
                              {player.name}
                              {player.name === "E Sơn" && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-gold)' }}>🤖 Bot Average</span>}
                              {isLogged && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)' }}>Bạn</span>}
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
                  <button 
                    className="admin-toggle-btn active"
                    onClick={() => { setIsAdmin(!isAdmin); showToast(isAdmin ? "Tắt chế độ chỉnh sửa tỉ số" : "Đã bật chế độ chỉnh sửa tỉ số", "info"); }}
                  >
                    {isAdmin ? <Lock size={14} /> : <Unlock size={14} />}
                    {isAdmin ? "Khóa Tỉ Số" : "Nhập Tỉ Số"}
                  </button>
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
                  </div>
                </div>

                {/* Right: History Grid */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
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
                  <span className="stat-label">Tổng Quỹ Phạt Đã Thu</span>
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
                      <th>Ngày</th>
                      <th>Khoản mục</th>
                      <th>Thu/Chi</th>
                      <th>Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Add initial income balance if any */}
                    <tr className="leaderboard-row">
                      <td style={{ color: 'var(--text-muted)' }}>Hệ thống</td>
                      <td style={{ fontWeight: 600 }}>Quỹ phạt thu từ trò chơi dự đoán</td>
                      <td style={{ color: 'var(--color-success)' }}>Thu nhập</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>+{totalFinesCollected.toLocaleString()}đ</td>
                    </tr>
                    {expenseLogs.map((log, idx) => (
                      <tr key={idx} className="leaderboard-row">
                        <td style={{ color: 'var(--text-muted)' }}>
                          {new Date(log.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td style={{ fontWeight: 600 }}>{log.description}</td>
                        <td style={{ color: log.type === 'expense' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {log.type === 'expense' ? 'Chi ra' : 'Thu vào'}
                        </td>
                        <td style={{ fontWeight: 700, color: log.type === 'expense' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {log.type === 'expense' ? '-' : '+'}{log.amount.toLocaleString()}đ
                        </td>
                      </tr>
                    ))}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
