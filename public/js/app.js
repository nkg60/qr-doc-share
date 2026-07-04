// Logique de la page « Importer » (index.html).
// Le code d'accès saisi est envoyé au serveur pour vérification (fonction auth),
// puis rejoué dans l'en-tête X-Access-Code pour l'upload et la consultation
// des scans. Le code attendu n'existe QUE côté serveur (variable ACCESS_CODE).

// --- Références DOM ---------------------------------------------------------
const sectionCode = document.getElementById("section-code");
const sectionUpload = document.getElementById("section-upload");
const sectionQr = document.getElementById("section-qr");
const sectionScans = document.getElementById("section-scans");

const formCode = document.getElementById("form-code");
const champCode = document.getElementById("champ-code");
const msgCode = document.getElementById("msg-code");

const formUpload = document.getElementById("form-upload");
const champFichier = document.getElementById("champ-fichier");
const btnUpload = document.getElementById("btn-upload");
const msgUpload = document.getElementById("msg-upload");

const apercuQr = document.getElementById("apercu-qr");
const urlPublique = document.getElementById("url-publique");
const btnTelechargerQr = document.getElementById("btn-telecharger-qr");
const btnCopierUrl = document.getElementById("btn-copier-url");
const btnNouveau = document.getElementById("btn-nouveau");
const msgQr = document.getElementById("msg-qr");

const btnChargerScans = document.getElementById("btn-charger-scans");
const btnExportCsv = document.getElementById("btn-export-csv");
const listeScans = document.getElementById("liste-scans");
const msgScans = document.getElementById("msg-scans");

// Code validé, gardé en mémoire pour la session (jamais le code attendu).
let codeAcces = sessionStorage.getItem("codeAcces") || "";

// --- Petits utilitaires -----------------------------------------------------

/** Affiche un message d'état sous un formulaire. */
function afficherMessage(element, texte, type) {
  element.textContent = texte;
  element.className = "message " + (type || "");
  element.hidden = !texte;
}

/** Passe l'interface en mode « authentifié ». */
function afficherEspaceImport() {
  sectionCode.hidden = true;
  sectionUpload.hidden = false;
  sectionScans.hidden = false;
}

// Si un code a déjà été validé dans cette session, on ré-affiche directement
// l'espace d'import (le serveur re-vérifiera le code à chaque appel de toute façon).
if (codeAcces) afficherEspaceImport();

// --- Étape 1 : validation du code d'accès ------------------------------------
formCode.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  afficherMessage(msgCode, "Vérification…", "");

  try {
    const reponse = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: champCode.value.trim() }),
    });
    const donnees = await reponse.json();

    if (donnees.valide) {
      codeAcces = champCode.value.trim();
      sessionStorage.setItem("codeAcces", codeAcces);
      afficherMessage(msgCode, "", "");
      afficherEspaceImport();
    } else {
      afficherMessage(msgCode, "Code invalide. Réessayez.", "erreur");
    }
  } catch {
    afficherMessage(msgCode, "Erreur réseau. Réessayez.", "erreur");
  }
});

// --- Étape 2 : import du fichier ---------------------------------------------
formUpload.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const fichier = champFichier.files[0];
  if (!fichier) return;

  btnUpload.disabled = true;
  afficherMessage(msgUpload, "Import en cours…", "");

  try {
    const reponse = await fetch("/.netlify/functions/upload", {
      method: "POST",
      headers: {
        "X-Access-Code": codeAcces,
        // Nom d'origine encodé pour survivre aux accents dans un en-tête HTTP.
        "X-File-Name": encodeURIComponent(fichier.name),
        "Content-Type": fichier.type || "application/octet-stream",
      },
      body: fichier,
    });
    const donnees = await reponse.json();

    if (!reponse.ok) {
      // Cas notables : 401 (code invalide) et 413 (quota dépassé).
      afficherMessage(msgUpload, donnees.erreur || "Échec de l'import.", "erreur");
      return;
    }

    afficherMessage(msgUpload, "", "");
    await afficherQrCode(donnees.url);
  } catch {
    afficherMessage(msgUpload, "Erreur réseau pendant l'import.", "erreur");
  } finally {
    btnUpload.disabled = false;
  }
});

// --- Étape 3 : génération et actions sur le QR code ---------------------------

/** Génère le QR code (librairie qrcode, objet global QRCode) et affiche la section. */
async function afficherQrCode(cheminRelatif) {
  // URL absolue : c'est elle qui est encodée dans le QR code.
  const urlAbsolue = location.origin + cheminRelatif;

  // Aperçu sur un canvas (permet ensuite l'export PNG).
  apercuQr.innerHTML = "";
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, urlAbsolue, { width: 260, margin: 2 });
  apercuQr.appendChild(canvas);

  urlPublique.textContent = urlAbsolue;
  sectionUpload.hidden = true;
  sectionQr.hidden = false;
}

// Téléchargement du QR code en PNG.
btnTelechargerQr.addEventListener("click", () => {
  const canvas = apercuQr.querySelector("canvas");
  if (!canvas) return;
  const lien = document.createElement("a");
  lien.href = canvas.toDataURL("image/png");
  lien.download = "qr-code-document.png";
  lien.click();
});

// Copie de l'URL publique dans le presse-papiers.
btnCopierUrl.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(urlPublique.textContent);
    afficherMessage(msgQr, "URL copiée dans le presse-papiers.", "ok");
  } catch {
    afficherMessage(msgQr, "Impossible de copier automatiquement. Sélectionnez l'URL ci-dessus.", "erreur");
  }
});

// Retour au formulaire d'import pour un nouveau document.
btnNouveau.addEventListener("click", () => {
  formUpload.reset();
  afficherMessage(msgQr, "", "");
  sectionQr.hidden = true;
  sectionUpload.hidden = false;
});

// --- Section admin : emails collectés -----------------------------------------

// Chargement et affichage de la liste des scans.
btnChargerScans.addEventListener("click", async () => {
  afficherMessage(msgScans, "Chargement…", "");
  try {
    const reponse = await fetch("/.netlify/functions/scans", {
      headers: { "X-Access-Code": codeAcces },
    });
    const donnees = await reponse.json();

    if (!reponse.ok) {
      afficherMessage(msgScans, donnees.erreur || "Échec du chargement.", "erreur");
      return;
    }

    if (donnees.total === 0) {
      listeScans.innerHTML = "";
      afficherMessage(msgScans, "Aucun email collecté pour le moment.", "");
      return;
    }

    // Construction du tableau (textContent partout : aucune injection HTML possible).
    const table = document.createElement("table");
    const entete = table.insertRow();
    for (const titre of ["Document", "Email", "Date"]) {
      const th = document.createElement("th");
      th.textContent = titre;
      entete.appendChild(th);
    }
    for (const scan of donnees.scans) {
      const ligne = table.insertRow();
      ligne.insertCell().textContent = scan.document;
      ligne.insertCell().textContent = scan.email;
      ligne.insertCell().textContent = new Date(scan.date).toLocaleString("fr-FR");
    }
    listeScans.innerHTML = "";
    listeScans.appendChild(table);
    afficherMessage(msgScans, `${donnees.total} email(s) collecté(s).`, "ok");
  } catch {
    afficherMessage(msgScans, "Erreur réseau.", "erreur");
  }
});

// Export CSV : on télécharge via fetch pour pouvoir joindre l'en-tête X-Access-Code.
btnExportCsv.addEventListener("click", async () => {
  afficherMessage(msgScans, "Export en cours…", "");
  try {
    const reponse = await fetch("/.netlify/functions/scans?format=csv", {
      headers: { "X-Access-Code": codeAcces },
    });
    if (!reponse.ok) {
      const donnees = await reponse.json().catch(() => ({}));
      afficherMessage(msgScans, donnees.erreur || "Échec de l'export.", "erreur");
      return;
    }
    const blob = await reponse.blob();
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(blob);
    lien.download = "scans.csv";
    lien.click();
    URL.revokeObjectURL(lien.href);
    afficherMessage(msgScans, "Fichier scans.csv téléchargé.", "ok");
  } catch {
    afficherMessage(msgScans, "Erreur réseau.", "erreur");
  }
});
