// Logique de la page publique /d/{token} (d.html).
// Le visiteur saisit son email ; la fonction deliver l'enregistre puis
// renvoie l'URL de téléchargement (pas d'envoi d'email : téléchargement direct).

// Identité minimale en tête de carte.
document.getElementById("marque-doc").innerHTML = UI.icone("fichier", 32);

const sectionEmail = document.getElementById("section-email");
const sectionTelechargement = document.getElementById("section-telechargement");
const formEmail = document.getElementById("form-email");
const champEmail = document.getElementById("champ-email");
const btnEmail = document.getElementById("btn-email");
const msgEmail = document.getElementById("msg-email");
const bandeauSucces = document.getElementById("bandeau-succes");
const nomDocument = document.getElementById("nom-document");
const lienTelechargement = document.getElementById("lien-telechargement");

// Le token est le dernier segment de l'URL : /d/{token}
const token = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

// URL malformée (pas de token) : on désactive le formulaire d'emblée.
if (!token || token === "d") {
  formEmail.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
  msgEmail.textContent = "Lien invalide : aucun document n'est associé à cette adresse.";
  msgEmail.hidden = false;
}

formEmail.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const restaurer = UI.boutonEnChargement(btnEmail, "Vérification…");
  const chargement = UI.chargementDiffere("Vérification…");

  try {
    const reponse = await fetch("/.netlify/functions/deliver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email: champEmail.value.trim() }),
    });
    const donnees = await reponse.json();

    if (!reponse.ok) {
      UI.toast(donnees.erreur || "Une erreur est survenue.", "erreur");
      restaurer();
      return;
    }

    // Email enregistré : on affiche le téléchargement.
    bandeauSucces.innerHTML = UI.icone("valide", 18);
    const texteSucces = document.createElement("span");
    texteSucces.textContent = "Merci ! Votre document est prêt.";
    bandeauSucces.appendChild(texteSucces);

    nomDocument.textContent = "Document : " + donnees.nom;
    lienTelechargement.href = donnees.urlTelechargement;
    lienTelechargement.innerHTML = UI.icone("telecharger", 18);
    const texteBouton = document.createElement("span");
    texteBouton.textContent = "Télécharger le document";
    lienTelechargement.appendChild(texteBouton);

    sectionEmail.hidden = true;
    sectionTelechargement.hidden = false;
  } catch {
    UI.toast("Erreur réseau, réessayez.", "erreur");
    restaurer();
  } finally {
    chargement.fin();
  }
});
