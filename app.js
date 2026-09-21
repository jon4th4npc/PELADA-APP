(() => {
  const cfg = window.PELADA_CONFIG || {};
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("COLE_AQUI")) {
    alert("Configure SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js.");
    return;
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const ADMIN_EMAILS = {
    JONATHAN: "jonathan@pelada.local",
    JULIO: "julio@pelada.local",
    CAUE: "caue@pelada.local",
    EDSON: "edson@pelada.local"
  };

  const FIXTURES = [[0,1],[2,3],[0,4],[1,2],[3,4],[0,2],[1,3],[2,4],[0,3],[1,4]];

  // Catálogo local inicial. Se o time não estiver aqui, aparecem as iniciais.
  const LOGO_CATALOG = {
    bocajuniors: "logos/boca_juniors.png",
    riverplate: "logos/river_plate.png",
    platense: "logos/platense.png",
    estudiantes: "logos/estudiantes.png",
    rivadavia: "logos/rivadavia.png",
    independienterivadavia: "logos/rivadavia.png",
    barcelona: "logos/barcelona.png",
    realmadrid: "logos/real_madrid.png",
    valencia: "logos/valencia.png",
    atleticodemadrid: "logos/atletico_de_madrid.png",
    atleticomadrid: "logos/atletico_de_madrid.png",
    realbetis: "logos/real_betis.png"
  };

  // Catálogo online das principais ligas europeias. O site continua funcionando
  // mesmo se esse catálogo externo estiver indisponível; nesse caso usa os
  // escudos locais acima ou as iniciais do clube.
  const REMOTE_LOGOS = {};
  const REMOTE_LOGO_MANIFEST = "https://cdn.jsdelivr.net/gh/frertommy/team-logos@main/manifest.json";

  const S = {
    session: null,
    adminName: null,
    tournament: null,
    teams: [],
    players: [],
    matches: [],
    stats: [],
    preview: null,
    currentView: "matches",
    generalStatsLoaded: false
  };

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[s]));
  const isAdmin = () => !!S.session;

  function status(msg, kind = "") {
    const box = $("statusBox");
    box.textContent = msg;
    box.className = "notice " + kind;
    box.classList.remove("hidden");
    window.clearTimeout(status._timer);
    status._timer = window.setTimeout(() => box.classList.add("hidden"), 4300);
  }

  function fmtDate(v) {
    if (!v) return "";
    const [y,m,d] = v.split("-");
    return `${d}/${m}/${y}`;
  }

  function normalizeTeamName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizePlayerName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function playerDisplayName(name) {
    return String(name || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
  }

  function getLogoPath(teamOrName) {
    const name = typeof teamOrName === "string" ? teamOrName : teamOrName?.name;
    const key = normalizeTeamName(name);
    return LOGO_CATALOG[key] || REMOTE_LOGOS[key] || "";
  }

  async function loadRemoteLogoCatalog() {
    try {
      const response = await fetch(REMOTE_LOGO_MANIFEST, { cache:"force-cache" });
      if (!response.ok) return;
      const manifest = await response.json();
      const soccerTeams = (manifest.teams || []).filter(t => t.competition === "MSI2026" && t.source_logo);

      soccerTeams.forEach(t => {
        REMOTE_LOGOS[normalizeTeamName(t.team)] = t.source_logo;
        if (t.matched_as) REMOTE_LOGOS[normalizeTeamName(t.matched_as)] = t.source_logo;
      });

      const aliases = {
        psg:"parissaintgermain",
        parisstgermain:"parissaintgermain",
        manutd:"manchesterunited",
        manunited:"manchesterunited",
        manchesterutd:"manchesterunited",
        mancity:"manchestercity",
        spurs:"tottenhamhotspur",
        bayern:"bayernmunich",
        bayerndemunique:"bayernmunich",
        atletico:"atleticomadrid",
        atleticodemadrid:"atleticomadrid",
        milan:"acmilan",
        roma:"asroma",
        interdemilao:"internazionale",
        interdemilan:"internazionale",
        intermilao:"internazionale"
      };

      Object.entries(aliases).forEach(([alias,target]) => {
        if (REMOTE_LOGOS[target]) REMOTE_LOGOS[alias] = REMOTE_LOGOS[target];
      });

      // Se a tela já estiver montada, atualiza para trocar iniciais por escudos.
      if (S.tournament) renderTournament();
      if (S.preview) renderPreview();
    } catch (_) {
      // Falha silenciosa: o fallback local/iniciais continua funcionando.
    }
  }

  function teamInitials(teamOrName) {
    const name = typeof teamOrName === "string" ? teamOrName : teamOrName?.name || "";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function teamLogo(teamOrName, extraClass = "") {
    const name = typeof teamOrName === "string" ? teamOrName : teamOrName?.name || "";
    const src = getLogoPath(name);
    if (src) {
      return `<img class="team-logo ${extraClass}" src="${src}" alt="Escudo de ${esc(name)}">`;
    }
    return `<span class="team-logo fallback ${extraClass}" title="Escudo não cadastrado">${esc(teamInitials(name))}</span>`;
  }

  function teamSide(team, side = "") {
    return `<div class="team-side ${side}">${teamLogo(team)}<span class="team-name">${esc(team?.name || "")}</span></div>`;
  }

  function showView(name) {
    if (name === "create" && !isAdmin()) {
      $("loginCard").classList.remove("hidden");
      return;
    }

    S.currentView = name;
    document.querySelectorAll(".app-view").forEach(v => v.classList.add("hidden"));
    $("view" + name.charAt(0).toUpperCase() + name.slice(1))?.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });

    if (name === "history") loadHistory().catch(e => status(e.message || String(e), "error"));
    if (name === "stats") loadGeneralStats().catch(e => status(e.message || String(e), "error"));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function adminUI() {
    const admin = isAdmin();
    $("logoutBtn").classList.toggle("hidden", !admin);
    $("navCreate").classList.toggle("hidden", !admin);
    $("adminPanel").classList.toggle("hidden", !admin);
    $("modeBadge").innerHTML = admin
      ? `<span class="status-dot online"></span>Admin: ${esc(S.adminName || "")}`
      : `<span class="status-dot public"></span>Público • somente leitura`;
    $("adminBadge").textContent = S.adminName || "";

    if (!admin && S.currentView === "create") showView("matches");
  }

  function parseWeeklyList(text) {
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const out = [];
    let current = null;

    for (const line of lines) {
      const tm = line.match(/^(\d+)\s*[-–]\s*(.+)$/);
      if (tm) {
        current = { order:Number(tm[1]), name:tm[2].trim(), players:[] };
        out.push(current);
        continue;
      }

      const pm = line.match(/^(\d+)\s*[.)]\s*(.+)$/);
      if (pm && current) {
        current.players.push({ order:Number(pm[1]), name:playerDisplayName(pm[2]) });
        continue;
      }

      if (!/^\d/.test(line) && !current) {
        current = { order:out.length + 1, name:line, players:[] };
        out.push(current);
      }
    }

    out.sort((a,b) => a.order - b.order);
    out.forEach(t => t.players.sort((a,b) => a.order - b.order));
    return out;
  }

  function renderPreview() {
    $("previewTeams").innerHTML = S.preview.map(t => `
      <div class="team-card">
        <h3 class="team-card-title">${teamLogo(t.name)}<span>${esc(t.name)}</span></h3>
        <ol>${t.players.map(p => `<li>${esc(playerDisplayName(p.name))}</li>`).join("")}</ol>
      </div>
    `).join("");

    const warnings = [];
    if (S.preview.length !== 5) warnings.push(`Foram encontrados ${S.preview.length} times. O padrão é 5.`);
    S.preview.forEach(t => {
      if (t.players.length !== 5) warnings.push(`${t.name}: ${t.players.length} jogadores encontrados.`);
    });

    const w = $("previewWarnings");
    if (warnings.length) {
      w.innerHTML = warnings.map(x => `<div>• ${esc(x)}</div>`).join("");
      w.classList.remove("hidden");
    } else {
      w.classList.add("hidden");
    }
    $("importPreview").classList.remove("hidden");
  }

  async function login() {
    const user = $("loginUser").value;
    const password = $("loginPassword").value;
    if (!password) return status("Digite a senha.", "warn");

    const { data, error } = await sb.auth.signInWithPassword({
      email: ADMIN_EMAILS[user],
      password
    });

    if (error) return status("Usuário ou senha inválidos.", "error");

    S.session = data.session;
    S.adminName = user;
    $("loginPassword").value = "";
    $("loginCard").classList.add("hidden");
    adminUI();
    status(`Login realizado como ${user}.`);
    showView("create");
  }

  async function logout() {
    await sb.auth.signOut();
    S.session = null;
    S.adminName = null;
    adminUI();
    showView("matches");
  }

  async function loadAuth() {
    const { data } = await sb.auth.getSession();
    S.session = data.session;
    if (S.session) {
      const email = S.session.user.email || "";
      S.adminName = Object.entries(ADMIN_EMAILS).find(([,v]) => v === email)?.[0] || "ADMIN";
    }
    adminUI();
  }

  async function listTournaments() {
    const { data, error } = await sb
      .from("tournaments")
      .select("id,title,event_date,status,created_at")
      .order("event_date", { ascending:false });
    if (error) throw error;
    return data || [];
  }

  async function loadLatest() {
    const list = await listTournaments();
    if (!list.length) {
      $("tournamentPanel").classList.add("hidden");
      $("noTournament").classList.remove("hidden");
      return;
    }
    $("noTournament").classList.add("hidden");
    await loadTournament(list[0].id);
  }

  async function loadTournament(id) {
    const [tr,te,pl,ma,st] = await Promise.all([
      sb.from("tournaments").select("*").eq("id",id).single(),
      sb.from("teams").select("*").eq("tournament_id",id).order("sort_order"),
      sb.from("players").select("*").eq("tournament_id",id).order("sort_order"),
      sb.from("matches").select("*").eq("tournament_id",id).order("round_order"),
      sb.from("player_match_stats").select("*").eq("tournament_id",id)
    ]);

    for (const r of [tr,te,pl,ma,st]) if (r.error) throw r.error;

    S.tournament = tr.data;
    S.teams = te.data || [];
    S.players = pl.data || [];
    S.matches = ma.data || [];
    S.stats = st.data || [];

    $("noTournament").classList.add("hidden");
    renderTournament();
  }

  const teamById = id => S.teams.find(t => t.id === id);
  const playersByTeam = id => S.players.filter(p => p.team_id === id);
  const getStat = (matchId,playerId) => S.stats.find(s => s.match_id === matchId && s.player_id === playerId) || { goals:0, assists:0 };

  function standings() {
    const rows = S.teams.map(t => ({ team:t, j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0 }));
    const map = Object.fromEntries(rows.map(r => [r.team.id,r]));
    const completed = S.matches.filter(m => m.stage === "group" && m.home_score !== null && m.away_score !== null);

    for (const m of completed) {
      const H = map[m.home_team_id], A = map[m.away_team_id];
      if (!H || !A) continue;
      H.j++; A.j++;
      H.gp += m.home_score; H.gc += m.away_score;
      A.gp += m.away_score; A.gc += m.home_score;
      if (m.home_score > m.away_score) { H.v++; A.d++; H.pts += 3; }
      else if (m.away_score > m.home_score) { A.v++; H.d++; A.pts += 3; }
      else { H.e++; A.e++; H.pts++; A.pts++; }
    }

    rows.forEach(r => r.sg = r.gp - r.gc);

    function h2h(a,b) {
      const m = completed.find(x =>
        (x.home_team_id === a.team.id && x.away_team_id === b.team.id) ||
        (x.home_team_id === b.team.id && x.away_team_id === a.team.id)
      );
      if (!m || m.home_score === m.away_score) return 0;
      const winner = m.home_score > m.away_score ? m.home_team_id : m.away_team_id;
      return winner === a.team.id ? 1 : -1;
    }

    rows.sort((a,b) =>
      b.pts - a.pts ||
      b.sg - a.sg ||
      b.gp - a.gp ||
      (-h2h(a,b)) ||
      a.team.sort_order - b.team.sort_order
    );

    return rows;
  }

  function scoreControl(m, side) {
    const value = side === "home" ? m.home_score : m.away_score;
    if (isAdmin()) {
      return `<input class="score match-score" data-match="${m.id}" data-side="${side}" type="number" min="0" max="99" inputmode="numeric" value="${value ?? ""}" placeholder="-">`;
    }
    return `<div class="score-display">${value ?? "-"}</div>`;
  }

  function renderTournament() {
    $("tournamentPanel").classList.remove("hidden");
    $("tournamentTitle").textContent = S.tournament.title || "Pelada";
    $("tournamentDate").textContent = fmtDate(S.tournament.event_date);
    if ($("teamsWeekDate")) $("teamsWeekDate").textContent = `Segunda-feira • ${fmtDate(S.tournament.event_date)} • confira os times e jogadores da rodada.`;

    const groupMatches = S.matches.filter(m => m.stage === "group");
    const done = groupMatches.filter(m => m.home_score !== null && m.away_score !== null).length;
    $("matchProgress").textContent = `${done}/10`;

    $("matchesList").innerHTML = groupMatches.map(m => {
      const h = teamById(m.home_team_id), a = teamById(m.away_team_id);
      return `<div class="match ${m.home_score !== null && m.away_score !== null ? "completed" : ""}">
        <div class="match-head"><span>PARTIDA ${m.round_order}</span><span>8MIN30S</span></div>
        <div class="match-row">
          ${teamSide(h,"left")}
          ${scoreControl(m,"home")}
          <div class="x">×</div>
          ${scoreControl(m,"away")}
          ${teamSide(a,"right")}
        </div>
        ${isAdmin() ? `<div class="match-actions"><button class="stats-btn secondary" data-match="${m.id}">⚽ Gols e assistências</button><button class="save-match" data-match="${m.id}">Salvar placar</button></div>` : ""}
      </div>`;
    }).join("");

    const rows = standings();
    $("standingsBody").innerHTML = rows.map((r,i) => `<tr class="${i < 2 ? "qualify" : ""}">
      <td><span class="position-badge">${i + 1}</span></td>
      <td><div class="standings-team">${teamLogo(r.team,"small")}<span>${esc(r.team.name)}</span>${i < 2 ? '<span class="finalist-tag">FINAL</span>' : ""}</div></td>
      <td><b>${r.pts}</b></td>
      <td>${r.sg > 0 ? "+" : ""}${r.sg}</td>
      <td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp}</td><td>${r.gc}</td>
    </tr>`).join("");

    renderFinal(rows,done);
    renderWeeklyRankings();

    $("teamsList").innerHTML = S.teams.map(t => `
      <div class="team-card">
        <h3 class="team-card-title">${teamLogo(t)}<span>${esc(t.name)}</span></h3>
        <ol>${playersByTeam(t.id).map(p => `<li>${esc(playerDisplayName(p.name))}</li>`).join("")}</ol>
      </div>
    `).join("");

    bindMatchControls();
  }

  function renderFinal(rows,done) {
    const finalMatch = S.matches.find(m => m.stage === "final");
    const first = rows[0]?.team, second = rows[1]?.team;

    if (!finalMatch) {
      $("finalBox").innerHTML = `<div class="final-stage">
        <div class="final-grid">
          <div class="final-team"><div class="final-logo">${teamLogo(first,"large")}</div><strong>${esc(first?.name || "1º colocado")}</strong></div>
          <div class="final-versus"><span>FINAL</span><b>×</b></div>
          <div class="final-team"><div class="final-logo">${teamLogo(second,"large")}</div><strong>${esc(second?.name || "2º colocado")}</strong></div>
        </div>
        ${isAdmin() && done === 10 ? '<div class="actions center-actions"><button id="createFinalBtn">🏆 Criar final com 1º e 2º</button></div>' : ""}
      </div>`;
      $("createFinalBtn")?.addEventListener("click", () => createFinal(rows));
      return;
    }

    const h = teamById(finalMatch.home_team_id), a = teamById(finalMatch.away_team_id);
    const champion = finalMatch.home_score === null || finalMatch.away_score === null
      ? null
      : finalMatch.home_score === finalMatch.away_score
        ? "Final empatada — defina o desempate"
        : finalMatch.home_score > finalMatch.away_score ? h.name : a.name;

    const finalHomeScore = isAdmin()
      ? `<input id="finalHomeScore" class="score final-score" type="number" min="0" max="99" inputmode="numeric" value="${finalMatch.home_score ?? ""}" placeholder="-">`
      : `<div class="score-display final-score">${finalMatch.home_score ?? "-"}</div>`;
    const finalAwayScore = isAdmin()
      ? `<input id="finalAwayScore" class="score final-score" type="number" min="0" max="99" inputmode="numeric" value="${finalMatch.away_score ?? ""}" placeholder="-">`
      : `<div class="score-display final-score">${finalMatch.away_score ?? "-"}</div>`;

    $("finalBox").innerHTML = `<div class="final-stage">
      <div class="final-grid played-final">
        <div class="final-team"><div class="final-logo">${teamLogo(h,"large")}</div><strong>${esc(h?.name || "")}</strong>${finalHomeScore}</div>
        <div class="final-versus"><span>FINAL</span><b>×</b></div>
        <div class="final-team"><div class="final-logo">${teamLogo(a,"large")}</div><strong>${esc(a?.name || "")}</strong>${finalAwayScore}</div>
      </div>
      ${isAdmin() ? '<div class="actions center-actions"><button id="saveFinalBtn">Salvar final</button><button id="finalStatsBtn" class="secondary">⚽ Gols e assistências</button></div>' : ""}
      <div class="champion">${champion ? (champion.startsWith("Final empatada") ? `⚠️ ${esc(champion)}` : `${teamLogo(champion,"small")}<span>🏆 CAMPEÃO: ${esc(champion)}</span>`) : "🏆 Campeão: aguardando a final"}</div>
    </div>`;

    $("saveFinalBtn")?.addEventListener("click", () => saveFinal(finalMatch));
    $("finalStatsBtn")?.addEventListener("click", () => openStats(finalMatch.id));
  }

  function buildRank(rows,key,showTeam = true) {
    if (!rows.length) return `<div class="empty-mini">Nenhuma estatística registrada ainda.</div>`;
    return `<div class="rank">${rows.map((r,i) => `
      <div class="rank-row ${i === 0 ? "leader" : ""}">
        <span class="rank-pos">${i + 1}</span>
        <span class="rank-player"><b>${esc(playerDisplayName(r.player?.name || r.name))}</b>${showTeam && r.player ? `<small>${teamLogo(teamById(r.player.team_id),"tiny")}${esc(teamById(r.player.team_id)?.name || "")}</small>` : (r.weeks ? `<small>${r.weeks} ${r.weeks === 1 ? "pelada" : "peladas"}</small>` : "")}</span>
        <strong class="rank-value">${r[key]}</strong>
      </div>`).join("")}</div>`;
  }

  function renderWeeklyRankings() {
    const totals = new Map(S.players.map(p => [p.id,{ player:p, goals:0, assists:0 }]));
    for (const s of S.stats) {
      const r = totals.get(s.player_id);
      if (!r) continue;
      r.goals += s.goals || 0;
      r.assists += s.assists || 0;
    }

    const goals = [...totals.values()].sort((a,b) => b.goals - a.goals || b.assists - a.assists || a.player.name.localeCompare(b.player.name));
    const assists = [...totals.values()].sort((a,b) => b.assists - a.assists || b.goals - a.goals || a.player.name.localeCompare(b.player.name));

    $("goalsRanking").innerHTML = buildRank(goals,"goals",true);
    $("assistsRanking").innerHTML = buildRank(assists,"assists",true);
  }

  async function loadGeneralStats(force = false) {
    if (S.generalStatsLoaded && !force) return;

    const [statsRes,playersRes] = await Promise.all([
      sb.from("player_match_stats").select("player_id,tournament_id,goals,assists"),
      sb.from("players").select("id,tournament_id,name")
    ]);

    if (statsRes.error) throw statsRes.error;
    if (playersRes.error) throw playersRes.error;

    const players = new Map((playersRes.data || []).map(p => [p.id,p]));
    const grouped = new Map();

    for (const s of statsRes.data || []) {
      const p = players.get(s.player_id);
      if (!p) continue;
      const key = normalizePlayerName(p.name);
      if (!grouped.has(key)) grouped.set(key,{ name:playerDisplayName(p.name), goals:0, assists:0, tournaments:new Set() });
      const row = grouped.get(key);
      row.goals += s.goals || 0;
      row.assists += s.assists || 0;
      row.tournaments.add(s.tournament_id || p.tournament_id);
    }

    const all = [...grouped.values()].map(r => ({ ...r, weeks:r.tournaments.size }));
    const goals = [...all].sort((a,b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name));
    const assists = [...all].sort((a,b) => b.assists - a.assists || b.goals - a.goals || a.name.localeCompare(b.name));

    $("generalGoalsRanking").innerHTML = buildRank(goals,"goals",false);
    $("generalAssistsRanking").innerHTML = buildRank(assists,"assists",false);
    S.generalStatsLoaded = true;
  }

  function bindMatchControls() {
    document.querySelectorAll(".save-match").forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.dataset.match;
      const home = document.querySelector(`.match-score[data-match="${id}"][data-side="home"]`).value;
      const away = document.querySelector(`.match-score[data-match="${id}"][data-side="away"]`).value;
      if (home === "" || away === "") return status("Preencha os dois placares.","warn");

      const { error } = await sb.from("matches").update({
        home_score:Number(home),
        away_score:Number(away),
        updated_by:S.adminName
      }).eq("id",id);

      if (error) return status(error.message,"error");
      S.generalStatsLoaded = false;
      await loadTournament(S.tournament.id);
      status("Placar salvo.");
    }));

    document.querySelectorAll(".stats-btn").forEach(btn => btn.addEventListener("click", () => openStats(btn.dataset.match)));
  }

  async function saveFinal(finalMatch) {
    const home = $("finalHomeScore").value;
    const away = $("finalAwayScore").value;
    if (home === "" || away === "") return status("Preencha o placar da final.","warn");

    const { error } = await sb.from("matches").update({
      home_score:Number(home),
      away_score:Number(away),
      updated_by:S.adminName
    }).eq("id",finalMatch.id);

    if (error) return status(error.message,"error");
    S.generalStatsLoaded = false;
    await loadTournament(S.tournament.id);
  }

  async function createFinal(rows) {
    const { error } = await sb.from("matches").insert({
      tournament_id:S.tournament.id,
      stage:"final",
      round_order:99,
      home_team_id:rows[0].team.id,
      away_team_id:rows[1].team.id,
      minutes:10,
      seconds:0,
      updated_by:S.adminName
    });

    if (error) return status(error.message,"error");
    await loadTournament(S.tournament.id);
  }

  function openStats(matchId) {
    const m = S.matches.find(x => x.id === matchId);
    if (!m) return;

    const h = teamById(m.home_team_id), a = teamById(m.away_team_id);
    $("statsDialog").dataset.match = matchId;
    $("statsSubtitle").textContent = `${h?.name || ""} ${m.home_score ?? "-"} × ${m.away_score ?? "-"} ${a?.name || ""}`;

    const ps = [...playersByTeam(m.home_team_id),...playersByTeam(m.away_team_id)];
    $("statsEditor").innerHTML = ps.map(p => {
      const s = getStat(matchId,p.id);
      const team = teamById(p.team_id);
      return `<div class="player-stat-row">
        <strong class="player-stat-name">${esc(playerDisplayName(p.name))}<small>${teamLogo(team,"tiny")}${esc(team?.name || "")}</small></strong>
        <label>Gols<input class="stat-goals" data-player="${p.id}" type="number" min="0" max="20" value="${s.goals || 0}"></label>
        <label>Assistências<input class="stat-assists" data-player="${p.id}" type="number" min="0" max="20" value="${s.assists || 0}"></label>
      </div>`;
    }).join("");

    $("statsValidation").classList.add("hidden");
    $("statsDialog").showModal();
  }

  async function saveStats() {
    const matchId = $("statsDialog").dataset.match;
    const m = S.matches.find(x => x.id === matchId);
    if (!m) return;

    const rows = [...document.querySelectorAll("#statsEditor .player-stat-row")].map(row => {
      const g = row.querySelector(".stat-goals");
      const a = row.querySelector(".stat-assists");
      return {
        tournament_id:S.tournament.id,
        match_id:matchId,
        player_id:g.dataset.player,
        goals:Number(g.value || 0),
        assists:Number(a.value || 0),
        updated_by:S.adminName
      };
    });

    const homeIds = new Set(playersByTeam(m.home_team_id).map(p => p.id));
    const awayIds = new Set(playersByTeam(m.away_team_id).map(p => p.id));
    const homeGoals = rows.filter(r => homeIds.has(r.player_id)).reduce((s,r) => s + r.goals,0);
    const awayGoals = rows.filter(r => awayIds.has(r.player_id)).reduce((s,r) => s + r.goals,0);

    const warnings = [];
    if (m.home_score !== null && homeGoals !== m.home_score) warnings.push(`Gols dos jogadores do mandante: ${homeGoals}. Placar: ${m.home_score}.`);
    if (m.away_score !== null && awayGoals !== m.away_score) warnings.push(`Gols dos jogadores do visitante: ${awayGoals}. Placar: ${m.away_score}.`);

    if (warnings.length) {
      const w = $("statsValidation");
      w.innerHTML = warnings.map(x => `<div>• ${esc(x)}</div>`).join("") + `<div style="margin-top:6px">O sistema salvará mesmo assim.</div>`;
      w.classList.remove("hidden");
    }

    const { error } = await sb.from("player_match_stats").upsert(rows,{ onConflict:"match_id,player_id" });
    if (error) return status(error.message,"error");

    $("statsDialog").close();
    S.generalStatsLoaded = false;
    await loadTournament(S.tournament.id);
    status("Gols e assistências salvos.");
  }

  async function createTournament() {
    if (!isAdmin() || !S.preview?.length) return;

    const date = $("newDate").value;
    const title = $("newTitle").value.trim() || "Pelada";
    if (!date) return status("Informe a data da pelada.","warn");

    const { data:tournament,error:tErr } = await sb.from("tournaments").insert({
      title,
      event_date:date,
      status:"active",
      created_by:S.adminName
    }).select().single();
    if (tErr) return status(tErr.message,"error");

    const { data:createdTeams,error:teamsErr } = await sb.from("teams").insert(
      S.preview.map((x,i) => ({ tournament_id:tournament.id,name:x.name,sort_order:i + 1 }))
    ).select();
    if (teamsErr) return status(teamsErr.message,"error");

    createdTeams.sort((a,b) => a.sort_order - b.sort_order);

    const playerRows = [];
    S.preview.forEach((t,i) => t.players.forEach((p,j) => playerRows.push({
      tournament_id:tournament.id,
      team_id:createdTeams[i].id,
      name:playerDisplayName(p.name),
      sort_order:j + 1
    })));

    const { error:playersErr } = await sb.from("players").insert(playerRows);
    if (playersErr) return status(playersErr.message,"error");

    const matchRows = FIXTURES.map((pair,i) => ({
      tournament_id:tournament.id,
      stage:"group",
      round_order:i + 1,
      home_team_id:createdTeams[pair[0]].id,
      away_team_id:createdTeams[pair[1]].id,
      minutes:8,
      seconds:30,
      updated_by:S.adminName
    }));

    const { error:matchErr } = await sb.from("matches").insert(matchRows);
    if (matchErr) return status(matchErr.message,"error");

    S.preview = null;
    S.generalStatsLoaded = false;
    $("importPreview").classList.add("hidden");
    $("pasteList").value = "";

    await loadTournament(tournament.id);
    status("Pelada criada com sucesso.");
    showView("matches");
  }

  async function loadHistory() {
    const list = await listTournaments();
    if (!list.length) {
      $("historyList").innerHTML = `<div class="empty-mini">Ainda não há peladas no histórico.</div>`;
      return;
    }

    $("historyList").innerHTML = list.map((t,i) => `
      <div class="history-item ${i === 0 ? "current-history" : ""}">
        <div class="history-icon">⚽</div>
        <div class="history-info"><strong>${esc(t.title)}</strong><span>${fmtDate(t.event_date)}${i === 0 ? " • Rodada atual" : ""}</span></div>
        <button data-id="${t.id}" class="open-history secondary">Abrir</button>
      </div>
    `).join("");

    document.querySelectorAll(".open-history").forEach(btn => btn.addEventListener("click",async () => {
      await loadTournament(btn.dataset.id);
      showView("matches");
    }));
  }

  // Navegação principal
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  // Login/admin
  $("adminBtn").addEventListener("click", () => {
    if (isAdmin()) showView("create");
    else $("loginCard").classList.remove("hidden");
  });
  $("loginCancel").addEventListener("click", () => $("loginCard").classList.add("hidden"));
  $("loginSubmit").addEventListener("click", login);
  $("logoutBtn").addEventListener("click", logout);

  // Criação
  $("previewImport").addEventListener("click", () => {
    S.preview = parseWeeklyList($("pasteList").value);
    if (!S.preview.length) return status("Não consegui identificar a lista.","warn");
    renderPreview();
  });
  $("cancelPreview").addEventListener("click", () => $("importPreview").classList.add("hidden"));
  $("createTournament").addEventListener("click", createTournament);

  // Estatísticas semana/geral
  document.querySelectorAll(".stats-tab").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".stats-tab").forEach(x => x.classList.toggle("active",x === btn));
    const general = btn.dataset.statsView === "general";
    $("weeklyStatsPanel").classList.toggle("hidden",general);
    $("generalStatsPanel").classList.toggle("hidden",!general);
    if (general) loadGeneralStats().catch(e => status(e.message || String(e),"error"));
  }));

  $("saveStatsBtn").addEventListener("click",saveStats);

  function toISODateLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }

  function nextOrCurrentMonday(base = new Date()) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const day = d.getDay();
    const add = day === 1 ? 0 : (8 - day) % 7;
    d.setDate(d.getDate() + add);
    return d;
  }

  function setupMondaySchedule() {
    const select = $("mondayPreset");
    const input = $("newDate");
    if (!select || !input) return;

    const today = new Date();
    const first = nextOrCurrentMonday(today);
    const todayIso = toISODateLocal(today);
    const options = [];

    for (let i = 0; i < 16; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + i * 7);
      const iso = toISODateLocal(d);
      const label = fmtDate(iso) + (iso === todayIso ? " • HOJE" : i === 0 ? " • PRÓXIMA" : "");
      options.push(`<option value="${iso}">${label}</option>`);
    }

    select.innerHTML = options.join("");
    input.value = select.value;

    select.addEventListener("change", () => {
      input.value = select.value;
    });

    input.addEventListener("change", () => {
      const date = new Date(`${input.value}T12:00:00`);
      if (!input.value || Number.isNaN(date.getTime())) return;
      if (date.getDay() !== 1) {
        status("A pelada normalmente acontece na segunda-feira. Mantive a data porque você pode ter uma exceção.", "warn");
      }
      const exists = [...select.options].some(o => o.value === input.value);
      if (exists) select.value = input.value;
      else select.selectedIndex = -1;
    });
  }

  setupMondaySchedule();

  sb.auth.onAuthStateChange((_event,session) => {
    S.session = session;
    if (!session) S.adminName = null;
    adminUI();
  });

  (async () => {
    try {
      // Carrega o catálogo online sem travar a abertura do sistema.
      loadRemoteLogoCatalog();
      await loadAuth();
      showView("matches");
      await loadLatest();
    } catch (e) {
      status(e.message || String(e),"error");
    }
  })();
})();
