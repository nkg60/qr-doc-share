// Logique de l'écran de connexion (index.html).
// Le code saisi est envoyé à la fonction auth pour vérification côté serveur ;
// une fois validé, l'utilisateur atterrit sur sa page principale « Mes
// documents ». Le dictionnaire ACCESS_CODES n'existe QUE côté serveur.

// Marque (icône + nom)
document.getElementById("marque").innerHTML =
  UI.icone("qrcode", 28) + "<span>qr-doc-share</span>";

// Déjà connecté dans cette session ? Direction « Mes documents ».
if (sessionStorage.getItem("codeAcces")) {
  location.replace("/mes-documents.html");
}

const formCode = document.getElementById("form-code");
const champCode = document.getElementById("champ-code");
const btnCode = document.getElementById("btn-code");

formCode.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const restaurer = UI.boutonEnChargement(btnCode, "Vérification…");
  const chargement = UI.chargementDiffere("Vérification du code…");

  try {
    const reponse = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: champCode.value.trim() }),
    });
    const donnees = await reponse.json();

    if (donnees.valide) {
      sessionStorage.setItem("codeAcces", champCode.value.trim());
      sessionStorage.setItem("labelUtilisateur", donnees.label || "");
      sessionStorage.setItem("isAdmin", donnees.isAdmin === true ? "1" : "");
      UI.toast("Code d'accès validé", "succes");
      // Petite pause pour laisser voir le toast, puis page principale.
      setTimeout(() => location.replace("/mes-documents.html"), 350);
    } else {
      UI.toast("Code invalide", "erreur");
      champCode.select();
      restaurer();
    }
  } catch {
    UI.toast("Erreur réseau, réessayez.", "erreur");
    restaurer();
  } finally {
    chargement.fin();
  }
});
