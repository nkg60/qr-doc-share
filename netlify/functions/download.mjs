// Fonction "download" : sert le fichier stocké dans le store "docs".
// Grâce à "config.path", elle répond directement sur l'URL /download/{token}.

import { json, ouvrirStore } from "./_lib/utils.mjs";

export default async (requete, contexte) => {
  if (requete.method !== "GET") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  // Token depuis la route /download/:token ; filet de sécurité : netlify dev
  // ré-essaie parfois l'URL avec un suffixe (/index.html) sans renseigner
  // params, on retombe alors sur le premier segment après /download/.
  let token = contexte.params?.token;
  if (!token) {
    const segments = new URL(requete.url).pathname.split("/").filter(Boolean);
    token = segments[1] || "";
  }
  if (!token) {
    return json({ erreur: "Document introuvable ou lien expiré." }, 404);
  }

  const docs = ouvrirStore("docs");
  // Récupération du contenu (en flux) et des métadonnées en un seul appel.
  const resultat = await docs.getWithMetadata(token, { type: "stream" });
  if (!resultat) {
    return json({ erreur: "Document introuvable ou lien expiré." }, 404);
  }

  const { data, metadata } = resultat;
  const nom = metadata?.nom || "document";

  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": metadata?.type || "application/octet-stream",
      // filename* (RFC 5987) pour gérer les accents dans le nom de fichier.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Content-Length": String(metadata?.taille || ""),
      "Cache-Control": "no-store",
    },
  });
};

// Route publique de la fonction : /download/{token}
export const config = {
  path: "/download/:token",
};
