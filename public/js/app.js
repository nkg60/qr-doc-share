// Logique de la page « Importer » (index.html).
// Le code d'accès saisi est envoyé au serveur pour vérification (fonction auth),
// puis rejoué dans l'en-tête X-Access-Code pour les appels protégés.
// Le dictionnaire ACCESS_CODES n'existe QUE côté serveur.

// --- Références DOM ---------------------------------------------------------
const sectionCode = document.getElementById("section-code");
const sectionUpload = document.getElementById("section-upload");
const sectionQr = document.getElementById("section-qr");
const sectionScans = document.getElementById("section-scans");

const barreConnexion = document.getElementById("barre-connexion");
const labelUtilisateur = document.getElementById("label-utilisateur");
const badgeAdmin = document.getElementById("badge-admin");

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
const filtreLabel = document.getElementById("filtre-label");
const listeScans = document.getElementById("liste-scans");
const msgScans = document.getElementById("msg-scans");

// Session de l'utilisateur (jamais les codes des autres, jamais les quotas).
let codeAcces = sessionStorage.getItem("codeAcces") || "";
let monLabel = sessionStorage.getItem("labelUtilisateur") || "";
let suisAdmin = sessionStorage.getItem("isAdmin") === "1";

// Scans chargés en mémoire (pour le filtre par propriétaire, côté client).
let scansCharges = [];

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
  labelUtilisateur.textContent = monLabel;
  badgeAdmin.hidden = !suisAdmin;
  barreConnexion.hidden = false;
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
      monLabel = donnees.label || "";
      suisAdmin = donnees.isAdmin === true;
      sessionStorage.setItem("codeAcces", codeAcces);
      sessionStorage.setItem("labelUtilisateur", monLabel);
      sessionStorage.setItem("isAdmin", suisAdmin ? "1" : "");
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
      // Cas notables : 401 (code invalide) et 413 (quota individuel dépassé).
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

// --- Emails collectés ----------------------------------------------------------
// Chaque utilisateur ne reçoit du serveur que SES scans ; un admin reçoit tout
// et dispose d'un filtre par propriétaire (appliqué côté client).

/** (Re)construit le tableau des scans selon le filtre courant. */
function afficherTableauScans() {
  const filtre = filtreLabel.value;
  const lignes = filtre
    ? scansCharges.filter((s) => s.proprietaire === filtre)
    : scansCharges;

  if (lignes.length === 0) {
    listeScans.innerHTML = "";
    afficherMessage(msgScans, "Aucun email collecté pour cette sélection.", "");
    return;
  }

  // Construction du tableau (textContent partout : aucune injection HTML possible).
  const colonnes = suisAdmin
    ? ["Propriétaire", "Document", "Email", "Date"]
    : ["Document", "Email", "Date"];
  const table = document.createElement("table");
  const entete = table.insertRow();
  for (const titre of colonnes) {
    const th = document.createElement("th");
    th.textContent = titre;
    entete.appendChild(th);
  }
  for (const scan of lignes) {
    const ligne = table.insertRow();
    if (suisAdmin) ligne.insertCell().textContent = scan.proprietaire;
    // Un document supprimé reste visible dans l'historique, signalé comme tel.
    ligne.insertCell().textContent =
      scan.document + (scan.documentSupprime ? " (supprimé)" : "");
    ligne.insertCell().textContent = scan.email;
    ligne.insertCell().textContent = new Date(scan.date).toLocaleString("fr-FR");
  }
  listeScans.innerHTML = "";
  listeScans.appendChild(table);
  afficherMessage(msgScans, `${lignes.length} email(s) affiché(s).`, "ok");
}

// Chargement de la liste des scans.
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

    scansCharges = donnees.scans;

    // Filtre par propriétaire : uniquement pour un admin (pour un utilisateur
    // normal, il n'y aurait qu'un seul label — le sien).
    if (donnees.isAdmin) {
      const labels = [...new Set(scansCharges.map((s) => s.proprietaire))].sort();
      filtreLabel.innerHTML = "";
      const optionTous = document.createElement("option");
      optionTous.value = "";
      optionTous.textContent = "Tous";
      filtreLabel.appendChild(optionTous);
      for (const label of labels) {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = "Documents de " + label;
        filtreLabel.appendChild(option);
      }
      filtreLabel.hidden = false;
    } else {
      filtreLabel.hidden = true;
    }

    afficherTableauScans();
  } catch {
    afficherMessage(msgScans, "Erreur réseau.", "erreur");
  }
});

// Changement de filtre : on re-rend le tableau sans rappeler le serveur.
filtreLabel.addEventListener("change", afficherTableauScans);

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
