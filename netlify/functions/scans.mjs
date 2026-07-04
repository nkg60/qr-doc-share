// Fonction "scans" : consultation et export des emails collectés.
// Protégée par le code d'accès (en-tête X-Access-Code).
// Visibilité : un utilisateur ne voit que les scans de SES documents ;
// un admin voit tout (y compris les documents legacy et supprimés).
// - GET  /.netlify/functions/scans            -> liste JSON
// - GET  /.netlify/functions/scans?format=csv -> export CSV

import { json, exigerUtilisateur, ouvrirStore } from "./_lib/utils.mjs";

// Échappe une valeur pour une cellule CSV (guillemets doublés, cellule citée).
function celluleCsv(valeur) {
  return `"${String(valeur ?? "").replaceAll('"', '""')}"`;
}

export default async (requete) => {
  if (requete.method !== "GET") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  const { utilisateur, erreur } = exigerUtilisateur(requete);
  if (erreur) return erreur;

  const scans = ouvrirStore("scans");
  const docs = ouvrirStore("docs");
  const { blobs } = await scans.list();

  // Cache des métadonnées de documents, pour ne pas relire N fois le même.
  const cacheMetaDocs = new Map();
  async function metaDoc(token) {
    if (!cacheMetaDocs.has(token)) {
      cacheMetaDocs.set(token, (await docs.getMetadata(token))?.metadata || null);
    }
    return cacheMetaDocs.get(token);
  }

  const lignes = [];
  for (const blob of blobs) {
    const scan = await scans.get(blob.key, { type: "json" });
    if (!scan) continue;

    // Instantané enregistré au moment du scan (V1.1) ; pour les scans V1
    // qui n'en ont pas, on retombe sur les métadonnées du document s'il
    // existe encore.
    const meta = scan.nomDocument ? null : await metaDoc(scan.token);
    const proprietaireCode = scan.ownerCode ?? meta?.owner_code ?? null;
    const proprietaireLabel =
      scan.ownerLabel ?? meta?.owner_label ?? (proprietaireCode ? null : "legacy");
    const nomDocument = scan.nomDocument ?? meta?.nom ?? "(inconnu)";

    // Visibilité : un non-admin ne voit que les scans de ses propres documents.
    if (!utilisateur.isAdmin && proprietaireCode !== utilisateur.code) continue;

    lignes.push({
      token: scan.token,
      proprietaire: proprietaireLabel || "legacy",
      document: nomDocument,
      email: scan.email,
      date: scan.date,
      userAgent: scan.userAgent,
      documentSupprime: scan.document_deleted === true,
    });
  }

  // Tri du plus récent au plus ancien.
  lignes.sort((a, b) => (a.date < b.date ? 1 : -1));

  const url = new URL(requete.url);
  if (url.searchParams.get("format") === "csv") {
    const entete = ["token", "proprietaire", "document", "email", "date", "user_agent", "document_supprime"];
    const csv = [
      entete.join(";"),
      ...lignes.map((l) =>
        [l.token, l.proprietaire, l.document, l.email, l.date, l.userAgent, l.documentSupprime ? "oui" : "non"]
          .map(celluleCsv)
          .join(";")
      ),
    ].join("\r\n");

    return new Response("﻿" + csv, {
      // Le BOM UTF-8 en tête permet à Excel d'afficher correctement les accents.
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="scans.csv"',
      },
    });
  }

  return json({ total: lignes.length, isAdmin: utilisateur.isAdmin, scans: lignes });
};
