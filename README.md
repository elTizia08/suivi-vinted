# Suivi Vinted – dropshipping Shein

Tableau de bord pour suivre des ventes Vinted fournies par Shein : stock, commandes, bordereaux, marges, DAC7 et URSSAF.

100 % statique (HTML / CSS / JS), sans serveur ni dépendance.
Les données restent dans **ton navigateur** (localStorage + IndexedDB pour les bordereaux).

## Mettre en ligne sur GitHub Pages

1. Crée un dépôt GitHub (par ex. `suivi-vinted`).
2. Ajoute les 4 fichiers : `index.html`, `style.css`, `app.js`, `README.md`.
3. Dépôt → **Settings → Pages** → Source : `Deploy from a branch` → branche `main`, dossier `/ (root)` → Save.
4. Ton dashboard sera sur `https://TON-PSEUDO.github.io/suivi-vinted/`.

En local : ouvre simplement `index.html` dans ton navigateur.

## Fonctions

- À faire aujourd'hui : commandes à passer, colis à expédier, paiements à marquer, alertes de stock et de prix Shein
- Tableau de bord : dépensé, encaissé, solde, marge à venir
- À commander → création d'une commande Shein (coût réparti sur les articles)
- Commandes Shein, Bordereaux (PDF/images, rattachés à une vente)
- Stock avec seuil d'annonces en ligne, Publier (titre/description auto + copier), Articles & fiches
- Stats & compta : graphique de l'argent dans le temps, bilan, DAC7 (30 ventes / 2 000 €), URSSAF mensuel, export CSV, sauvegarde JSON

## Limites

- Pas de synchronisation automatique avec Vinted ni Shein (pas d'API publique, et leurs conditions d'utilisation interdisent le scraping). Les statuts se mettent à jour à la main.
- Les données sont liées au navigateur et au domaine : fais des sauvegardes JSON régulières.
- Les chiffres fiscaux sont indicatifs ; vérifie les taux et seuils sur urssaf.fr.
