// Fonction "deliver" : appelée depuis la page publique /d/{token}.
// VOLONTAIREMENT accessible sans code d'accès : la personne qui scanne le
// QR code ne connaît aucun code. Le token 128 bits non devinable est la
// seule "clé" du document.
// Enregistre l'email du visiteur dans le store "scans", enrichi d'un
// instantané (nom du document, propriétaire) pour que l'historique reste
// complet même si le document est renommé ou supprimé plus tard.

import { randomBytes } from "node:crypto";
import { json, ouvrirStore } from "./_lib/utils.mjs";

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
  const docs = ouvrirStore("docs");
  const meta = await docs.getMetadata(token);
  if (!meta) {
    return json({ erreur: "Document introuvable ou lien expiré." }, 404);
  }

  // Enregistrement du scan. Clé : token/horodatage-aléa — le préfixe permet
  // de retrouver tous les scans d'un document (rotation, suppression).
  const scans = ouvrirStore("scans");
  const cle = `${token}/${Date.now()}-${randomBytes(4).toString("hex")}`;
  await scans.setJSON(cle, {
    token,
    email,
    date: new Date().toISOString(),
    userAgent: requete.headers.get("user-agent") || "",
    // Instantané au moment du scan (survit à la suppression du document) :
    nomDocument: meta.metadata?.nom || "document",
    ownerCode: meta.metadata?.owner_code || null,
    ownerLabel: meta.metadata?.owner_label || null,
  });

  // V1 : pas d'envoi d'email, on renvoie directement le lien de téléchargement.
  return json({
    ok: true,
    nom: meta.metadata?.nom || "document",
    urlTelechargement: `/download/${token}`,
  });
};
