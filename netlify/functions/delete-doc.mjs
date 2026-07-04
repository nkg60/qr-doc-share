// Fonction "delete-doc" : supprime définitivement un document (blob +
// métadonnées). Les scans déjà collectés sont CONSERVÉS mais marqués
// orphelins (document_deleted = true) pour garder la trace des emails.

import { getStore } from "@netlify/blobs";
import {
  json,
  exigerUtilisateur,
  exigerProprietaire,
  journaliserActionAdmin,
} from "./_lib/utils.mjs";

export default async (requete) => {
  if (requete.method !== "POST") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  const { utilisateur, erreur } = exigerUtilisateur(requete);
  if (erreur) return erreur;

  let corps;
  try {
    corps = await requete.json();
  } catch {
    return json({ erreur: "Corps de requête invalide." }, 400);
  }
  const token = String(corps.token ?? "").trim();
  if (!token) {
    return json({ erreur: "Token manquant." }, 400);
  }

  const docs = getStore("docs");
  const meta = await docs.getMetadata(token);
  if (!meta) {
    return json({ erreur: "Document introuvable." }, 404);
  }

  // Seul le propriétaire (ou un admin) peut supprimer.
  const refus = exigerProprietaire(utilisateur, meta.metadata);
  if (refus) return refus;

  // Traçabilité : une suppression par un admin d'un document qui n'est pas
  // le sien est journalisée dans le store "admin_actions".
  await journaliserActionAdmin(utilisateur, "delete", token, meta.metadata);

  // Suppression du document lui-même.
  await docs.delete(token);

  // Les scans restent, marqués orphelins : l'export CSV garde la trace.
  const scans = getStore("scans");
  const { blobs } = await scans.list({ prefix: `${token}/` });
  for (const blob of blobs) {
    const scan = await scans.get(blob.key, { type: "json" });
    if (!scan) continue;
    scan.document_deleted = true;
    await scans.setJSON(blob.key, scan);
  }

  return json({ ok: true });
};
