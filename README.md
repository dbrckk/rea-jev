# REA × Jev — interface web gratuite

Interface web pour importer un APK, EXE, DLL, archive, etc., saisir une consigne et obtenir un rapport d'inspection, sans Termux ni installation Android.

## Mode gratuit par défaut

- **REA 6.5.0 (MIT)** exécute des analyses statiques réelles via sa CLI.
- Le routage des commandes est **déterministe** par défaut (type de fichier et demande), sans appel payant.
- **OpenJev (Codiv)** est facultatif : si le serveur dispose d'une clé gratuite `CODIV_API_KEY`, il priorise les analyses et DiffusionGemma fournit une interprétation séparée des preuves. Codiv annonce 100 M tokens gratuits pour les décisions et 10 M pour la génération. Ce modèle n'est **pas** le Jev propriétaire de TypeSafe.
- Le rapport Markdown rassemble résultats, empreinte SHA-256, preuves, erreurs et limites.
- **Attention : le vrai Jev de TypeSafe n'est pas inclus dans le mode gratuit.** Il est propriétaire et facturé par API. Il sert à classifier et choisir, **pas** à créer du texte ou conduire une enquête autonome.
- L'ancien mode agent Claude + plugin REA–Jev reste disponible en option pour une installation privée, mais **n'est pas utilisé par défaut**.

## Utilisation depuis Android

Après déploiement du site sur Render, ouvrir l'URL HTTPS dans le navigateur, saisir le jeton privé une première fois si demandé, puis sélectionner un fichier, décrire la recherche et lancer. Aucun terminal ni programme local n'est requis.

Les tâches peuvent être annulées et le rapport est téléchargeable. **Les fichiers sont temporairement stockés sur le serveur** et disparaissent après redémarrage ou déploiement sur l'offre gratuite Render. Télécharger immédiatement les rapports. **Ne pas importer des fichiers confidentiels sur une instance hébergée sans évaluation de sécurité préalable.**

## Déploiement gratuit Render

Le dépôt comprend un `render.yaml` pour le déploiement Blueprint. Sur Render : `New > Blueprint`, sélectionner `dbrckk/rea-jev`, plan `Free`, valider le service. Le plan Free s'endort après 15 minutes d'inactivité, utilise 512 Mo de RAM, et a des quotas mensuels. Les très grands fichiers et certaines inspections dépassent les limites. Aucune facturation n'est nécessaire tant qu'aucune offre payante n'est activée. Vérifier les modalités actuelles sur https://render.com/docs/free.

Définir le jeton `REA_JEV_TOKEN` (20 caractères minimum) dans l'étape Blueprint de Render, puis le saisir une seule fois dans l'interface. Facultativement, ajouter `CODIV_API_KEY` en tant que secret Render après la création d'un compte gratuit sur https://codiv.ai/ ; aucun jeton IA n'est ensuite à renseigner dans le navigateur. Le site ne doit **jamais** être exposé sans protection.

## Exécution sur un serveur existant (optionnel, aucune installation sur Android)

Node 24.15+ :

```bash
git clone https://github.com/dbrckk/rea-jev.git
cd rea-jev
npm install
export REA_JEV_TOKEN="$(openssl rand -hex 24)"
REA_JEV_HOST=0.0.0.0 npm start
```

Le moteur est `REA_JEV_ENGINE=free` par défaut. Il ne requiert ni `TYPESAFE_API_KEY`, ni `OPENROUTER_API_KEY`, ni `ANTHROPIC_API_KEY`. Le fichier est stocké par défaut dans `~/.rea-jev-gui` ; ajuster `REA_JEV_DATA_DIR`.

Les extensions et en-têtes connus déclenchent notamment `inspect-signature`, `inspect-pe-imports`, `inspect-elf-notes`, `inspect-sqlite-database`, `inspect-model-artifact` ou `inspect-artifact`. Chaque résultat provient réellement de la CLI ; lorsqu'une commande REA ne prend pas en charge un fichier, cela apparaît explicitement comme **non vérifié**.

**Précautions :** aucun fichier fourni n'est volontairement exécuté ; les analyseurs lisent néanmoins un contenu non fiable. Pour Ghidra/JADX (décompilation profonde), un serveur mieux doté et isolé est nécessaire. Le plan Render gratuit ne peut pas promettre une investigation approfondie de toute application. L'authentification par jeton n'est pas une sandbox et les ressources CPU/stockage sont limitées.

## Développement

```bash
npm install
npm run check
npm test
```

Références : [REA](https://github.com/morluto/rea), [plugin REA–Jev](https://github.com/juan-viox/rea-jev), [prix Jev](https://typesafe.ai/), [Render Free](https://render.com/docs/free).
