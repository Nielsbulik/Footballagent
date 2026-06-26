import { useState } from "react";

// Les 48 équipes qualifiées pour la Coupe du Monde 2026 (USA/Canada/Mexique)
const SUGGESTIONS = [
  // Hôtes
  "États-Unis", "Canada", "Mexique",
  // CONMEBOL
  "Argentine", "Brésil", "Uruguay", "Colombie", "Équateur", "Paraguay",
  // UEFA
  "France", "Angleterre", "Espagne", "Allemagne", "Portugal", "Pays-Bas",
  "Belgique", "Italie", "Croatie", "Suisse", "Norvège", "Autriche",
  "Écosse", "Danemark", "Pologne", "Turquie",
  // CAF
  "Maroc", "Sénégal", "Tunisie", "Égypte", "Algérie", "Nigeria",
  "Côte d'Ivoire", "Ghana", "Cap-Vert", "Afrique du Sud", "RD Congo",
  // AFC
  "Japon", "Corée du Sud", "Iran", "Australie", "Arabie Saoudite",
  "Qatar", "Ouzbékistan", "Jordanie", "Irak",
  // CONCACAF
  "Panama", "Curaçao", "Haïti"
];

// NB : le prompt système et la recherche web vivent maintenant côté backend
// (api/analyze-match.js). Le frontend ne fait qu'envoyer les équipes.

export default function FootballAgent() {
  const [teamA, setTeamA] = useState("Colombie");
  const [teamB, setTeamB] = useState("RD Congo");
  const [venue, setVenue] = useState("neutral");
  const [competition, setCompetition] = useState("Coupe du Monde");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [probA, setProbA] = useState(null);
  const [probB, setProbB] = useState(null);
  const [probN, setProbN] = useState(null);
  const [scorers, setScorers] = useState([]);

  const extractProbs = (text) => {
    // On ignore le bloc buteurs pour ne pas confondre les pourcentages
    const matchPart = text.split("[BUTEURS]")[0];
    const matches = [...matchPart.matchAll(/(\d{1,3})\s*%/g)];
    const nums = matches.map(m => parseInt(m[1])).filter(n => n > 5 && n < 90);
    if (nums.length >= 3) {
      setProbA(nums[0]);
      setProbN(nums[1]);
      setProbB(nums[2]);
    }
  };

  const extractScorers = (text) => {
    const match = text.match(/\[BUTEURS\]([\s\S]*?)\[\/BUTEURS\]/);
    if (!match) return [];
    return match[1].split("\n")
      .map(l => l.trim())
      .filter(l => l.includes("|"))
      .map(l => {
        const parts = l.split("|").map(p => p.trim());
        const pct = parseInt((parts[2] || "").replace(/[^\d]/g, "")) || 0;
        return { name: parts[0], team: parts[1] || "", pct };
      })
      .filter(s => s.name)
      .sort((a, b) => b.pct - a.pct);
  };

  const runAgent = async () => {
    const a = teamA.trim(), b = teamB.trim();
    if (!a || !b) {
      setError("Veuillez entrer le nom des deux équipes.");
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError("Veuillez choisir deux équipes différentes.");
      return;
    }
    setLoading(true);
    setAnalysis(null);
    setError(null);
    setProbA(null); setProbB(null); setProbN(null);
    setScorers([]);

    try {
      // On appelle NOTRE backend, qui détient la clé API en sécurité.
      // "/api/analyze-match" fonctionne dès que le projet est déployé sur Vercel.
      const response = await fetch("/api/analyze-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA: a, teamB: b, venue, competition })
      });

      const raw = await response.text();

      if (!response.ok) {
        let msg = `HTTP ${response.status}`;
        try { msg = JSON.parse(raw).error || msg; } catch {}
        throw new Error(msg);
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Réponse non-JSON : ${raw.slice(0, 120)}`);
      }

      const fullText = data.analysis || "";

      if (!fullText.trim()) {
        throw new Error("Réponse vide reçue");
      }

      const cleanText = fullText.replace(/\[BUTEURS\][\s\S]*?\[\/BUTEURS\]/g, "").trim();
      setAnalysis(cleanText);
      extractProbs(fullText);
      setScorers(extractScorers(fullText));
    } catch (e) {
      setError("Erreur : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAnalysis = (text) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <div key={i} style={{color:"#00e676", fontWeight:700, fontSize:"0.95rem", marginTop:"1rem", marginBottom:"0.3rem", letterSpacing:"0.05em"}}>{line.replace(/\*\*/g,"")}</div>;
      }
      if (line.startsWith("🎯")) {
        return <div key={i} style={{background:"linear-gradient(135deg,#1a2a1a,#0d1f0d)", border:"2px solid #00e676", borderRadius:"10px", padding:"1rem", marginTop:"1.2rem", color:"#00e676", fontWeight:700, fontSize:"1rem"}}>{line}</div>;
      }
      if (line.match(/^\d+\./)) {
        return <div key={i} style={{color:"#b0bec5", padding:"0.15rem 0", fontSize:"0.88rem"}}>{line}</div>;
      }
      if (line.trim() === "") return <div key={i} style={{height:"0.4rem"}} />;
      return <div key={i} style={{color:"#cfd8dc", fontSize:"0.88rem", lineHeight:"1.6"}}>{line}</div>;
    });
  };

  const getBarWidth = (val) => val ? `${val}%` : "33%";
  const getColor = (val, isA) => {
    if (!val) return "#546e7a";
    if (isA) return val > 45 ? "#00e676" : val > 35 ? "#ffca28" : "#ef5350";
    return val > 45 ? "#00e676" : val > 35 ? "#ffca28" : "#ef5350";
  };

  return (
    <div style={{minHeight:"100vh", background:"#0a0f0a", color:"#e0e0e0", fontFamily:"'Inter', system-ui, sans-serif", padding:"1.5rem 1rem"}}>
      
      {/* Header */}
      <div style={{textAlign:"center", marginBottom:"2rem"}}>
        <div style={{fontSize:"2.5rem", marginBottom:"0.3rem"}}>⚽</div>
        <h1 style={{margin:0, fontSize:"1.6rem", fontWeight:800, background:"linear-gradient(90deg,#00e676,#69f0ae)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", letterSpacing:"-0.02em"}}>
          Football AI Agent
        </h1>
        <p style={{margin:"0.4rem 0 0", color:"#546e7a", fontSize:"0.82rem", letterSpacing:"0.08em", textTransform:"uppercase"}}>
          Analyse prédictive par IA
        </p>
      </div>

      {/* Config Card */}
      <div style={{background:"#111811", border:"1px solid #1e3a1e", borderRadius:"14px", padding:"1.2rem", marginBottom:"1.2rem"}}>
        
        {/* Teams */}
        <datalist id="team-suggestions">
          {SUGGESTIONS.map(t => <option key={t} value={t} />)}
        </datalist>
        <div style={{display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:"0.8rem", alignItems:"center", marginBottom:"1rem"}}>
          <div>
            <label style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"0.4rem"}}>Équipe A</label>
            <input list="team-suggestions" value={teamA} onChange={e => setTeamA(e.target.value)} placeholder="Tape une équipe..."
              style={{width:"100%", background:"#0d1a0d", border:"1px solid #2e4a2e", borderRadius:"8px", color:"#e0e0e0", padding:"0.6rem 0.8rem", fontSize:"0.85rem", boxSizing:"border-box"}} />
          </div>
          <div style={{color:"#00e676", fontWeight:800, fontSize:"1.1rem", marginTop:"1.2rem"}}>VS</div>
          <div>
            <label style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"0.4rem"}}>Équipe B</label>
            <input list="team-suggestions" value={teamB} onChange={e => setTeamB(e.target.value)} placeholder="Tape une équipe..."
              style={{width:"100%", background:"#0d1a0d", border:"1px solid #2e4a2e", borderRadius:"8px", color:"#e0e0e0", padding:"0.6rem 0.8rem", fontSize:"0.85rem", boxSizing:"border-box"}} />
          </div>
        </div>

        {/* Venue & Competition */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.8rem", marginBottom:"1rem"}}>
          <div>
            <label style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"0.4rem"}}>Terrain</label>
            <select value={venue} onChange={e => setVenue(e.target.value)}
              style={{width:"100%", background:"#0d1a0d", border:"1px solid #2e4a2e", borderRadius:"8px", color:"#e0e0e0", padding:"0.6rem 0.8rem", fontSize:"0.82rem", appearance:"none"}}>
              <option value="A">Domicile A</option>
              <option value="B">Domicile B</option>
              <option value="neutral">Terrain neutre</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"0.4rem"}}>Compétition</label>
            <select value={competition} onChange={e => setCompetition(e.target.value)}
              style={{width:"100%", background:"#0d1a0d", border:"1px solid #2e4a2e", borderRadius:"8px", color:"#e0e0e0", padding:"0.6rem 0.8rem", fontSize:"0.82rem", appearance:"none"}}>
              {["Champions League","Europa League","Ligue 1","Liga","Premier League","Serie A","Bundesliga","Coupe du Monde"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* CTA */}
        <button onClick={runAgent} disabled={loading}
          style={{width:"100%", background: loading ? "#1a2e1a" : "linear-gradient(135deg,#00e676,#00c853)", border:"none", borderRadius:"10px", color: loading ? "#546e7a" : "#0a0f0a", fontWeight:800, fontSize:"0.95rem", padding:"0.85rem", cursor: loading ? "not-allowed" : "pointer", letterSpacing:"0.04em", transition:"all 0.2s"}}>
          {loading ? "⚡ Analyse en cours..." : "🔍 Analyser le match"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{background:"#1a0d0d", border:"1px solid #ef5350", borderRadius:"10px", padding:"0.8rem 1rem", color:"#ef9a9a", fontSize:"0.85rem", marginBottom:"1rem"}}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{background:"#111811", border:"1px solid #1e3a1e", borderRadius:"14px", padding:"2rem", textAlign:"center"}}>
          <div style={{fontSize:"2rem", marginBottom:"0.8rem", animation:"spin 1s linear infinite", display:"inline-block"}}>⚽</div>
          <div style={{color:"#546e7a", fontSize:"0.85rem"}}>L'agent analyse les équipes, les stats et les tendances...</div>
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
      )}

      {/* Probs bar */}
      {(probA || probB) && (
        <div style={{background:"#111811", border:"1px solid #1e3a1e", borderRadius:"14px", padding:"1.2rem", marginBottom:"1rem"}}>
          <div style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"0.8rem"}}>Probabilités</div>
          <div style={{display:"flex", gap:"3px", height:"28px", borderRadius:"6px", overflow:"hidden"}}>
            <div style={{width:getBarWidth(probA), background:getColor(probA,true), display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.78rem", fontWeight:700, color:"#0a0f0a", transition:"width 0.6s ease"}}>{probA}%</div>
            <div style={{width:getBarWidth(probN), background:"#37474f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.78rem", fontWeight:700, color:"#e0e0e0"}}>{probN}%</div>
            <div style={{width:getBarWidth(probB), background:getColor(probB,false), display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.78rem", fontWeight:700, color:"#0a0f0a", transition:"width 0.6s ease"}}>{probB}%</div>
          </div>
          <div style={{display:"flex", justifyContent:"space-between", marginTop:"0.4rem"}}>
            <span style={{fontSize:"0.72rem", color:"#90a4ae"}}>{teamA}</span>
            <span style={{fontSize:"0.72rem", color:"#546e7a"}}>Nul</span>
            <span style={{fontSize:"0.72rem", color:"#90a4ae"}}>{teamB}</span>
          </div>
        </div>
      )}

      {/* Top scorers */}
      {scorers.length > 0 && (
        <div style={{background:"#111811", border:"1px solid #1e3a1e", borderRadius:"14px", padding:"1.2rem", marginBottom:"1rem"}}>
          <div style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"1rem"}}>
            ⚽ Buteurs probables
          </div>
          {scorers.map((s, i) => (
            <div key={i} style={{marginBottom: i === scorers.length-1 ? 0 : "0.9rem"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.35rem"}}>
                <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
                  <span style={{fontSize:"0.75rem", fontWeight:800, color: i===0 ? "#00e676" : "#546e7a", minWidth:"1.1rem"}}>{i+1}</span>
                  <span style={{fontSize:"0.88rem", fontWeight:600, color:"#e0e0e0"}}>{s.name}</span>
                  <span style={{fontSize:"0.72rem", color:"#546e7a"}}>· {s.team}</span>
                </div>
                <span style={{fontSize:"0.82rem", fontWeight:800, color: s.pct >= 40 ? "#00e676" : s.pct >= 25 ? "#ffca28" : "#90a4ae"}}>{s.pct}%</span>
              </div>
              <div style={{height:"6px", background:"#0d1a0d", borderRadius:"3px", overflow:"hidden"}}>
                <div style={{height:"100%", width:`${Math.min(s.pct, 100)}%`, background: s.pct >= 40 ? "linear-gradient(90deg,#00c853,#00e676)" : s.pct >= 25 ? "#ffca28" : "#546e7a", borderRadius:"3px", transition:"width 0.6s ease"}} />
              </div>
            </div>
          ))}
        </div>
      )}
      {analysis && (
        <div style={{background:"#111811", border:"1px solid #1e3a1e", borderRadius:"14px", padding:"1.2rem"}}>
          <div style={{fontSize:"0.7rem", color:"#546e7a", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"0.8rem"}}>
            📋 Analyse complète
          </div>
          <div style={{lineHeight:"1.7"}}>
            {formatAnalysis(analysis)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{textAlign:"center", marginTop:"1.5rem", color:"#263238", fontSize:"0.72rem"}}>
        Propulsé par Claude Sonnet · Pour divertissement uniquement
      </div>
    </div>
  );
}
