// Fonction "rotate-token" : régénère l'URL d'un document en remplaçant son
// token par un nouveau token aléatoire 128 bits. L'ancienne URL (et donc
// l'ancien QR code) cesse de fonctionner. L'historique des scans est
// conservé : les entrées du store "scans" sont déplacées sous le nouveau
// token et leur champ token est mis à jour.

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
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
  const ancienToken = String(corps.token ?? "").trim();
  if (!ancienToken) {
    return json({ erreur: "Token manquant." }, 400);
  }

  const docs = getStore("docs");
  const resultat = await docs.getWithMetadata(ancienToken, { type: "arrayBuffer" });
  if (!resultat) {
    return json({ erreur: "Document introuvable." }, 404);
  }

  // Seul le propriétaire (ou un admin) peut faire tourner le token.
  const refus = exigerProprietaire(utilisateur, resultat.metadata);
  if (refus) return refus;

  // Traçabilité : une rotation par un admin d'un document qui n'est pas
  // le sien est journalisée dans le store "admin_actions".
  await journaliserActionAdmin(utilisateur, "rotate", ancienToken, resultat.metadata);

  // Nouveau token aléatoire non devinable (128 bits).
  const nouveauToken = randomBytes(16).toString("base64url");

  // 1. Copie du document sous la nouvelle clé (mêmes métadonnées).
  await docs.set(nouveauToken, resultat.data, { metadata: resultat.metadata });

  // 2. Déplacement des scans existants sous le nouveau préfixe, en mettant
  //    à jour leur champ token, pour ne pas perdre l'historique.
  const scans = getStore("scans");
  const { blobs } = await scans.list({ prefix: `${ancienToken}/` });
  for (const blob of blobs) {
    const scan = await scans.get(blob.key, { type: "json" });
    if (!scan) continue;
    scan.token = nouveauToken;
    const suffixe = blob.key.slice(ancienToken.length + 1);
    await scans.setJSON(`${nouveauToken}/${suffixe}`, scan);
    await scans.delete(blob.key);
  }

  // 3. Suppression de l'ancienne clé : l'ancienne URL est morte.
  await docs.delete(ancienToken);

  return json({ token: nouveauToken, url: `/d/${nouveauToken}` });
};
