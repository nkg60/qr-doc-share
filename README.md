# Partage de documents par QR code

Petite application web pour partager un document via un QR code, en collectant
l'email de chaque personne qui le récupère.

**Parcours :**
1. Sur la page d'accueil, saisir le **code d'accès à 6 chiffres** (vérifié
   uniquement côté serveur — il n'apparaît jamais dans le frontend).
2. Importer un fichier (image, PDF…). L'application génère un **QR code**
   pointant vers la page publique `/d/{token}` (aperçu, export PNG, copie d'URL).
3. La personne qui scanne le QR code arrive sur `/d/{token}`, saisit son
   **email**, puis télécharge le document (V1 : pas d'envoi d'email).
4. Les emails collectés sont consultables et exportables en CSV depuis la
   page d'accueil (après saisie du code).

## Stack

- **Frontend** : HTML/CSS/JavaScript statique, sans framework ni build
  (la librairie [qrcode](https://github.com/soldair/node-qrcode) est vendue
  dans `public/js/vendor/`).
- **Backend** : Netlify Functions (`netlify/functions/`).
- **Stockage** : Netlify Blobs uniquement (`@netlify/blobs`) :
  - store `docs` : les fichiers, clé = token aléatoire, métadonnées = nom
    d'origine, taille en octets, date, type MIME ;
  - store `scans` : les emails collectés (token du document, email, date,
    user-agent).

## Arborescence

```
netlify/functions/
  _lib/utils.mjs   Utilitaires partagés (vérification du code, réponses JSON)
  auth.mjs         Vérifie le code d'accès (POST {code} -> {valide})
  upload.mjs       Reçoit un fichier, contrôle le quota, renvoie /d/{token}
  deliver.mjs      Enregistre l'email du visiteur, renvoie l'URL de téléchargement
  download.mjs     Sert le fichier (route /download/{token})
  scans.mjs        Liste/exporte les emails collectés (JSON ou CSV)
public/
  index.html       Page « Importer » (accueil)
  d.html           Page publique servie sur /d/{token} (réécriture netlify.toml)
  css/style.css    Style commun
  js/app.js        Logique de la page d'accueil
  js/landing.js    Logique de la page publique
  js/vendor/       Bundle navigateur qrcode
```

## Variables d'environnement

Voir `.env.example` :

| Variable          | Rôle                                                        |
|-------------------|-------------------------------------------------------------|
| `ACCESS_CODE`     | Code à 6 chiffres exigé pour importer (vérifié côté serveur) |
| `MAX_TOTAL_BYTES` | Quota global de stockage en octets (ex. `104857600` = 100 Mo) |

## Développement local

```bash
npm install
cp .env.example .env   # puis ajustez les valeurs
npm run dev            # lance netlify dev sur http://localhost:8888
```

`netlify dev` émule les fonctions, les redirections et Netlify Blobs en local.

## Déploiement

1. Connectez le CLI si nécessaire : `npx netlify login`.
2. Initialisez et liez le site au dépôt GitHub : `npx netlify init`
   (choisir l'équipe, le nom du site ; build command vide, publish `public`).
3. Définissez les variables d'environnement **avant** le premier usage :
   ```bash
   npx netlify env:set ACCESS_CODE 123456
   npx netlify env:set MAX_TOTAL_BYTES 104857600
   ```
   (ou dans l'interface Netlify : *Site configuration → Environment variables*).
4. Déployez en production : `npx netlify deploy --prod` — ou poussez sur la
   branche `main` si le site est lié au dépôt Git (déploiement automatique).
