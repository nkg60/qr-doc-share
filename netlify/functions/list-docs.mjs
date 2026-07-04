// Fonction "list-docs" : liste les documents de l'utilisateur connecté
// (page « Mes documents »), avec le nombre de scans de chacun.
// Pour un admin, renvoie aussi les documents "legacy" (sans propriétaire,
// importés avant la V1.1) dans une liste séparée.

import { getStore } from "@netlify/blobs";
import { json, exigerUtilisateur } from "./_lib/utils.mjs";

export default async (requete) => {
  if (requete.method !== "GET") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  const { utilisateur, erreur } = exigerUtilisateur(requete);
  if (erreur) return erreur;

  const docs = getStore("docs");
  const scans = getStore("scans");

  // Nombre de scans par document : les clés du store "scans" sont préfixées
  // par le token du document ("token/horodatage-aléa"), il suffit de compter.
  const compteScans = {};
  const { blobs: listeScans } = await scans.list();
  for (const blob of listeScans) {
    const token = blob.key.split("/")[0];
    compteScans[token] = (compteScans[token] || 0) + 1;
  }

  const miens = [];
  const legacy = [];
  const { blobs } = await docs.list();
  for (const blob of blobs) {
    const meta = (await docs.getMetadata(blob.key))?.metadata || {};
    const doc = {
      token: blob.key,
      nom: meta.nom || "document",
      taille: Number(meta.taille) || 0,
      date: meta.date || null,
      proprietaire: meta.owner_label || null,
      nbScans: compteScans[blob.key] || 0,
    };

    if (!meta.owner_code) {
      // Document importé avant la V1.1 : visible uniquement des admins,
      // dans un onglet à part, pour décider quoi en faire.
      if (utilisateur.isAdmin) legacy.push(doc);
    } else if (meta.owner_code === utilisateur.code) {
      miens.push(doc);
    }
    // Les documents des autres utilisateurs ne sont jamais renvoyés ici.
  }

  // Du plus récent au plus ancien.
  const parDateDesc = (a, b) => ((a.date || "") < (b.date || "") ? 1 : -1);
  miens.sort(parDateDesc);
  legacy.sort(parDateDesc);

  return json({
    documents: miens,
    legacy: utilisateur.isAdmin ? legacy : [],
    isAdmin: utilisateur.isAdmin,
    label: utilisateur.label,
  });
};
