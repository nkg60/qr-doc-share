// Fonction "deliver" : appelée depuis la page publique /d/{token}.
// Enregistre l'email du visiteur (+ date + user-agent) dans le store "scans",
// puis renvoie l'URL de téléchargement du document.
// V1 : aucun envoi d'email — le téléchargement est proposé directement.

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { json } from "./_lib/utils.mjs";

// Validation d'email volontairement simple : quelque chose @ quelque chose . quelque chose
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (requete) => {
  if (requete.method !== "POST") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  let corps;
  try {
    corps = await requete.json();
  } catch {
    return json({ erreur: "Corps de requête invalide." }, 400);
  }

  const token = String(corps.token ?? "").trim();
  const email = String(corps.email ?? "").trim();

  if (!token) {
    return json({ erreur: "Token manquant." }, 400);
  }
  if (!EMAIL_REGEX.test(email)) {
    return json({ erreur: "Adresse email invalide." }, 400);
  }

  // Le document doit exister : on vérifie ses métadonnées sans le télécharger.
  const docs = getStore("docs");
  const meta = await docs.getMetadata(token);
  if (!meta) {
    return json({ erreur: "Document introuvable ou lien expiré." }, 404);
  }

  // Enregistrement du scan. Clé unique : token/horodatage-aléa, ce qui permet
  // de conserver plusieurs emails pour un même document.
  const scans = getStore("scans");
  const cle = `${token}/${Date.now()}-${randomBytes(4).toString("hex")}`;
  await scans.setJSON(cle, {
    token,
    email,
    date: new Date().toISOString(),
    userAgent: requete.headers.get("user-agent") || "",
  });

  // V1 : pas d'envoi d'email, on renvoie directement le lien de téléchargement.
  return json({
    ok: true,
    nom: meta.metadata?.nom || "document",
    urlTelechargement: `/download/${token}`,
  });
};
