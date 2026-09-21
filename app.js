(() => {
  const cfg = window.PELADA_CONFIG || {};
  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("COLE_AQUI")) {
    alert("Configure SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js.");
    return;
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const ADMIN_EMAILS = {
    JONATHAN:"jonathan@pelada.local",
    JULIO:"julio@pelada.local",
    CAUE:"caue@pelada.local",
    EDSON:"edson@pelada.local"
  };
  const fixturesTemplate = [[0,1],[2,3],[0,4],[1,2],[3,4],[0,2],[1,3],[2,4],[0,3],[1,4]];

  const S = {session:null,adminName:null,tournament:null,teams:[],players:[],matches:[],stats:[],preview:null};
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));
  const isAdmin = () => !!S.session;

  function status(msg, kind="") {
    const b=$("statusBox"); b.textContent=msg; b.className="notice "+kind; b.classList.remove("hidden");
    setTimeout(()=>b.classList.add("hidden"),4200);
  }
  function fmtDate(v){ if(!v)return""; const [y,m,d]=v.split("-"); return `${d}/${m}/${y}`; }
  function adminUI(){
    $("logoutBtn").classList.toggle("hidden",!isAdmin());
    $("adminPanel").classList.toggle("hidden",!isAdmin());
    $("modeBadge").textContent=isAdmin()?`Admin: ${S.adminName||""}`:"Público";
    $("adminBadge").textContent=S.adminName||"";
  }

  function parseWeeklyList(text){
    const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const out=[]; let current=null;
    for(const line of lines){
      const tm=line.match(/^(\d+)\s*-\s+(.+)$/);
      if(tm){ current={order:Number(tm[1]),name:tm[2].trim(),players:[]}; out.push(current); continue; }
      const pm=line.match(/^(\d+)\s*[.)]\s*(.+)$/);
      if(pm && current){ current.players.push({order:Number(pm[1]),name:pm[2].trim()}); continue; }
      if(!/^\d/.test(line) && !current){ current={order:out.length+1,name:line,players:[]}; out.push(current); }
    }
    out.sort((a,b)=>a.order-b.order);
    out.forEach(t=>t.players.sort((a,b)=>a.order-b.order));
    return out;
  }

  function renderPreview(){
    $("previewTeams").innerHTML=S.preview.map(t=>`<div class="team-card"><h3>${esc(t.name)}</h3><ol>${t.players.map(p=>`<li>${esc(p.name)}</li>`).join("")}</ol></div>`).join("");
    const warnings=[];
    if(S.preview.length!==5) warnings.push(`Foram encontrados ${S.preview.length} times; o padrão é 5.`);
    S.preview.forEach(t=>{ if(t.players.length!==5) warnings.push(`${t.name}: ${t.players.length} jogadores.`); });
    const w=$("previewWarnings");
    if(warnings.length){w.innerHTML=warnings.map(x=>`<div>• ${esc(x)}</div>`).join("");w.classList.remove("hidden");}
    else w.classList.add("hidden");
    $("importPreview").classList.remove("hidden");
  }

  async function login(){
    const user=$("loginUser").value, password=$("loginPassword").value;
    if(!password)return status("Digite a senha.","warn");
    const {data,error}=await sb.auth.signInWithPassword({email:ADMIN_EMAILS[user],password});
    if(error)return status("Usuário ou senha inválidos.","error");
    S.session=data.session; S.adminName=user; $("loginPassword").value=""; $("loginCard").classList.add("hidden"); adminUI();
    status(`Login realizado como ${user}.`);
  }
  async function logout(){ await sb.auth.signOut(); S.session=null;S.adminName=null;adminUI(); }

  async function loadAuth(){
    const {data}=await sb.auth.getSession(); S.session=data.session;
    if(S.session){const e=S.session.user.email||"";S.adminName=Object.entries(ADMIN_EMAILS).find(([,v])=>v===e)?.[0]||"ADMIN";}
    adminUI();
  }

  async function listTournaments(){
    const {data,error}=await sb.from("tournaments").select("id,title,event_date,status,created_at").order("event_date",{ascending:false});
    if(error)throw error; return data||[];
  }
  async function loadLatest(){ const list=await listTournaments(); if(!list.length){$("tournamentPanel").classList.add("hidden");return;} await loadTournament(list[0].id); }

  async function loadTournament(id){
    const [tr,te,pl,ma,st]=await Promise.all([
      sb.from("tournaments").select("*").eq("id",id).single(),
      sb.from("teams").select("*").eq("tournament_id",id).order("sort_order"),
      sb.from("players").select("*").eq("tournament_id",id).order("sort_order"),
      sb.from("matches").select("*").eq("tournament_id",id).order("round_order"),
      sb.from("player_match_stats").select("*").eq("tournament_id",id)
    ]);
    for(const r of [tr,te,pl,ma,st]) if(r.error)throw r.error;
    S.tournament=tr.data;S.teams=te.data||[];S.players=pl.data||[];S.matches=ma.data||[];S.stats=st.data||[];
    renderTournament();
  }

  const teamById=id=>S.teams.find(t=>t.id===id);
  const playersByTeam=id=>S.players.filter(p=>p.team_id===id);
  const getStat=(m,p)=>S.stats.find(s=>s.match_id===m&&s.player_id===p)||{goals:0,assists:0};

  function standings(){
    const rows=S.teams.map(t=>({team:t,j:0,v:0,e:0,d:0,gp:0,gc:0,sg:0,pts:0}));
    const map=Object.fromEntries(rows.map(r=>[r.team.id,r]));
    const done=S.matches.filter(m=>m.stage==="group"&&m.home_score!==null&&m.away_score!==null);
    for(const m of done){
      const H=map[m.home_team_id],A=map[m.away_team_id]; if(!H||!A)continue;
      H.j++;A.j++;H.gp+=m.home_score;H.gc+=m.away_score;A.gp+=m.away_score;A.gc+=m.home_score;
      if(m.home_score>m.away_score){H.v++;A.d++;H.pts+=3}
      else if(m.away_score>m.home_score){A.v++;H.d++;A.pts+=3}
      else{H.e++;A.e++;H.pts++;A.pts++}
    }
    rows.forEach(r=>r.sg=r.gp-r.gc);
    function h2h(a,b){
      const m=done.find(x=>(x.home_team_id===a.team.id&&x.away_team_id===b.team.id)||(x.home_team_id===b.team.id&&x.away_team_id===a.team.id));
      if(!m||m.home_score===m.away_score)return 0;
      const w=m.home_score>m.away_score?m.home_team_id:m.away_team_id; return w===a.team.id?1:-1;
    }
    rows.sort((a,b)=>b.pts-a.pts||b.sg-a.sg||b.gp-a.gp||(-h2h(a,b))||(a.team.sort_order-b.team.sort_order));
    return rows;
  }

  function renderTournament(){
    $("tournamentPanel").classList.remove("hidden");
    $("tournamentTitle").textContent=S.tournament.title||"Pelada";$("tournamentDate").textContent=fmtDate(S.tournament.event_date);
    const gm=S.matches.filter(m=>m.stage==="group"), done=gm.filter(m=>m.home_score!==null&&m.away_score!==null).length;
    $("matchProgress").textContent=`${done}/10`;
    $("matchesList").innerHTML=gm.map(m=>{
      const h=teamById(m.home_team_id),a=teamById(m.away_team_id),dis=isAdmin()?"":"disabled";
      return `<div class="match">
        <div class="match-head">PARTIDA ${m.round_order} • 8MIN30S</div>
        <div class="match-row">
          <div class="team-name left">${esc(h?.name||"")}</div>
          <input class="score match-score" data-match="${m.id}" data-side="home" type="number" min="0" max="99" value="${m.home_score??""}" ${dis}>
          <div class="x">×</div>
          <input class="score match-score" data-match="${m.id}" data-side="away" type="number" min="0" max="99" value="${m.away_score??""}" ${dis}>
          <div class="team-name">${esc(a?.name||"")}</div>
        </div>
        ${isAdmin()?`<div class="match-actions"><button class="stats-btn secondary" data-match="${m.id}">Gols e assistências</button><button class="save-match" data-match="${m.id}">Salvar placar</button></div>`:""}
      </div>`;
    }).join("");

    const rows=standings();
    $("standingsBody").innerHTML=rows.map((r,i)=>`<tr class="${i<2?"qualify":""}">
      <td>${i+1}${i<2?" ★":""}</td><td>${esc(r.team.name)}</td><td><b>${r.pts}</b></td><td>${r.sg>0?"+":""}${r.sg}</td>
      <td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp}</td><td>${r.gc}</td></tr>`).join("");
    renderFinal(rows,done);renderRankings();
    $("teamsList").innerHTML=S.teams.map(t=>`<div class="team-card"><h3>${esc(t.name)}</h3><ol>${playersByTeam(t.id).map(p=>`<li>${esc(p.name)}</li>`).join("")}</ol></div>`).join("");
    bindMatchControls();
  }

  function renderFinal(rows,done){
    const fm=S.matches.find(m=>m.stage==="final"), first=rows[0]?.team,second=rows[1]?.team;
    if(!fm){
      $("finalBox").innerHTML=`<div class="final-grid">
        <div class="final-team"><strong>${esc(first?.name||"1º colocado")}</strong></div><div class="x">×</div>
        <div class="final-team"><strong>${esc(second?.name||"2º colocado")}</strong></div></div>
        ${isAdmin()&&done===10?'<div class="actions"><button id="createFinalBtn">Criar final com 1º e 2º</button></div>':""}`;
      $("createFinalBtn")?.addEventListener("click",()=>createFinal(rows)); return;
    }
    const h=teamById(fm.home_team_id),a=teamById(fm.away_team_id);
    const champ=fm.home_score===null||fm.away_score===null?null:(fm.home_score===fm.away_score?"Final empatada — defina o desempate":(fm.home_score>fm.away_score?h.name:a.name));
    $("finalBox").innerHTML=`<div class="final-grid">
      <div class="final-team"><strong>${esc(h?.name||"")}</strong><input id="finalHomeScore" class="score" type="number" min="0" max="99" value="${fm.home_score??""}" ${isAdmin()?"":"disabled"}></div>
      <div class="x">×</div>
      <div class="final-team"><strong>${esc(a?.name||"")}</strong><input id="finalAwayScore" class="score" type="number" min="0" max="99" value="${fm.away_score??""}" ${isAdmin()?"":"disabled"}></div>
      </div>
      ${isAdmin()?'<div class="actions"><button id="saveFinalBtn">Salvar final</button><button id="finalStatsBtn" class="secondary">Gols e assistências</button></div>':""}
      <div class="champion">${champ?`🏆 ${esc(champ)}`:"🏆 Campeão: aguardando a final"}</div>`;
    $("saveFinalBtn")?.addEventListener("click",()=>saveFinal(fm));$("finalStatsBtn")?.addEventListener("click",()=>openStats(fm.id));
  }

  function renderRankings(){
    const totals=new Map(S.players.map(p=>[p.id,{player:p,goals:0,assists:0}]));
    for(const s of S.stats){const r=totals.get(s.player_id);if(r){r.goals+=s.goals||0;r.assists+=s.assists||0}}
    const g=[...totals.values()].sort((a,b)=>b.goals-a.goals||b.assists-a.assists||a.player.name.localeCompare(b.player.name));
    const a=[...totals.values()].sort((x,y)=>y.assists-x.assists||y.goals-x.goals||x.player.name.localeCompare(y.player.name));
    const html=(rows,key)=>`<div class="rank">${rows.map((r,i)=>`<div class="rank-row"><span>${i+1}</span><span>${esc(r.player.name)} <small class="muted">${esc(teamById(r.player.team_id)?.name||"")}</small></span><strong>${r[key]}</strong></div>`).join("")}</div>`;
    $("goalsRanking").innerHTML=html(g,"goals");$("assistsRanking").innerHTML=html(a,"assists");
  }

  function bindMatchControls(){
    document.querySelectorAll(".save-match").forEach(b=>b.addEventListener("click",async()=>{
      const id=b.dataset.match,h=document.querySelector(`.match-score[data-match="${id}"][data-side="home"]`).value,a=document.querySelector(`.match-score[data-match="${id}"][data-side="away"]`).value;
      if(h===""||a==="")return status("Preencha os dois placares.","warn");
      const {error}=await sb.from("matches").update({home_score:Number(h),away_score:Number(a),updated_by:S.adminName}).eq("id",id);
      if(error)return status(error.message,"error");await loadTournament(S.tournament.id);status("Placar salvo.");
    }));
    document.querySelectorAll(".stats-btn").forEach(b=>b.addEventListener("click",()=>openStats(b.dataset.match)));
  }

  async function saveFinal(fm){
    const h=$("finalHomeScore").value,a=$("finalAwayScore").value;if(h===""||a==="")return status("Preencha o placar da final.","warn");
    const {error}=await sb.from("matches").update({home_score:Number(h),away_score:Number(a),updated_by:S.adminName}).eq("id",fm.id);
    if(error)return status(error.message,"error");await loadTournament(S.tournament.id);
  }
  async function createFinal(rows){
    const {error}=await sb.from("matches").insert({tournament_id:S.tournament.id,stage:"final",round_order:99,home_team_id:rows[0].team.id,away_team_id:rows[1].team.id,minutes:10,seconds:0,updated_by:S.adminName});
    if(error)return status(error.message,"error");await loadTournament(S.tournament.id);
  }

  function openStats(matchId){
    const m=S.matches.find(x=>x.id===matchId);if(!m)return;
    const h=teamById(m.home_team_id),a=teamById(m.away_team_id);$("statsDialog").dataset.match=matchId;
    $("statsSubtitle").textContent=`${h?.name||""} ${m.home_score??"-"} × ${m.away_score??"-"} ${a?.name||""}`;
    const ps=[...playersByTeam(m.home_team_id),...playersByTeam(m.away_team_id)];
    $("statsEditor").innerHTML=ps.map(p=>{const s=getStat(matchId,p.id);return `<div class="player-stat-row">
      <strong>${esc(p.name)} <small class="muted">${esc(teamById(p.team_id)?.name||"")}</small></strong>
      <label>Gols<input class="stat-goals" data-player="${p.id}" type="number" min="0" max="20" value="${s.goals||0}"></label>
      <label>Assistências<input class="stat-assists" data-player="${p.id}" type="number" min="0" max="20" value="${s.assists||0}"></label>
      </div>`}).join("");
    $("statsValidation").classList.add("hidden");$("statsDialog").showModal();
  }

  async function saveStats(){
    const matchId=$("statsDialog").dataset.match,m=S.matches.find(x=>x.id===matchId);if(!m)return;
    const rows=[...document.querySelectorAll("#statsEditor .player-stat-row")].map(row=>{
      const g=row.querySelector(".stat-goals"),a=row.querySelector(".stat-assists");
      return {tournament_id:S.tournament.id,match_id:matchId,player_id:g.dataset.player,goals:Number(g.value||0),assists:Number(a.value||0),updated_by:S.adminName};
    });
    const homeIds=new Set(playersByTeam(m.home_team_id).map(p=>p.id)),awayIds=new Set(playersByTeam(m.away_team_id).map(p=>p.id));
    const hg=rows.filter(r=>homeIds.has(r.player_id)).reduce((s,r)=>s+r.goals,0),ag=rows.filter(r=>awayIds.has(r.player_id)).reduce((s,r)=>s+r.goals,0);
    const warnings=[];if(m.home_score!==null&&hg!==m.home_score)warnings.push(`Gols dos jogadores do mandante: ${hg}. Placar: ${m.home_score}.`);
    if(m.away_score!==null&&ag!==m.away_score)warnings.push(`Gols dos jogadores do visitante: ${ag}. Placar: ${m.away_score}.`);
    if(warnings.length){const w=$("statsValidation");w.innerHTML=warnings.map(x=>`<div>• ${esc(x)}</div>`).join("")+"<div style='margin-top:6px'>Será salvo mesmo assim.</div>";w.classList.remove("hidden");}
    const {error}=await sb.from("player_match_stats").upsert(rows,{onConflict:"match_id,player_id"});
    if(error)return status(error.message,"error");$("statsDialog").close();await loadTournament(S.tournament.id);status("Gols e assistências salvos.");
  }

  async function createTournament(){
    if(!isAdmin()||!S.preview?.length)return;
    const date=$("newDate").value,title=$("newTitle").value.trim()||"Pelada";if(!date)return status("Informe a data.","warn");
    const {data:t,error:e1}=await sb.from("tournaments").insert({title,event_date:date,status:"active",created_by:S.adminName}).select().single();
    if(e1)return status(e1.message,"error");
    const {data:cts,error:e2}=await sb.from("teams").insert(S.preview.map((x,i)=>({tournament_id:t.id,name:x.name,sort_order:i+1}))).select();
    if(e2)return status(e2.message,"error");cts.sort((a,b)=>a.sort_order-b.sort_order);
    const prs=[];S.preview.forEach((x,i)=>x.players.forEach((p,j)=>prs.push({tournament_id:t.id,team_id:cts[i].id,name:p.name,sort_order:j+1})));
    const {error:e3}=await sb.from("players").insert(prs);if(e3)return status(e3.message,"error");
    const mrs=fixturesTemplate.map((x,i)=>({tournament_id:t.id,stage:"group",round_order:i+1,home_team_id:cts[x[0]].id,away_team_id:cts[x[1]].id,minutes:8,seconds:30,updated_by:S.adminName}));
    const {error:e4}=await sb.from("matches").insert(mrs);if(e4)return status(e4.message,"error");
    S.preview=null;$("importPreview").classList.add("hidden");$("pasteList").value="";await loadTournament(t.id);status("Pelada criada com sucesso.");
  }

  async function history(){
    const list=await listTournaments();$("historyList").innerHTML=list.map(t=>`<div class="history-item"><div><strong>${esc(t.title)}</strong><div class="muted">${fmtDate(t.event_date)}</div></div><button data-id="${t.id}" class="open-history">Abrir</button></div>`).join("");
    document.querySelectorAll(".open-history").forEach(b=>b.addEventListener("click",async()=>{await loadTournament(b.dataset.id);$("historyPanel").classList.add("hidden")}));
  }

  $("adminBtn").addEventListener("click",()=>isAdmin()?$("adminPanel").classList.toggle("hidden"):$("loginCard").classList.remove("hidden"));
  $("loginCancel").addEventListener("click",()=>$("loginCard").classList.add("hidden"));
  $("loginSubmit").addEventListener("click",login);$("logoutBtn").addEventListener("click",logout);
  $("previewImport").addEventListener("click",()=>{S.preview=parseWeeklyList($("pasteList").value);if(!S.preview.length)return status("Não consegui identificar a lista.","warn");renderPreview()});
  $("cancelPreview").addEventListener("click",()=>$("importPreview").classList.add("hidden"));
  $("createTournament").addEventListener("click",createTournament);$("saveStatsBtn").addEventListener("click",saveStats);
  $("historyBtn").addEventListener("click",async()=>{await history();$("historyPanel").classList.remove("hidden")});
  $("closeHistory").addEventListener("click",()=>$("historyPanel").classList.add("hidden"));

  const d=new Date();$("newDate").value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  sb.auth.onAuthStateChange((_e,session)=>{S.session=session;if(!session)S.adminName=null;adminUI()});
  (async()=>{try{await loadAuth();await loadLatest()}catch(e){status(e.message||String(e),"error")}})();
})();