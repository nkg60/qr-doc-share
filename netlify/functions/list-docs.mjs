// Fonction "list-docs" : liste des documents pour la page « Mes documents »,
// avec le nombre de scans de chacun.
//
// Paramètre ?scope= (appliqué CÔTÉ SERVEUR — défense en profondeur, on ne se
// repose pas sur le frontend pour filtrer) :
//   - "mine"   (défaut) : les documents dont l'appelant est propriétaire ;
//   - "all"    (admin uniquement) : TOUS les documents, legacy inclus ;
//   - "legacy" (admin uniquement) : les documents sans propriétaire.
// Pour un non-admin, le paramètre est ignoré : toujours "mine".

import { json, exigerUtilisateur, ouvrirStore } from "./_lib/utils.mjs";

export default async (requete) => {
  if (requete.method !== "GET") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  const { utilisateur, erreur } = exigerUtilisateur(requete);
  if (erreur) return erreur;

  // Le scope demandé n'est honoré que pour un admin.
  const demande = new URL(requete.url).searchParams.get("scope") || "mine";
  const scope = utilisateur.isAdmin && ["all", "legacy"].includes(demande) ? demande : "mine";

  const docs = ouvrirStore("docs");
  const scans = ouvrirStore("scans");

  // Nombre de scans par document : les clés du store "scans" sont préfixées
  // par le token du document ("token/horodatage-aléa"), il suffit de compter.
  const compteScans = {};
  const { blobs: listeScans } = await scans.list();
  for (const blob of listeScans) {
    const token = blob.key.split("/")[0];
    compteScans[token] = (compteScans[token] || 0) + 1;
  }

  const documents = [];
  // Quota de l'appelant : total de SES documents, quel que soit le scope
  // affiché (permet au frontend d'indiquer « Quota restant : X Mo »).
  let quotaUtilise = 0;
  const { blobs } = await docs.list();
  for (const blob of blobs) {
    const meta = (await docs.getMetadata(blob.key))?.metadata || {};

    if (meta.owner_code === utilisateur.code) {
      quotaUtilise += Number(meta.taille) || 0;
    }

    // Filtrage selon le scope, toujours côté serveur.
    if (scope === "mine" && meta.owner_code !== utilisateur.code) continue;
    if (scope === "legacy" && meta.owner_code) continue;
    // scope === "all" : aucun filtre (admin vérifié plus haut).

    documents.push({
      token: blob.key,
      nom: meta.nom || "document",
      taille: Number(meta.taille) || 0,
      date: meta.date || null,
      proprietaire: meta.owner_label || null, // null = document legacy
      nbScans: compteScans[blob.key] || 0,
    });
  }

  // Du plus récent au plus ancien.
  documents.sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1));

  return json({
    documents,
    scope,
    isAdmin: utilisateur.isAdmin,
    label: utilisateur.label,
    // Uniquement le quota de l'appelant, jamais celui des autres.
    quota: { maxBytes: utilisateur.maxBytes, utilise: quotaUtilise },
  });
};
