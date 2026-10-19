import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check, X, Settings, Users, ShieldCheck, Plus, Trash2, ChevronLeft, ChevronRight,
  Lock, LockOpen, CalendarDays, Clock, ClipboardList, Ban, Trophy, ListOrdered, Timer, Layers,
  Wallet, Circle, Crown,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Þessi tvö gildi eru örugg í kóðanum (publishable key, ekki secret key).
const SUPABASE_URL = "https://wpeaeegqyevhswqqiapo.supabase.co";
const SUPABASE_KEY = "sb_publishable_7FWzFHGH7_Tb0Kzfh4SGtg_rY_1-naY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sömu köll og window.storage notaði í Claude artifact-inu, en vistar í Supabase í staðinn.
const storage = {
  async get(key) {
    const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: JSON.stringify(data.value) };
  },
  async set(key, value) {
    const parsed = JSON.parse(value);
    const { error } = await supabase.from("app_data").upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value };
  },
};

const DAYS = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];

const POSITIONS = [
  { code: "GK", label: "Markvörður" },
  { code: "DF", label: "Varnarmaður" },
  { code: "MF", label: "Miðjumaður" },
  { code: "LM", label: "Vinstri kantmaður" },
  { code: "RM", label: "Hægri kantmaður" },
  { code: "ST", label: "Framherji" },
];

const C = {
  bgDark: "#0F2E1E",
  bgDarkBorder: "#2A5A3E",
  navBg: "#123825",
  textLight: "#E9E4D4",
  textMuted: "#7FAE8F",
  gold: "#D4A94F",
  cream: "#F5F3EC",
  ink: "#16211B",
  inkMuted: "#5C6B60",
  green: "#1B5E3C",
  greenLight: "#DDEEE1",
  tan: "#EAE6DA",
  tanBorder: "#C9C2AC",
  divider: "#E3DFD1",
  rust: "#B4574A",
  goldBg2: "#F3E6C6",
  goldText2: "#8A6A22",
  grayText: "#8A8370",
  teamBlue: "#2F5FA8",
  teamRed: "#C23B3B",
};

const DEFAULT_SETTINGS = {
  dayOfWeek: 2,
  time: "19:30",
  seasonStart: "2026-09-01",
  seasonEnd: "2027-05-31",
  adminPin: "1234",
  maxParticipants: 16,
  minParticipants: 8,
  requirePayment: false,
  allowGoals: true,
};

// Einföld strengjatætifall (FNV-1a). Notað til að raða jöfnum leikmönnum tilviljunarkennt
// en samt eins hjá öllum og á hverri endurhleðslu fyrir sömu æfingu.
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pad(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function getPracticeDates(settings) {
  if (!settings.seasonStart || !settings.seasonEnd) return [];
  const start = new Date(settings.seasonStart + "T00:00:00");
  const end = new Date(settings.seasonEnd + "T23:59:59");
  if (isNaN(start) || isNaN(end) || start > end) return [];
  const dates = [];
  const d = new Date(start);
  const diff = (settings.dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  let guard = 0;
  while (d <= end && guard < 500) {
    dates.push(toISODate(d));
    d.setDate(d.getDate() + 7);
    guard++;
  }
  return dates;
}

function practiceDateTime(dateISO, time) {
  return new Date(`${dateISO}T${time || "00:00"}:00`);
}

function fmtDateLong(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("is-IS", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtDateShort(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("is-IS", { day: "numeric", month: "short" });
}

function daysUntil(dateISO, time) {
  const now = new Date();
  const target = practiceDateTime(dateISO, time);
  return (target - now) / (1000 * 60 * 60 * 24);
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}klst`);
  parts.push(`${m}mín`);
  return parts.join(" ");
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [players, setPlayers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [cancelled, setCancelled] = useState({});
  const [matchStats, setMatchStats] = useState({});
  const [teamResults, setTeamResults] = useState({});
  const [costs, setCosts] = useState([]);
  const [newCostName, setNewCostName] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");
  const [periods, setPeriods] = useState([]);
  const [payments, setPayments] = useState({});
  const [financePeriodId, setFinancePeriodId] = useState(null);
  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false);
  const [showOlderPeriods, setShowOlderPeriods] = useState(false);
  const [newPeriodLabel, setNewPeriodLabel] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [newPeriodMainFee, setNewPeriodMainFee] = useState("5000");
  const [newPeriodSubFee, setNewPeriodSubFee] = useState("3000");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("attendance");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerRole, setNewPlayerRole] = useState("main");
  const [toast, setToast] = useState("");
  const [positionEditId, setPositionEditId] = useState(null);
  const [tempPriorities, setTempPriorities] = useState({});
  const [, forceTick] = useState(0);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  // re-render every 30s so countdowns stay live
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await storage.get("settings", true);
        if (s?.value) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s.value) });
      } catch (e) {}
      try {
        const p = await storage.get("players", true);
        if (p?.value) setPlayers(JSON.parse(p.value));
      } catch (e) {}
      try {
        const a = await storage.get("attendance", true);
        if (a?.value) setAttendance(JSON.parse(a.value));
      } catch (e) {}
      try {
        const c = await storage.get("cancelled", true);
        if (c?.value) setCancelled(JSON.parse(c.value));
      } catch (e) {}
      try {
        const ms = await storage.get("matchStats", true);
        if (ms?.value) setMatchStats(JSON.parse(ms.value));
      } catch (e) {}
      try {
        const tr = await storage.get("teamResults", true);
        if (tr?.value) setTeamResults(JSON.parse(tr.value));
      } catch (e) {}
      try {
        const co = await storage.get("costs", true);
        if (co?.value) setCosts(JSON.parse(co.value));
      } catch (e) {}
      try {
        const pr = await storage.get("periods", true);
        if (pr?.value) setPeriods(JSON.parse(pr.value));
      } catch (e) {}
      try {
        const pay = await storage.get("payments", true);
        if (pay?.value) setPayments(JSON.parse(pay.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  const saveSettings = useCallback(async (next) => {
    setSettings(next);
    try { await storage.set("settings", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista stillingar"); }
  }, [showToast]);

  const savePlayers = useCallback(async (next) => {
    setPlayers(next);
    try { await storage.set("players", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista leikmenn"); }
  }, [showToast]);

  const saveAttendance = useCallback(async (next) => {
    setAttendance(next);
    try { await storage.set("attendance", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista mætingu"); }
  }, [showToast]);

  const saveCancelled = useCallback(async (next) => {
    setCancelled(next);
    try { await storage.set("cancelled", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista fellda æfingu"); }
  }, [showToast]);

  const saveMatchStats = useCallback(async (next) => {
    setMatchStats(next);
    try { await storage.set("matchStats", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista úrslit"); }
  }, [showToast]);

  const saveTeamResults = useCallback(async (next) => {
    setTeamResults(next);
    try { await storage.set("teamResults", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista sigurlið"); }
  }, [showToast]);

  const saveCosts = useCallback(async (next) => {
    setCosts(next);
    try { await storage.set("costs", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista kostnað"); }
  }, [showToast]);

  const savePeriods = useCallback(async (next) => {
    setPeriods(next);
    try { await storage.set("periods", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista tímabil"); }
  }, [showToast]);

  const savePayments = useCallback(async (next) => {
    setPayments(next);
    try { await storage.set("payments", JSON.stringify(next), true); }
    catch (e) { showToast("Villa við að vista greiðslur"); }
  }, [showToast]);

  const practiceDates = useMemo(() => getPracticeDates(settings), [settings]);

  // Listinn inniheldur allar liðnar æfingar auk næstu 10, svo hægt sé að fletta aftur í tímann.
  // nextIdx er staðsetning næstu æfingar í listanum (sjálfgefið valin).
  const { upcoming, nextIdx } = useMemo(() => {
    const now = new Date();
    const idx = practiceDates.findIndex((d) => practiceDateTime(d, settings.time) >= now - 1000 * 60 * 60 * 6);
    const startIdx = idx === -1 ? Math.max(0, practiceDates.length - 1) : idx;
    return { upcoming: practiceDates.slice(0, startIdx + 10), nextIdx: startIdx };
  }, [practiceDates, settings.time]);

  useEffect(() => { setSelectedIdx(nextIdx); }, [upcoming.length, nextIdx]);

  // Haltu völdu dagsetningunni sýnilegri í dagsetningarrenningnum.
  useEffect(() => {
    const d = upcoming[selectedIdx];
    if (!d) return;
    const el = document.getElementById(`chip-${d}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedIdx, upcoming, tab, loaded]);

  useEffect(() => {
    if (financePeriodId || periods.length === 0) return;
    const todayISO = toISODate(new Date());
    const current = periods.find((p) => todayISO >= p.start && todayISO <= p.end);
    setFinancePeriodId(current ? current.id : periods[0].id);
  }, [periods, financePeriodId]);

  const selectedDate = upcoming[selectedIdx];
  const du = selectedDate ? daysUntil(selectedDate, settings.time) : null;

  const msToClose = selectedDate ? practiceDateTime(selectedDate, settings.time).getTime() - 60 * 60 * 1000 - Date.now() : null;
  const registrationClosed = msToClose !== null && msToClose <= 0;

  const mainOpen = du !== null && du <= 7 && du > -0.2 && !registrationClosed;
  const subOpen = du !== null && du <= 1 && du > -0.2 && !registrationClosed;

  function windowLabel(role) {
    if (du === null) return "";
    if (registrationClosed) return "Skráning lokuð";
    const open = role === "main" ? mainOpen : subOpen;
    if (open) return "Skráning opin";
    if (role === "main" && du > 7) return `Opnar eftir ${Math.ceil(du - 7)} daga`;
    if (role === "sub" && du > 1) return `Opnar eftir ${Math.ceil(du - 1)} daga`;
    return "Skráning lokuð";
  }

  function canMark(role) {
    if (isAdmin) return true;
    return role === "main" ? mainOpen : subOpen;
  }

  function setMark(playerId, value) {
    const next = { ...attendance };
    if (!next[selectedDate]) next[selectedDate] = {};
    const current = next[selectedDate][playerId];
    if (value === "yes" && current !== "yes" && !isAdmin) {
      if (settings.requirePayment) {
        const period = periodForDate(selectedDate);
        const hasPaid = !period || !!(payments[period.id] && payments[period.id][playerId]);
        if (period && !hasPaid) {
          showToast("Þarf að greiða æfingagjald til að skrá sig");
          return;
        }
      }
      const yesCount = players.filter((p) => next[selectedDate][p.id] === "yes").length;
      if (yesCount >= (settings.maxParticipants || 0)) {
        showToast("Æfingin er fullbókuð");
        return;
      }
    }
    next[selectedDate] = { ...next[selectedDate], [playerId]: value };
    saveAttendance(next);
  }

  const isCancelled = !!(selectedDate && cancelled[selectedDate]);

  function toggleCancelled() {
    const next = { ...cancelled };
    if (next[selectedDate]) {
      delete next[selectedDate];
      showToast("Æfing endurvakin");
    } else {
      next[selectedDate] = true;
      showToast("Æfing felld niður");
    }
    saveCancelled(next);
  }

  function tryUnlock() {
    if (pinInput === settings.adminPin) {
      setIsAdmin(true);
      setShowPinModal(false);
      setPinInput("");
      showToast("Þjálfaraaðgangur opinn");
    } else {
      showToast("Rangt PIN-númer");
    }
  }

  function addPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    savePlayers([...players, { id, name, role: newPlayerRole, positionPriority: {}, paid: false }]);
    setNewPlayerName("");
    showToast(`${name} bætt við`);
  }

  function removePlayer(id) {
    savePlayers(players.filter((p) => p.id !== id));
  }

  function toggleRole(id) {
    savePlayers(players.map((p) => (p.id === id ? { ...p, role: p.role === "main" ? "sub" : "main" } : p)));
  }

  function togglePaid(periodId, playerId) {
    if (!periodId) return;
    const next = { ...payments };
    const periodPayments = { ...(next[periodId] || {}) };
    periodPayments[playerId] = !periodPayments[playerId];
    next[periodId] = periodPayments;
    savePayments(next);
  }

  function addPeriod() {
    const label = newPeriodLabel.trim();
    if (!label || !newPeriodStart || !newPeriodEnd) return;
    const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    savePeriods([...periods, {
      id, label, start: newPeriodStart, end: newPeriodEnd,
      mainFee: Math.max(0, parseInt(newPeriodMainFee, 10) || 0),
      subFee: Math.max(0, parseInt(newPeriodSubFee, 10) || 0),
    }]);
    setNewPeriodLabel("");
    setNewPeriodStart("");
    setNewPeriodEnd("");
    setShowNewPeriodForm(false);
    setFinancePeriodId(id);
    showToast(`Tímabil "${label}" búið til`);
  }

  function startNewPeriod() {
    // Ef tímabil eru til fyrir, stinga upp á að nýja tímabilið byrji daginn eftir að því síðasta lýkur.
    if (periods.length > 0) {
      const latestEnd = [...periods].sort((a, b) => b.end.localeCompare(a.end))[0];
      const last = periods.find((p) => p.id === latestEnd.id);
      const nextDay = new Date(last.end + "T00:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      setNewPeriodStart(toISODate(nextDay));
      setNewPeriodMainFee(String(last.mainFee));
      setNewPeriodSubFee(String(last.subFee));
    }
    setNewPeriodLabel("");
    setNewPeriodEnd("");
    setShowNewPeriodForm(true);
  }

  function removePeriod(id) {
    savePeriods(periods.filter((p) => p.id !== id));
    if (financePeriodId === id) setFinancePeriodId(null);
  }

  function periodForDate(dateISO) {
    if (!dateISO) return null;
    return periods.find((pr) => dateISO >= pr.start && dateISO <= pr.end) || null;
  }

  function addCost() {
    const name = newCostName.trim();
    const amount = Math.max(0, parseInt(newCostAmount, 10) || 0);
    if (!name || !amount || !financePeriodId) return;
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    saveCosts([...costs, { id, name, amount, periodId: financePeriodId }]);
    setNewCostName("");
    setNewCostAmount("");
  }

  function removeCost(id) {
    saveCosts(costs.filter((c) => c.id !== id));
  }

  function openPositionEditor(p) {
    setPositionEditId(p.id);
    setTempPriorities({ ...(p.positionPriority || {}) });
  }

  function changeTempPriority(code, val) {
    setTempPriorities((prev) => {
      const next = { ...prev };
      if (val === "") delete next[code];
      else next[code] = Number(val);
      return next;
    });
  }

  function savePositionEditor() {
    savePlayers(players.map((p) => (p.id === positionEditId ? { ...p, positionPriority: tempPriorities } : p)));
    setPositionEditId(null);
    showToast("Stöður vistaðar");
  }

  function setMatchStat(playerId, field, value) {
    const num = Math.max(0, parseInt(value, 10) || 0);
    const next = { ...matchStats };
    if (!next[selectedDate]) next[selectedDate] = {};
    const row = next[selectedDate][playerId] || { goals: 0, wins: 0 };
    next[selectedDate] = { ...next[selectedDate], [playerId]: { ...row, [field]: num } };
    saveMatchStats(next);
  }

  // beforeDate (valkvæmt): telur aðeins æfingar fyrir þá dagsetningu. Notað við liðaskiptingu
  // svo liðin breytist ekki þegar mörk/úrslit þeirrar æfingar eru skráð eftir á.
  function attendanceCount(playerId, beforeDate) {
    return Object.entries(attendance).filter(([date, day]) => (!beforeDate || date < beforeDate) && day && day[playerId] === "yes").length;
  }
  function totalGoals(playerId, beforeDate) {
    return Object.entries(matchStats).reduce(
      (sum, [date, day]) => ((!beforeDate || date < beforeDate) ? sum + ((day && day[playerId] && day[playerId].goals) || 0) : sum),
      0
    );
  }
  // Stig = fjöldi æfinga þar sem leikmaðurinn var í liðinu sem vann.
  function totalWins(playerId, beforeDate) {
    return Object.entries(teamResults).reduce((sum, [date, r]) => {
      if (beforeDate && date >= beforeDate) return sum;
      const winners = r && (r.winner === "blue" ? r.blue : r.red);
      return sum + (winners && winners.some((x) => x.id === playerId) ? 1 : 0);
    }, 0);
  }

  // Fjöldi æfinga sem leikmaðurinn mætti á og fóru fram (ekki felldar niður og nógu margir skráðir).
  // Aðeins liðnar æfingar, og fyrir beforeDate ef það er gefið.
  function gamesPlayed(playerId, beforeDate) {
    const now = Date.now();
    return Object.entries(attendance).filter(([date, day]) => {
      if (!day || day[playerId] !== "yes") return false;
      if (beforeDate && date >= beforeDate) return false;
      if (cancelled[date]) return false;
      if (practiceDateTime(date, settings.time).getTime() > now) return false;
      const yesCount = Object.values(day).filter((v) => v === "yes").length;
      return yesCount >= (settings.minParticipants || 0);
    }).length;
  }
  // Vinningshlutfall = stig / æfingar sem fóru fram. 0 ef ekkert er skráð.
  function winRate(playerId, beforeDate) {
    const games = gamesPlayed(playerId, beforeDate);
    if (games === 0) return 0;
    return Math.min(1, totalWins(playerId, beforeDate) / games);
  }

  function setWinner(color) {
    if (!selectedDate || !teams) return;
    const existing = teamResults[selectedDate];
    const next = { ...teamResults };
    if (existing && existing.winner === color) {
      delete next[selectedDate];
      showToast("Sigurlið afskráð");
    } else {
      // Vistum hvernig liðin voru skipuð þegar sigurliðið er skráð, svo stigin haldist rétt.
      const base = existing || { blue: teams.teamA, red: teams.teamB };
      next[selectedDate] = { winner: color, blue: base.blue, red: base.red };
      showToast(color === "blue" ? "Bláir skráðir sigurvegarar" : "Rauðir skráðir sigurvegarar");
    }
    saveTeamResults(next);
  }

  function computeTeams(dateISO) {
    const confirmed = players.filter((p) => attendance[dateISO] && attendance[dateISO][p.id] === "yes");
    if (confirmed.length === 0) return null;

    const withRate = confirmed.map((p) => ({
      ...p,
      rate: winRate(p.id, dateISO),
      att: attendanceCount(p.id, dateISO),
      tie: hashStr(`${dateISO}:${p.id}`),
    }));
    // Hæsta vinningshlutfall fyrst. Jafnt hlutfall (líka 0 / ekkert skráð) raðast tilviljunarkennt,
    // en stöðugt fyrir hverja æfingu svo liðin breytist ekki við endurhleðslu.
    withRate.sort((a, b) => b.rate - a.rate || a.tie - b.tie || a.id.localeCompare(b.id));

    // Til skiptis: hæsta hlutfall í rauða liðið, næst hæsta í bláa, o.s.frv.
    // Sé fjöldinn oddatala fer sá neðsti í bláa liðið, svo það sé einum fleiri.
    const red = [];
    const blue = [];
    const extraBlue = withRate.length % 2 === 1 ? withRate[withRate.length - 1] : null;
    const alternating = extraBlue ? withRate.slice(0, -1) : withRate;
    alternating.forEach((p, i) => (i % 2 === 0 ? red : blue).push(p));
    if (extraBlue) blue.push(extraBlue);

    function assignPositions(team) {
      const ordered = [...team].sort((a, b) => b.att - a.att || a.name.localeCompare(b.name, "is"));
      const capacity = { GK: 1, DF: 3, MF: 2, LM: 1, RM: 1, ST: 1 };
      const counts = { GK: 0, DF: 0, MF: 0, LM: 0, RM: 0, ST: 0 };

      const result = ordered.map((p) => {
        const prefs = POSITIONS.map((pos) => pos.code)
          .slice()
          .sort((a, b) => {
            const pa = (p.positionPriority && p.positionPriority[a]) ?? 6;
            const pb = (p.positionPriority && p.positionPriority[b]) ?? 6;
            return pa - pb;
          });
        let chosen = prefs.find((code) => counts[code] < capacity[code]);
        if (!chosen) {
          chosen = Object.keys(counts).sort((a, b) => counts[a] - counts[b])[0];
        }
        counts[chosen] += 1;
        return { id: p.id, name: p.name, position: chosen };
      });
      return result;
    }

    // teamA = Bláir, teamB = Rauðir (sama og í birtingunni).
    return { teamA: assignPositions(blue), teamB: assignPositions(red) };
  }

  const mainPlayersRaw = players.filter((p) => p.role === "main");
  const subPlayers = players.filter((p) => p.role === "sub");
  const anyMainAttendance = mainPlayersRaw.some((p) => attendanceCount(p.id) > 0);
  const mainPlayers = [...mainPlayersRaw].sort((a, b) => {
    if (!anyMainAttendance) return a.name.localeCompare(b.name, "is");
    const diff = attendanceCount(b.id) - attendanceCount(a.id);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "is");
  });
  const maxMainAttendance = anyMainAttendance ? Math.max(...mainPlayersRaw.map((p) => attendanceCount(p.id))) : 0;
  const crownIds = anyMainAttendance ? mainPlayers.filter((p) => attendanceCount(p.id) === maxMainAttendance).map((p) => p.id) : [];

  const dayAttendance = attendance[selectedDate] || {};
  const comingCount = players.filter((p) => dayAttendance[p.id] === "yes").length;
  const maxReached = comingCount >= (settings.maxParticipants || 0);
  const confirmedPlayers = players.filter((p) => dayAttendance[p.id] === "yes");
  const notEnoughPlayers = registrationClosed && !isCancelled && confirmedPlayers.length < (settings.minParticipants || 0);
  const teams = registrationClosed && !isCancelled && !notEnoughPlayers ? computeTeams(selectedDate) : null;
  const teamResult = (selectedDate && teamResults[selectedDate]) || null;
  const shownTeams = teams ? (teamResult ? { teamA: teamResult.blue, teamB: teamResult.red } : teams) : null;
  const practiceStarted = selectedDate ? practiceDateTime(selectedDate, settings.time).getTime() <= Date.now() : false;
  const canSetWinner = !!teams && (isAdmin || practiceStarted);
  const currentPeriod = periodForDate(selectedDate);
  const isPaidFor = (playerId) => (currentPeriod ? !!(payments[currentPeriod.id] && payments[currentPeriod.id][playerId]) : null);

  const inputStyle = {
    width: "100%",
    border: `1px solid ${C.tanBorder}`,
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    background: "white",
    color: C.ink,
  };
  const labelStyle = { display: "block", fontSize: "0.75rem", color: C.inkMuted, marginBottom: "0.25rem" };
  const cardStyle = { background: C.cream, borderRadius: "1rem" };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bgDark, color: C.textLight }}>
        <div style={{ fontSize: "0.875rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>Hleð...</div>
      </div>
    );
  }

  const tabs = [
    { id: "attendance", label: "Æfingar", icon: ClipboardList },
    { id: "positions", label: "Stöður", icon: ListOrdered },
    { id: "stats", label: "Tölfræði", icon: Trophy },
    ...(isAdmin ? [
      { id: "players", label: "Leikmenn", icon: Users },
      { id: "finance", label: "Greiðslur", icon: Wallet },
      { id: "settings", label: "Stillingar", icon: Settings },
    ] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bgDark, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .display-font { font-family: 'Oswald', 'Arial Narrow', sans-serif; letter-spacing: 0.02em; }
        .pitch-lines {
          background-image: repeating-linear-gradient(0deg, rgba(245,243,236,0.05) 0px, rgba(245,243,236,0.05) 1px, transparent 1px, transparent 64px),
                             repeating-linear-gradient(90deg, rgba(245,243,236,0.05) 0px, rgba(245,243,236,0.05) 1px, transparent 1px, transparent 64px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <div className="pitch-lines" style={{ borderBottom: `1px solid ${C.bgDarkBorder}`, padding: "1.5rem 1.25rem 1rem" }}>
        <div style={{ maxWidth: 448, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="display-font" style={{ color: C.textLight, fontSize: "1.25rem", fontWeight: 600, textTransform: "uppercase", lineHeight: 1 }}>Mæting</div>
            <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.25rem" }}>Fótboltahópurinn</div>
          </div>
          <button
            onClick={() => (isAdmin ? setIsAdmin(false) : setShowPinModal(true))}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem",
              borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500,
              background: isAdmin ? C.gold : "transparent",
              color: isAdmin ? C.ink : C.textLight,
              border: `1px solid ${isAdmin ? C.gold : "#3E6B4E"}`,
            }}
          >
            {isAdmin ? <LockOpen size={13} /> : <Lock size={13} />}
            {isAdmin ? "Þjálfari" : "Læst"}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed", top: "1rem", left: "50%", transform: "translateX(-50%)", zIndex: 50,
          background: C.ink, color: C.textLight, fontSize: "0.875rem", padding: "0.5rem 1rem",
          borderRadius: "9999px", boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
        }}>
          {toast}
        </div>
      )}

      {showPinModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 1.5rem" }}
          onClick={() => setShowPinModal(false)}
        >
          <div style={{ ...cardStyle, padding: "1.25rem", width: "100%", maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="display-font" style={{ color: C.ink, fontWeight: 600, textTransform: "uppercase", marginBottom: "0.25rem" }}>Þjálfaraaðgangur</div>
            <p style={{ fontSize: "0.75rem", color: C.inkMuted, marginBottom: "0.75rem" }}>Sláðu inn PIN-númer til að opna stillingar og leikmannalista.</p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              placeholder="PIN"
              style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em", marginBottom: "0.75rem" }}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setShowPinModal(false)} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", fontSize: "0.875rem", color: C.inkMuted, background: C.tan, border: "none" }}>Hætta við</button>
              <button onClick={tryUnlock} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", fontSize: "0.875rem", color: "white", background: C.green, border: "none" }}>Opna</button>
            </div>
          </div>
        </div>
      )}

      {positionEditId && (() => {
        const p = players.find((pl) => pl.id === positionEditId);
        if (!p) return null;
        return (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "0 1.5rem" }}
            onClick={() => setPositionEditId(null)}
          >
            <div style={{ ...cardStyle, padding: "1.25rem", width: "100%", maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
              <div className="display-font" style={{ color: C.ink, fontWeight: 600, textTransform: "uppercase", marginBottom: "0.25rem" }}>{p.name} — stöður</div>
              <p style={{ fontSize: "0.75rem", color: C.inkMuted, marginBottom: "0.75rem" }}>1 = fyrsti kostur. Ekkert val = lægsti forgangur.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                {POSITIONS.map((pos) => (
                  <div key={pos.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: C.ink }}>{pos.code} · {pos.label}</span>
                    <select
                      value={tempPriorities[pos.code] ?? ""}
                      onChange={(e) => changeTempPriority(pos.code, e.target.value)}
                      style={{ border: `1px solid ${C.tanBorder}`, borderRadius: "0.375rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem", background: "white", color: C.ink }}
                    >
                      <option value="">–</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => setPositionEditId(null)} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", fontSize: "0.875rem", color: C.inkMuted, background: C.tan, border: "none" }}>Hætta við</button>
                <button onClick={savePositionEditor} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", fontSize: "0.875rem", color: "white", background: C.green, border: "none" }}>Vista</button>
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ maxWidth: 448, margin: "0 auto", padding: "0 1rem 6rem" }}>
        <div className="no-scrollbar" style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "1rem", marginBottom: "1rem", background: C.navBg, borderRadius: "1rem", padding: "0.375rem" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                padding: "0.5rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, border: "none", whiteSpace: "nowrap",
                background: tab === t.id ? C.textLight : "transparent",
                color: tab === t.id ? C.ink : C.textMuted,
              }}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "attendance" && (
          <>
            {upcoming.length === 0 ? (
              <div style={{ ...cardStyle, padding: "1.5rem", textAlign: "center", color: C.inkMuted, fontSize: "0.875rem", marginTop: "1.5rem" }}>
                Engar æfingar á skráðu tímabili. Farðu í Stillingar og settu upp æfingatíma.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <button
                    disabled={selectedIdx === 0}
                    onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
                    style={{ padding: "0.375rem", borderRadius: "9999px", background: C.navBg, color: C.textLight, border: "none", opacity: selectedIdx === 0 ? 0.3 : 1 }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="no-scrollbar" style={{ flex: 1, display: "flex", gap: "0.375rem", overflowX: "auto" }}>
                    {upcoming.map((d, i) => (
                      <button
                        key={d}
                        id={`chip-${d}`}
                        onClick={() => setSelectedIdx(i)}
                        style={{
                          flexShrink: 0, padding: "0.375rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem",
                          fontWeight: 500, border: "none",
                          opacity: i < nextIdx && i !== selectedIdx ? 0.65 : 1,
                          textDecoration: cancelled[d] ? "line-through" : "none",
                          background: i === selectedIdx ? C.gold : C.navBg,
                          color: i === selectedIdx ? C.ink : (cancelled[d] ? "#4E7A5E" : C.textMuted),
                        }}
                      >
                        {fmtDateShort(d)}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={selectedIdx === upcoming.length - 1}
                    onClick={() => setSelectedIdx((i) => Math.min(upcoming.length - 1, i + 1))}
                    style={{ padding: "0.375rem", borderRadius: "9999px", background: C.navBg, color: C.textLight, border: "none", opacity: selectedIdx === upcoming.length - 1 ? 0.3 : 1 }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div style={{ ...cardStyle, overflow: "hidden", boxShadow: "0 10px 25px rgba(0,0,0,0.25)" }}>
                  <div style={{ padding: "1rem 1.25rem 0.75rem", borderBottom: `1px dashed ${C.tanBorder}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: C.inkMuted, fontSize: "0.75rem" }}>
                        <CalendarDays size={13} />
                        <span style={{ textTransform: "capitalize" }}>{fmtDateLong(selectedDate)}</span>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={toggleCancelled}
                          style={{
                            display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", fontWeight: 500,
                            padding: "0.25rem 0.5rem", borderRadius: "9999px", border: "none",
                            background: isCancelled ? C.greenLight : "#F5DCD5",
                            color: isCancelled ? C.green : C.rust,
                          }}
                        >
                          <Ban size={12} />
                          {isCancelled ? "Endurvekja æfingu" : "Fella niður æfingu"}
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: C.inkMuted, fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                      <Clock size={13} />
                      <span>{settings.time}</span>
                    </div>
                    {!isCancelled && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.375rem" }}>
                        <div className="display-font" style={{ fontSize: "1.125rem", fontWeight: 600, color: C.ink }}>
                          {comingCount} af {settings.maxParticipants} skráðir
                        </div>
                        {notEnoughPlayers ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: C.rust, background: "#F5DCD5", padding: "0.25rem 0.625rem", borderRadius: "9999px" }}>
                            <Ban size={11} /> Ekki nóg skráð
                          </div>
                        ) : registrationClosed ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: C.inkMuted, background: C.tan, padding: "0.25rem 0.625rem", borderRadius: "9999px" }}>
                            <Lock size={11} /> Skráningu lokað
                          </div>
                        ) : maxReached ? (
                          <div style={{ fontSize: "0.75rem", fontWeight: 500, color: C.rust, background: "#F5DCD5", padding: "0.25rem 0.625rem", borderRadius: "9999px" }}>
                            Fullbókað
                          </div>
                        ) : msToClose !== null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 500, color: C.green, background: C.greenLight, padding: "0.25rem 0.625rem", borderRadius: "9999px" }}>
                            <Timer size={11} /> Lokar eftir {formatCountdown(msToClose)}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {isCancelled ? (
                    <div style={{ padding: "1.5rem 1.25rem", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: C.rust, fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                        <Ban size={16} />
                        Æfing felld niður
                      </div>
                      <p style={{ fontSize: "0.75rem", color: C.inkMuted }}>Engin skráning fer fram fyrir þessa æfingu.</p>
                    </div>
                  ) : notEnoughPlayers ? (
                    <div style={{ padding: "1.5rem 1.25rem", textAlign: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: C.rust, fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                        <Ban size={16} />
                        Æfing féll niður
                      </div>
                      <p style={{ fontSize: "0.75rem", color: C.inkMuted }}>
                        Aðeins {confirmedPlayers.length} af lágmarki {settings.minParticipants} skráðir. Þeir sem skráðu sig fá samt mætingarstig.
                      </p>
                    </div>
                  ) : (
                    <>
                      <RosterSection
                        title="Aðalmenn"
                        subtitle={windowLabel("main")}
                        open={mainOpen || isAdmin}
                        players={mainPlayers}
                        dayAttendance={dayAttendance}
                        isAdmin={isAdmin}
                        canMark={canMark("main")}
                        maxReached={maxReached}
                        requirePayment={settings.requirePayment && !!currentPeriod}
                        isPaidFor={isPaidFor}
                        crownIds={crownIds}
                        onMark={setMark}
                      />
                      <RosterSection
                        title="Varamenn"
                        subtitle={windowLabel("sub")}
                        open={subOpen || isAdmin}
                        players={subPlayers}
                        dayAttendance={dayAttendance}
                        isAdmin={isAdmin}
                        canMark={canMark("sub")}
                        maxReached={maxReached}
                        requirePayment={settings.requirePayment && !!currentPeriod}
                        isPaidFor={isPaidFor}
                        onMark={setMark}
                        isLast={!registrationClosed}
                      />

                      {registrationClosed && settings.allowGoals !== false && (
                        <div style={{ padding: "1rem 1.25rem", borderTop: `1px dashed ${C.tanBorder}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.5rem" }}>
                            <Trophy size={13} />
                            Markaskorarar
                          </div>
                          {confirmedPlayers.length === 0 ? (
                            <p style={{ fontSize: "0.75rem", color: C.grayText }}>Enginn skráður sem mætti.</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              {confirmedPlayers.map((p) => {
                                const row = (matchStats[selectedDate] && matchStats[selectedDate][p.id]) || { goals: 0, wins: 0 };
                                return (
                                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                                    <span style={{ fontSize: "0.8125rem", color: C.ink, flex: 1 }}>{p.name}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                      <span style={{ fontSize: "0.625rem", color: C.inkMuted }}>Mörk</span>
                                      <input
                                        type="number" min="0" value={row.goals}
                                        onChange={(e) => setMatchStat(p.id, "goals", e.target.value)}
                                        style={{ width: "3rem", border: `1px solid ${C.tanBorder}`, borderRadius: "0.375rem", padding: "0.25rem", fontSize: "0.8125rem", textAlign: "center" }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {!isAdmin && !isCancelled && !registrationClosed && (
                  <p style={{ textAlign: "center", fontSize: "0.625rem", color: C.textMuted, marginTop: "0.75rem", padding: "0 1rem" }}>
                    Aðalmenn skrá sig viku fyrir æfingu · Varamenn sólarhring fyrir æfingu · Skráningu lokar klukkutíma fyrir æfingu
                  </p>
                )}

                {!isCancelled && (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem", marginTop: "0.75rem", padding: "0 1rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.625rem", color: C.textMuted }}>
                      <Circle size={8} fill={C.green} color={C.green} /> Greitt
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.625rem", color: C.textMuted }}>
                      <Circle size={8} fill={C.rust} color={C.rust} /> Ógreitt
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.625rem", color: C.textMuted }}>
                      <Circle size={8} fill={C.tanBorder} color={C.tanBorder} /> Ekkert tímabil skráð
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.625rem", color: C.textMuted }}>
                      <Crown size={12} color={C.gold} fill={C.gold} /> Besta mætingin
                    </span>
                  </div>
                )}

                {shownTeams && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: C.textLight, fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.5rem" }}>
                      <Layers size={14} /> Liðaskipting
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <TeamCard title="Bláir" bg={C.teamBlue} team={shownTeams.teamA} isWinner={!!teamResult && teamResult.winner === "blue"} />
                      <TeamCard title="Rauðir" bg={C.teamRed} team={shownTeams.teamB} isWinner={!!teamResult && teamResult.winner === "red"} />
                    </div>

                    <div style={{ ...cardStyle, padding: "0.875rem 1rem", marginTop: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.5rem" }}>
                        <Trophy size={13} /> Hvort liðið vann?
                      </div>
                      {canSetWinner ? (
                        <>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            {[
                              { key: "blue", label: "Bláir unnu", color: C.teamBlue },
                              { key: "red", label: "Rauðir unnu", color: C.teamRed },
                            ].map((opt) => {
                              const selected = !!teamResult && teamResult.winner === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  onClick={() => setWinner(opt.key)}
                                  style={{
                                    flex: 1, minHeight: "2.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                                    borderRadius: "0.625rem", fontSize: "0.875rem", fontWeight: 600,
                                    border: `2px solid ${opt.color}`,
                                    background: selected ? opt.color : "transparent",
                                    color: selected ? "white" : opt.color,
                                  }}
                                >
                                  {selected && <Check size={16} />}
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <p style={{ fontSize: "0.6875rem", color: C.inkMuted, marginTop: "0.5rem" }}>
                            {teamResult
                              ? "Allir í sigurliðinu fá 1 stig í tölfræðinni. Ýttu aftur á valið til að afskrá."
                              : "Allir í sigurliðinu fá 1 stig í tölfræðinni."}
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: "0.75rem", color: C.inkMuted }}>Hægt verður að skrá sigurlið þegar æfingin er hafin.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "positions" && (
          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "1rem 1rem 0.5rem" }}>
                <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink }}>Valdar stöður</div>
                <p style={{ fontSize: "0.75rem", color: C.inkMuted, marginTop: "0.25rem" }}>Veldu allt að 6 stöður og raðaðu eftir því sem þú vilt helst spila. 1 = fyrsti kostur.</p>
              </div>
              {players.length === 0 && (
                <div style={{ padding: "0 1rem 1rem", fontSize: "0.875rem", color: C.inkMuted }}>Enginn leikmaður skráður ennþá.</div>
              )}
              {players.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => openPositionEditor(p)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.75rem 1rem", borderBottom: i !== players.length - 1 ? `1px solid ${C.divider}` : "none",
                    background: "transparent", border: "none",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", color: C.ink }}>{p.name}</span>
                  <span style={{ fontSize: "0.6875rem", color: C.inkMuted, textAlign: "right", maxWidth: "60%" }}>
                    {Object.keys(p.positionPriority || {}).length
                      ? Object.entries(p.positionPriority).sort((a, b) => a[1] - b[1]).map(([code, pri]) => `${pri}.${code}`).join("  ")
                      : "Engar stöður valdar"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 0.7fr 0.8fr", padding: "0.75rem 1rem", background: C.tan, fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", color: C.inkMuted }}>
                <span>Nafn</span><span style={{ textAlign: "center" }}>Mæt.</span><span style={{ textAlign: "center" }}>Mörk</span><span style={{ textAlign: "center" }}>Stig</span><span style={{ textAlign: "center" }}>Hlutf.</span>
              </div>
              {[...players].sort((a, b) => attendanceCount(b.id) - attendanceCount(a.id)).map((p, i) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 0.7fr 0.8fr", padding: "0.625rem 1rem", borderBottom: i !== players.length - 1 ? `1px solid ${C.divider}` : "none", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: C.ink }}>{p.name}</span>
                  <span style={{ fontSize: "0.8125rem", color: C.ink, textAlign: "center" }}>{attendanceCount(p.id)}</span>
                  <span style={{ fontSize: "0.8125rem", color: C.ink, textAlign: "center" }}>{totalGoals(p.id)}</span>
                  <span style={{ fontSize: "0.8125rem", color: C.ink, textAlign: "center" }}>{totalWins(p.id)}</span>
                  <span style={{ fontSize: "0.8125rem", color: C.ink, textAlign: "center" }}>
                    {gamesPlayed(p.id) > 0 ? `${Math.round(winRate(p.id) * 100)}%` : "–"}
                  </span>
                </div>
              ))}
              {players.length === 0 && (
                <div style={{ padding: "1rem", fontSize: "0.875rem", color: C.inkMuted }}>Engin tölfræði ennþá.</div>
              )}
            </div>
          </div>
        )}

        {tab === "players" && isAdmin && (
          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ ...cardStyle, padding: "1rem", marginBottom: "1rem" }}>
              <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>Bæta við leikmanni</div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                  placeholder="Nafn leikmanns"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={addPlayer} style={{ background: C.green, color: "white", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", border: "none" }}>
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["main", "sub"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setNewPlayerRole(r)}
                    style={{
                      flex: 1, fontSize: "0.75rem", padding: "0.375rem", borderRadius: "0.5rem", fontWeight: 500, border: "none",
                      background: newPlayerRole === r ? C.gold : C.tan,
                      color: newPlayerRole === r ? C.ink : C.inkMuted,
                    }}
                  >
                    {r === "main" ? "Aðalmaður" : "Varamaður"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div className="display-font" style={{ padding: "0.75rem 1rem 0.5rem", fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink }}>
                Leikmenn ({players.length})
              </div>
              {players.length === 0 && (
                <div style={{ padding: "0 1rem 1rem", fontSize: "0.875rem", color: C.inkMuted }}>Enginn leikmaður skráður ennþá.</div>
              )}
              {players.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 1rem", borderBottom: i !== players.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                  <span style={{ fontSize: "0.875rem", color: C.ink }}>{p.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button
                      onClick={() => toggleRole(p.id)}
                      style={{
                        fontSize: "0.625rem", fontWeight: 500, padding: "0.25rem 0.5rem", borderRadius: "9999px", border: "none",
                        background: p.role === "main" ? C.greenLight : C.goldBg2,
                        color: p.role === "main" ? C.green : C.goldText2,
                      }}
                    >
                      {p.role === "main" ? "Aðalmaður" : "Varamaður"}
                    </button>
                    <button onClick={() => removePlayer(p.id)} style={{ color: C.rust, padding: "0.25rem", background: "transparent", border: "none" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "finance" && isAdmin && (() => {
          const todayISO = toISODate(new Date());
          const sortedPeriods = [...periods].sort((a, b) => a.start.localeCompare(b.start));
          const currentAndFuture = sortedPeriods.filter((p) => p.end >= todayISO);
          const olderPeriods = sortedPeriods.filter((p) => p.end < todayISO);
          const activePeriod = periods.find((p) => p.id === financePeriodId) || null;
          const periodCosts = activePeriod ? costs.filter((c) => c.periodId === activePeriod.id) : [];
          const totalCosts = periodCosts.reduce((sum, c) => sum + c.amount, 0);
          const feeFor = (p) => (!activePeriod ? 0 : p.role === "main" ? activePeriod.mainFee : activePeriod.subFee);
          const totalDue = activePeriod ? players.reduce((sum, p) => sum + feeFor(p), 0) : 0;
          const periodPayments = activePeriod ? (payments[activePeriod.id] || {}) : {};
          const totalCollected = activePeriod ? players.filter((p) => periodPayments[p.id]).reduce((sum, p) => sum + feeFor(p), 0) : 0;
          const balance = totalCollected - totalCosts;

          const renderPeriodRow = (pr) => (
            <div
              key={pr.id}
              onClick={() => setFinancePeriodId(pr.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                padding: "0.625rem 0.75rem", borderRadius: "0.625rem",
                background: financePeriodId === pr.id ? C.gold : C.tan,
              }}
            >
              <div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: C.ink }}>{pr.label}</div>
                <div style={{ fontSize: "0.6875rem", color: financePeriodId === pr.id ? "#5C4A1E" : C.inkMuted }}>
                  {fmtDateShort(pr.start)} – {fmtDateShort(pr.end)} · {pr.mainFee.toLocaleString("is-IS")}/{pr.subFee.toLocaleString("is-IS")} kr
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removePeriod(pr.id); }}
                style={{ color: C.rust, padding: "0.25rem", background: "transparent", border: "none" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );

          return (
            <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Tímabil */}
              <div style={cardStyle}>
                <div style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink }}>Greiðslutímabil</div>
                    {!showNewPeriodForm && (
                      <button
                        onClick={startNewPeriod}
                        style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "white", background: C.green, borderRadius: "9999px", padding: "0.375rem 0.75rem", border: "none" }}
                      >
                        <Plus size={13} /> Hefja nýtt tímabil
                      </button>
                    )}
                  </div>

                  {sortedPeriods.length === 0 && !showNewPeriodForm ? (
                    <p style={{ fontSize: "0.8125rem", color: C.inkMuted, marginBottom: "0.75rem" }}>Ekkert tímabil til ennþá — ýttu á "Hefja nýtt tímabil" til að búa til það fyrsta.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: showNewPeriodForm ? "1rem" : 0 }}>
                      {currentAndFuture.length === 0 && olderPeriods.length > 0 && (
                        <p style={{ fontSize: "0.75rem", color: C.inkMuted }}>Ekkert gildandi tímabil núna — sjá eldri tímabil hér fyrir neðan, eða hefja nýtt.</p>
                      )}
                      {currentAndFuture.map(renderPeriodRow)}

                      {olderPeriods.length > 0 && (
                        <div style={{ marginTop: "0.25rem" }}>
                          <button
                            onClick={() => setShowOlderPeriods((v) => !v)}
                            style={{ fontSize: "0.75rem", fontWeight: 500, color: C.inkMuted, background: "transparent", border: "none", padding: "0.25rem 0" }}
                          >
                            {showOlderPeriods ? "▾" : "▸"} Eldri tímabil ({olderPeriods.length})
                          </button>
                          {showOlderPeriods && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                              {[...olderPeriods].reverse().map(renderPeriodRow)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {showNewPeriodForm && (
                    <div style={{ paddingTop: "0.75rem", borderTop: `1px dashed ${C.tanBorder}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: C.ink }}>Nýtt tímabil</div>
                        <button onClick={() => setShowNewPeriodForm(false)} style={{ fontSize: "0.75rem", color: C.inkMuted, background: "transparent", border: "none" }}>Hætta við</button>
                      </div>
                      <input
                        value={newPeriodLabel}
                        onChange={(e) => setNewPeriodLabel(e.target.value)}
                        placeholder="T.d. Vor 2027"
                        style={{ ...inputStyle, marginBottom: "0.5rem" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Byrjar</label>
                          <input type="date" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Endar</label>
                          <input type="date" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Gjald aðalmanna</label>
                          <input type="number" min="0" value={newPeriodMainFee} onChange={(e) => setNewPeriodMainFee(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Gjald varamanna</label>
                          <input type="number" min="0" value={newPeriodSubFee} onChange={(e) => setNewPeriodSubFee(e.target.value)} style={inputStyle} />
                        </div>
                      </div>
                      <button onClick={addPeriod} style={{ width: "100%", background: C.green, color: "white", borderRadius: "0.5rem", padding: "0.5rem", border: "none", fontSize: "0.8125rem", fontWeight: 500 }}>
                        Búa til tímabil
                      </button>
                    </div>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: C.ink, cursor: "pointer", marginTop: "1rem", paddingTop: "0.75rem", borderTop: `1px dashed ${C.tanBorder}` }}>
                    <input
                      type="checkbox"
                      checked={!!settings.requirePayment}
                      onChange={(e) => saveSettings({ ...settings, requirePayment: e.target.checked })}
                      style={{ width: "1.125rem", height: "1.125rem" }}
                    />
                    Þeir sem ekki hafa greitt fyrir gildandi tímabil geta ekki merkt sig á æfingu
                  </label>
                </div>
              </div>

              {!activePeriod ? (
                <div style={{ ...cardStyle, padding: "1.5rem", textAlign: "center", color: C.inkMuted, fontSize: "0.8125rem" }}>
                  Veldu tímabil hér fyrir ofan til að sjá kostnað og greiðslustöðu.
                </div>
              ) : (
                <>
                  {/* Yfirlit */}
                  <div style={cardStyle}>
                    <div style={{ padding: "1rem" }}>
                      <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.25rem" }}>Yfirlit — {activePeriod.label}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: C.inkMuted }}>Innheimt</div>
                          <div className="display-font" style={{ fontSize: "1.25rem", fontWeight: 600, color: C.green }}>{totalCollected.toLocaleString("is-IS")} kr</div>
                          <div style={{ fontSize: "0.625rem", color: C.grayText }}>af {totalDue.toLocaleString("is-IS")} kr samtals</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: C.inkMuted }}>Kostnaður samtals</div>
                          <div className="display-font" style={{ fontSize: "1.25rem", fontWeight: 600, color: C.rust }}>{totalCosts.toLocaleString("is-IS")} kr</div>
                        </div>
                      </div>
                      <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px dashed ${C.tanBorder}` }}>
                        <div style={{ fontSize: "0.6875rem", color: C.inkMuted }}>Staða (innheimt − kostnaður)</div>
                        <div className="display-font" style={{ fontSize: "1.25rem", fontWeight: 600, color: balance >= 0 ? C.green : C.rust }}>
                          {balance.toLocaleString("is-IS")} kr
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kostnaðarliðir */}
                  <div style={cardStyle}>
                    <div style={{ padding: "1rem" }}>
                      <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>
                        Kostnaðarliðir — {activePeriod.label}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <input
                          value={newCostName}
                          onChange={(e) => setNewCostName(e.target.value)}
                          placeholder="T.d. Leiga á velli"
                          style={{ ...inputStyle, flex: 2 }}
                        />
                        <input
                          type="number" min="0"
                          value={newCostAmount}
                          onChange={(e) => setNewCostAmount(e.target.value)}
                          placeholder="Kr"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button onClick={addCost} style={{ background: C.green, color: "white", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", border: "none" }}>
                          <Plus size={16} />
                        </button>
                      </div>
                      {periodCosts.length === 0 ? (
                        <p style={{ fontSize: "0.8125rem", color: C.inkMuted }}>Engir kostnaðarliðir skráðir á þessu tímabili ennþá.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {periodCosts.map((c) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "0.8125rem", color: C.ink }}>{c.name}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontSize: "0.8125rem", color: C.inkMuted }}>{c.amount.toLocaleString("is-IS")} kr</span>
                                <button onClick={() => removeCost(c.id)} style={{ color: C.rust, padding: "0.25rem", background: "transparent", border: "none" }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Greiðslustaða leikmanna */}
                  <div style={{ ...cardStyle, overflow: "hidden" }}>
                    <div className="display-font" style={{ padding: "1rem 1rem 0.5rem", fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink }}>
                      Greiðslustaða — {activePeriod.label}
                    </div>
                    {players.length === 0 && (
                      <div style={{ padding: "0 1rem 1rem", fontSize: "0.875rem", color: C.inkMuted }}>Enginn leikmaður skráður ennþá.</div>
                    )}
                    {players.map((p, i) => {
                      const hasPaid = !!periodPayments[p.id];
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.625rem 1rem", borderBottom: i !== players.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                          <div>
                            <div style={{ fontSize: "0.875rem", color: C.ink }}>{p.name}</div>
                            <div style={{ fontSize: "0.6875rem", color: C.grayText }}>{feeFor(p).toLocaleString("is-IS")} kr · {p.role === "main" ? "Aðalmaður" : "Varamaður"}</div>
                          </div>
                          <button
                            onClick={() => togglePaid(activePeriod.id, p.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 500,
                              padding: "0.375rem 0.75rem", borderRadius: "9999px", border: "none",
                              background: hasPaid ? C.greenLight : "#F5DCD5",
                              color: hasPaid ? C.green : C.rust,
                            }}
                          >
                            <Circle size={9} fill={hasPaid ? C.green : C.rust} color={hasPaid ? C.green : C.rust} />
                            {hasPaid ? "Greitt" : "Ógreitt"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {tab === "settings" && isAdmin && (
          <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={cardStyle}>
              <div style={{ padding: "1rem" }}>
                <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>Æfingatími</div>
                <label style={labelStyle}>Vikudagur</label>
                <select
                  value={settings.dayOfWeek}
                  onChange={(e) => saveSettings({ ...settings, dayOfWeek: Number(e.target.value) })}
                  style={{ ...inputStyle, marginBottom: "0.75rem" }}
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <label style={labelStyle}>Tímasetning</label>
                <input
                  type="time"
                  value={settings.time}
                  onChange={(e) => saveSettings({ ...settings, time: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ padding: "1rem" }}>
                <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>Tímabil</div>
                <label style={labelStyle}>Byrjar</label>
                <input
                  type="date"
                  value={settings.seasonStart}
                  onChange={(e) => saveSettings({ ...settings, seasonStart: e.target.value })}
                  style={{ ...inputStyle, marginBottom: "0.75rem" }}
                />
                <label style={labelStyle}>Endar</label>
                <input
                  type="date"
                  value={settings.seasonEnd}
                  onChange={(e) => saveSettings({ ...settings, seasonEnd: e.target.value })}
                  style={inputStyle}
                />
                <p style={{ fontSize: "0.6875rem", color: C.textMuted, marginTop: "0.5rem" }}>{practiceDates.length} æfingar á tímabilinu</p>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ padding: "1rem" }}>
                <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>Lágmarks- og hámarksþátttaka</div>
                <label style={labelStyle}>Lágmarksfjöldi svo æfing verði</label>
                <input
                  type="number"
                  min="1"
                  value={settings.minParticipants}
                  onChange={(e) => saveSettings({ ...settings, minParticipants: Math.max(1, Number(e.target.value) || 1) })}
                  style={{ ...inputStyle, marginBottom: "0.75rem" }}
                />
                <label style={labelStyle}>Fjöldi sem kemst að á hverja æfingu (hámark)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.maxParticipants}
                  onChange={(e) => saveSettings({ ...settings, maxParticipants: Math.max(1, Number(e.target.value) || 1) })}
                  style={inputStyle}
                />
                <p style={{ fontSize: "0.6875rem", color: C.inkMuted, marginTop: "0.5rem" }}>Ef færri en lágmarksfjöldi skrá sig fellur æfingin niður sjálfkrafa við lokun skráningar, en þeir sem skráðu sig halda mætingarstiginu sínu. Þjálfari getur alltaf skráð fram yfir hámarkið.</p>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ padding: "1rem" }}>
                <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>Markaskorarar</div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: C.ink, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={settings.allowGoals !== false}
                    onChange={(e) => saveSettings({ ...settings, allowGoals: e.target.checked })}
                    style={{ width: "1.125rem", height: "1.125rem" }}
                  />
                  Leyfa skráningu marka á æfingum
                </label>
                <p style={{ fontSize: "0.6875rem", color: C.inkMuted, marginTop: "0.5rem" }}>Þegar slökkt er á þessu birtist ekki reiturinn "Markaskorarar" undir æfingum. Mörk sem þegar eru skráð haldast í tölfræðinni.</p>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ padding: "1rem" }}>
                <div className="display-font" style={{ fontSize: "0.875rem", fontWeight: 600, textTransform: "uppercase", color: C.ink, marginBottom: "0.75rem" }}>PIN-númer þjálfara</div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={settings.adminPin}
                  onChange={(e) => saveSettings({ ...settings, adminPin: e.target.value })}
                  style={inputStyle}
                />
                <p style={{ fontSize: "0.6875rem", color: C.inkMuted, marginTop: "0.5rem" }}>Notað til að opna þjálfaraaðgang á þessu tæki.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCard({ title, bg, team, isWinner }) {
  return (
    <div style={{ background: bg, borderRadius: "0.875rem", padding: "0.75rem", minHeight: 120, color: "#fff", boxShadow: isWinner ? `0 0 0 3px ${C.gold}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div className="display-font" style={{ fontSize: "0.9375rem", fontWeight: 700, textTransform: "uppercase", color: "#fff" }}>{title}</div>
        {isWinner && <Trophy size={16} color={C.gold} fill={C.gold} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {team.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", color: "#fff" }}>{p.name}</span>
            <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.25)", padding: "0.1rem 0.4rem", borderRadius: "0.25rem" }}>{p.position}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RosterSection({ title, subtitle, open, players, dayAttendance, isAdmin, canMark, maxReached, requirePayment, isPaidFor, crownIds, onMark, isLast }) {
  return (
    <div style={{ padding: "0.75rem 1.25rem", borderBottom: !isLast ? `1px dashed ${C.tanBorder}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: C.ink }}>
          <ShieldCheck size={13} color={open ? C.green : "#B4A98A"} />
          {title}
        </div>
        <span style={{
          fontSize: "0.625rem", fontWeight: 500, padding: "0.125rem 0.5rem", borderRadius: "9999px",
          background: open ? C.greenLight : C.tan,
          color: open ? C.green : C.grayText,
        }}>
          {subtitle}
        </span>
      </div>
      {players.length === 0 && <div style={{ fontSize: "0.75rem", color: C.grayText, padding: "0.25rem 0" }}>Enginn skráður í þennan hóp</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {players.map((p) => {
          const val = dayAttendance[p.id];
          const paid = isPaidFor ? isPaidFor(p.id) : null;
          const unpaidBlock = requirePayment && paid === false;
          const editable = isAdmin || canMark;
          const yesBlocked = (!isAdmin && maxReached && val !== "yes") || (!isAdmin && unpaidBlock && val !== "yes");
          const hasCrown = crownIds && crownIds.includes(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9375rem", color: "#3D473F" }}>
                <Circle size={9} fill={paid === true ? C.green : paid === false ? C.rust : C.tanBorder} color={paid === true ? C.green : paid === false ? C.rust : C.tanBorder} />
                {hasCrown && <Crown size={14} color={C.gold} fill={C.gold} />}
                {p.name}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  disabled={!editable || yesBlocked}
                  onClick={() => onMark(p.id, val === "yes" ? null : "yes")}
                  style={{
                    padding: "0.625rem", minWidth: "2.5rem", minHeight: "2.5rem", display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "0.625rem", border: "none", opacity: (editable && !yesBlocked) ? 1 : 0.4,
                    background: val === "yes" ? C.green : C.tan,
                    color: val === "yes" ? "white" : C.grayText,
                  }}
                >
                  <Check size={20} />
                </button>
                <button
                  disabled={!editable}
                  onClick={() => onMark(p.id, val === "no" ? null : "no")}
                  style={{
                    padding: "0.625rem", minWidth: "2.5rem", minHeight: "2.5rem", display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "0.625rem", border: "none", opacity: editable ? 1 : 0.4,
                    background: val === "no" ? C.rust : C.tan,
                    color: val === "no" ? "white" : C.grayText,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
