// Fonction "upload" : reçoit un fichier, vérifie le quota global de stockage,
// puis l'enregistre dans le store Netlify Blobs "docs" sous un token
// aléatoire non devinable. Renvoie l'URL publique /d/{token}.

import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { json, exigerCode } from "./_lib/utils.mjs";

// Quota par défaut si MAX_TOTAL_BYTES n'est pas défini : 100 Mo.
const QUOTA_PAR_DEFAUT = 100 * 1024 * 1024;

export default async (requete) => {
  if (requete.method !== "POST") {
    return json({ erreur: "Méthode non autorisée." }, 405);
  }

  // L'upload est lui aussi protégé par le code d'accès (défense côté serveur :
  // valider le code une fois sur la page ne suffirait pas, un attaquant
  // pourrait appeler cette fonction directement).
  const refus = exigerCode(requete);
  if (refus) return refus;

  // Nom de fichier d'origine, transmis encodé dans un en-tête.
  const nomBrut = requete.headers.get("x-file-name") || "document";
  const nom = decodeURIComponent(nomBrut);
  const typeMime = requete.headers.get("content-type") || "application/octet-stream";

  // Lecture du fichier envoyé en corps de requête binaire.
  const contenu = await requete.arrayBuffer();
  const taille = contenu.byteLength;
  if (taille === 0) {
    return json({ erreur: "Fichier vide ou manquant." }, 400);
  }

  const docs = getStore("docs");

  // --- Vérification du quota global -----------------------------------
  // On additionne la taille (stockée en métadonnée) de tous les fichiers
  // déjà présents dans le store "docs".
  const quota = Number(process.env.MAX_TOTAL_BYTES) || QUOTA_PAR_DEFAUT;
  let totalExistant = 0;
  const { blobs } = await docs.list();
  for (const blob of blobs) {
    const meta = await docs.getMetadata(blob.key);
    totalExistant += Number(meta?.metadata?.taille) || 0;
  }

  if (totalExistant + taille > quota) {
    const enMo = (n) => (n / (1024 * 1024)).toFixed(1);
    return json(
      {
        erreur:
          `Quota de stockage dépassé : ${enMo(totalExistant)} Mo déjà utilisés ` +
          `sur ${enMo(quota)} Mo. Ce fichier de ${enMo(taille)} Mo ne peut pas être accepté.`,
      },
      413
    );
  }

  // --- Enregistrement ---------------------------------------------------
  // Token aléatoire non devinable (128 bits, encodé en base64 URL-safe).
  const token = randomBytes(16).toString("base64url");

  await docs.set(token, contenu, {
    metadata: {
      nom,                            // nom de fichier d'origine
      taille,                         // taille en octets
      date: new Date().toISOString(), // date d'import
      type: typeMime,                 // type MIME, réutilisé au téléchargement
    },
  });

  // Le frontend générera le QR code à partir de cette URL publique.
  return json({ token, url: `/d/${token}` });
};
