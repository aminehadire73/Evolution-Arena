# Evolution Arena

Prototype de jeu 3D low-poly multijoueur jouable dans un navigateur.

## Fonctionnalités
- Multijoueur via WebSocket, prévu pour 20 joueurs simultanés.
- Pseudo choisi avant la partie.
- Spawn joueur avec 5 secondes d'invincibilité et invisibilité.
- Mort = retour immédiat au spawn en ver de terre niveau 1.
- Progression de 20 animaux : ver de terre → fourmi → scarabée → souris → lapin → hérisson → renard → sanglier → cerf → loup → hyène → léopard → lion → tigre → ours → gorille → buffle → hippopotame → rhinocéros → éléphant.
- Zones de puissance progressive.
- Mobs contrôlés par le serveur, capables d'attaquer.
- Plantes/mobs des deux premiers niveaux inoffensifs et sans XP.
- Classement uniquement des joueurs réels.
- HUD niveau, PV, XP et puissance.
- Attaque au clic ou à Espace.
- Sons d'attaque et ambiance générés avec Web Audio, sans fichiers audio externes.
- Monde ouvert low-poly avec arbres, rochers et zones colorées.

## Lancer en local

Nécessite Node.js 18+.

```bash
npm install
npm start
```

Puis ouvre `http://localhost:3000`.

Pour tester le multijoueur localement, ouvre plusieurs onglets/fenêtres du navigateur.

## Mise en ligne
Déploie ce projet sur un hébergeur Node.js qui autorise les WebSockets. Le serveur expose automatiquement le dossier `public/`.

## Contrôles
- ZQSD / WASD : déplacement
- Souris : rotation de la caméra (cliquer dans le jeu pour capturer la souris)
- Clic gauche ou Espace : attaque

## Note
C'est une base jouable/prototype. Pour un jeu commercial complet, il faudrait notamment ajouter une vraie interpolation réseau, matchmaking/rooms, anti-triche, persistance, équilibrage, animations, modèles 3D plus détaillés, effets, sons enregistrés et optimisation serveur.
