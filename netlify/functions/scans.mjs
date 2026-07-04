// Fonction "scans" : consultation et export des emails collectés.
// Protégée par le code d'accès (en-tête X-Access-Code).
// - GET  /.netlify/functions/scans            -> liste JSON
// - GET  /.netlify/functions/scans?format=csv -> export CSV

import { getStore } from "@netlify/blobs";
import { json, exigerCode } from "./_lib/utils.mjs";

// Échappe une valeur pour une cellule CSV (guillemets doublés, cellule citée).
function celluleCsv(valeur) {
  return `"${String(valeur ?? "").replaceAll('"', '""')}"`;
}

export default async (requete) => {
  if (requete.method !== "GET") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  const refus = exigerCode(requete);
  if (refus) return refus;

  const scans = getStore("scans");
  const docs = getStore("docs");
  const { blobs } = await scans.list();

  // Lecture de chaque enregistrement de scan.
  const lignes = [];
  for (const blob of blobs) {
    const scan = await scans.get(blob.key, { type: "json" });
    if (!scan) continue;
    // On enrichit avec le nom du document, si celui-ci existe encore.
    const metaDoc = await docs.getMetadata(scan.token);
    lignes.push({
      token: scan.token,
      document: metaDoc?.metadata?.nom || "(supprimé)",
      email: scan.email,
      date: scan.date,
      userAgent: scan.userAgent,
    });
  }

  // Tri du plus récent au plus ancien.
  lignes.sort((a, b) => (a.date < b.date ? 1 : -1));

  const url = new URL(requete.url);
  if (url.searchParams.get("format") === "csv") {
    const entete = ["token", "document", "email", "date", "user_agent"];
    const csv = [
      entete.join(";"),
      ...lignes.map((l) =>
        [l.token, l.document, l.email, l.date, l.userAgent].map(celluleCsv).join(";")
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

  return json({ total: lignes.length, scans: lignes });
};
