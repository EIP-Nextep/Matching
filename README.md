# Nextep - Matching Microservice

## 🎯 Rôle et Fonctionnement
Ce microservice joue un rôle critique dans la plateforme Nextep. Son workflow global est le suivant :
1. **Réception du dataset** : Réception des données issues du questionnaire utilisateur.
2. **Matching des domaines** : Lancement de l'algorithme d'analyse pour faire correspondre les aspirations de l'étudiant avec les domaines d'études.
3. **Appel Interne HTTP** : Soumission d'une requête au microservice externe `School-Catalog` pour récupérer les informations sur les écoles associées aux domaines identifiés.
4. **Recommandation Finale** : Consolidation des données et renvoi de la recommandation d'écoles à l'API Gateway.

> [!WARNING]
> **Note Architecturale** : Actuellement, le service NestJS agit comme un **orchestrateur**. L'algorithme lourd de traitement des données et de classification sera développé ultérieurement dans un **service Python dédié**. Ce microservice de Matching se chargera de s'interfacer avec le service Python pour s'occuper de ce traitement intensif en arrière-plan.

## 🚀 Démarrage Rapide

### Prérequis
- Node.js (v18+)
- npm

### Installation
Pour installer les dépendances du projet :
```bash
npm install
```

### Lancement en mode développement
Pour lancer le serveur avec un rechargement à chaud :
```bash
npm run start:dev
```

> Par défaut, l'application écoute sur le port **3003**, mais il peut être surchargé via la variable d'environnement `PORT`.
