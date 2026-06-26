// api/analyze-match.js
// Fonction serverless Vercel — analyse de match foot via Claude + recherche web.
// La clé API reste côté serveur : jamais exposée au navigateur.

const SYSTEM_PROMPT = `Tu es un analyste football expert. On te donne deux équipes et tu dois analyser et prédire le résultat probable d'un match.

Utilise la recherche web pour trouver des informations RÉCENTES : forme actuelle, derniers résultats, blessés, compositions probables.

Tu dois structurer ton analyse EN FRANÇAIS en plusieurs étapes claires:

1. **ANALYSE ÉQUIPE A** : forme récente (5 derniers matchs), blessés/suspendus importants, système tactique, forces/faiblesses
2. **ANALYSE ÉQUIPE B** : même chose
3. **COMPARAISON STATISTIQUE** : attaque vs défense, possession, duels, tirs cadrés, buts marqués/encaissés en moyenne
4. **FACTEURS CLÉS** : domicile/extérieur, historique des confrontations, forme des joueurs stars, style du coach
5. **VERDICT FINAL** : probabilité de victoire pour chaque équipe + nul, avec le score le plus probable

6. **BUTEURS PROBABLES** : liste les 4 à 6 joueurs les plus susceptibles de marquer (toutes équipes confondues), classés par probabilité décroissante.
Utilise EXACTEMENT ce format sur une ligne par joueur, encadré par les balises :
[BUTEURS]
Nom du joueur | Équipe | XX%
Nom du joueur | Équipe | XX%
[/BUTEURS]
Base ces probabilités sur la forme, le rôle (attaquant/tireur de penalty), et la qualité défensive adverse.

Sois précis, analytique, et utilise des données réalistes. Formate bien avec des sections claires.
Termine TOUJOURS par une section "🎯 PRONOSTIC FINAL" avec les pourcentages et score prédit, suivie du bloc [BUTEURS].`;

export default async function handler(req, res) {
  // CORS — autorise ton frontend à appeler cette route
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API non configurée sur le serveur" });
  }

  try {
    const { teamA, teamB, venue, competition } = req.body || {};

    if (!teamA || !teamB) {
      return res.status(400).json({ error: "Les deux équipes sont requises" });
    }

    const venueLabel =
      venue === "A" ? `à domicile pour ${teamA}` :
      venue === "B" ? `à domicile pour ${teamB}` : "terrain neutre";

    const userPrompt = `Analyse ce match de football :

⚽ Match : ${teamA} vs ${teamB}
🏟️ Lieu : ${venueLabel}
🏆 Compétition : ${competition || "non précisée"}

Recherche les infos les plus récentes puis effectue une analyse complète avec ton pronostic (probabilités % de victoire ${teamA} / nul / victoire ${teamB}).`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: data?.error?.message || "Erreur de l'API Anthropic",
      });
    }

    // On assemble tout le texte (en ignorant les blocs de recherche web)
    const fullText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return res.status(200).json({ analysis: fullText });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
}
