# Algorithme de Matching d'Orientation Étudiante

## Document technique — Fondements scientifiques, calculs et justifications

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Fondements scientifiques](#2-fondements-scientifiques)
   - 2.1 [Modèle RIASEC de Holland](#21-modèle-riasec-de-holland)
   - 2.2 [Modèle Big Five (OCEAN)](#22-modèle-big-five-ocean)
   - 2.3 [Base de données O\*NET](#23-base-de-données-onet)
   - 2.4 [Approche hybride RIASEC × Big Five](#24-approche-hybride-riasec--big-five)
3. [Architecture des dimensions](#3-architecture-des-dimensions)
4. [Le quiz — conception et justification des questions](#4-le-quiz--conception-et-justification-des-questions)
5. [Pipeline de calcul](#5-pipeline-de-calcul)
   - 5.1 [Étape 1 — Scores bruts](#51-étape-1--scores-bruts)
   - 5.2 [Étape 2 — Normalisation](#52-étape-2--normalisation)
   - 5.3 [Étape 3 — Produit scalaire pondéré](#53-étape-3--produit-scalaire-pondéré)
   - 5.4 [Étape 4 — Classement et stockage](#54-étape-4--classement-et-stockage)
6. [Système de like/dislike et recalcul adaptatif](#6-système-de-likedislike-et-recalcul-adaptatif)
7. [Calcul des poids des domaines](#7-calcul-des-poids-des-domaines)
8. [Recommandation d'écoles](#8-recommandation-décoles)
9. [Propriétés mathématiques et garanties](#9-propriétés-mathématiques-et-garanties)
10. [Références](#10-références)

---

## 1. Vue d'ensemble

Le système recommande aux étudiants des **domaines professionnels**, des **métiers** et des **écoles** en fonction de leurs réponses à un quiz de 13 questions. L'algorithme repose sur un **modèle vectoriel** : le profil de l'étudiant et les profils des métiers/domaines sont représentés comme des vecteurs dans un espace à 22 dimensions, et la compatibilité est mesurée par un **produit scalaire pondéré normalisé**.

```
Étudiant  →  Quiz (13 questions)  →  Vecteur ∈ ℝ²²  →  Produit scalaire  →  % compatibilité
                                                              ↕
Métiers   →  Poids O*NET normalisés  →  Vecteur ∈ ℝ²²  ────┘
```

---

## 2. Fondements scientifiques

### 2.1 Modèle RIASEC de Holland

Le modèle RIASEC (Holland, 1959, 1997) est le cadre théorique le plus utilisé en orientation professionnelle. Il postule que les individus et les environnements de travail peuvent être caractérisés par six types :

| Code | Type | Description |
|------|------|-------------|
| **R** | Realistic | Préfère les activités physiques, concrètes, manuelles |
| **I** | Investigative | Aime analyser, chercher, comprendre |
| **A** | Artistic | Valorise la créativité, l'expression, l'originalité |
| **S** | Social | Orienté vers l'aide, l'enseignement, le contact humain |
| **E** | Enterprising | Aime diriger, persuader, entreprendre |
| **C** | Conventional | Préfère l'organisation, les procédures, la stabilité |

**Validité empirique** : le modèle RIASEC a été validé dans plus de 40 pays et fait l'objet de milliers d'études (Rounds & Tracey, 1996). Il est le fondement du Strong Interest Inventory et du Self-Directed Search.

**Limites** : les 6 types seuls ne capturent pas les traits de personnalité (résilience, coopération, rigueur) qui influencent la réussite et la satisfaction dans un métier. C'est pourquoi nous intégrons le Big Five.

### 2.2 Modèle Big Five (OCEAN)

Le modèle des cinq grands facteurs de personnalité (Costa & McCrae, 1992) est le consensus scientifique en psychologie de la personnalité :

| Facteur | Dimension O\*NET utilisée | Rôle dans l'orientation |
|---------|--------------------------|------------------------|
| **Openness** (Ouverture) | Innovation | Prédit l'attrait pour les métiers créatifs et la recherche |
| **Conscientiousness** (Conscienciosité) | Dependability | Prédit la performance et la rigueur professionnelle |
| **Extraversion** | Social Orientation | Prédit l'aisance relationnelle et le leadership |
| **Agreeableness** (Agréabilité) | Cooperation | Prédit les compétences interpersonnelles |
| **Neuroticism** (inversé → Stabilité) | Stress Tolerance | Prédit la capacité à gérer la pression |

Nous ajoutons des facettes supplémentaires issues de la catégorie **Work Styles** d'O\*NET :
- **Achievement Orientation** (motivation et ambition)
- **Self-Control** (patience et maîtrise de soi)
- **Intellectual Curiosity** (curiosité et pensée analytique)

### 2.3 Base de données O\*NET

Le **Occupational Information Network** (O\*NET) est maintenu par le Département du Travail des États-Unis. Il contient pour chaque métier (923+) des scores empiriques sur :
- **Interests** (6 dimensions RIASEC) : scores de 1 à 7, collectés par enquête auprès de professionnels en exercice
- **Work Styles** (16 dimensions de personnalité) : scores de 1 à 5, évalués par des analystes et des professionnels

Nous utilisons deux fichiers source :
- `Interests.xlsx` — 6 éléments RIASEC par métier
- `Work_Styles.xlsx` — 16 éléments de style de travail par métier

**Choix de O\*NET** : c'est la seule base de données publique au monde qui lie de manière quantitative des profils psychométriques (intérêts + personnalité) à des professions spécifiques, avec des données collectées empiriquement.

### 2.4 Approche hybride RIASEC × Big Five

La littérature récente (Larson, Rottinghaus & Borgen, 2002 ; Mount, Barrick, Scullen & Rounds, 2005) montre que combiner les intérêts professionnels (RIASEC) avec les traits de personnalité (Big Five) améliore significativement la prédiction de la satisfaction et de la performance professionnelle par rapport à l'un ou l'autre modèle seul.

Notre système fusionne les deux dans un **espace vectoriel unifié à 22 dimensions** :
- 6 dimensions RIASEC (intérêts)
- 16 dimensions Work Styles (personnalité/comportements)

Chaque métier a un vecteur de poids dans cet espace, issu directement des données O\*NET.

---

## 3. Architecture des dimensions

### Les 22 dimensions

| # | Nom de dimension | Source | Catégorie |
|---|------------------|--------|-----------|
| 1 | Realistic | O\*NET Interests | RIASEC |
| 2 | Investigative | O\*NET Interests | RIASEC |
| 3 | Artistic | O\*NET Interests | RIASEC |
| 4 | Social | O\*NET Interests | RIASEC |
| 5 | Enterprising | O\*NET Interests | RIASEC |
| 6 | Conventional | O\*NET Interests | RIASEC |
| 7 | Innovation | O\*NET Work Styles | Big Five (Openness) |
| 8 | Dependability | O\*NET Work Styles | Big Five (Conscientiousness) |
| 9 | Social Orientation | O\*NET Work Styles | Big Five (Extraversion) |
| 10 | Cooperation | O\*NET Work Styles | Big Five (Agreeableness) |
| 11 | Stress Tolerance | O\*NET Work Styles | Big Five (Neuroticism⁻¹) |
| 12 | Achievement Orientation | O\*NET Work Styles | Motivation |
| 13 | Self-Control | O\*NET Work Styles | Tempérament |
| 14 | Intellectual Curiosity | O\*NET Work Styles | Cognition |
| 15-22 | Autres Work Styles | O\*NET Work Styles | Diverses |

### Mapping quiz → dimensions

Le quiz utilise des termes en français, mappés aux noms O\*NET :

```
réaliste           → Realistic
investigateur      → Investigative
artistique         → Artistic
social             → Social
entreprenant       → Enterprising
conventionnel      → Conventional
ouverture          → Innovation
conscienciosité    → Dependability
extraversion       → Social Orientation
agréabilité        → Cooperation
stabilité_émot.    → Stress Tolerance
motivation         → Achievement Orientation
patience           → Self-Control
logique            → Intellectual Curiosity
```

Ce mapping relie chaque dimension du quiz français à la dimension O\*NET correspondante, permettant de comparer directement le profil de l'étudiant aux profils des métiers.

---

## 4. Le quiz — conception et justification des questions

### Principes de conception

1. **13 questions** : nombre suffisant pour couvrir les 14 dimensions accessibles au quiz (certaines dimensions O\*NET comme "Attention to Detail" ne sont mesurables que par observation et pas par auto-évaluation).

2. **Choix forcé** (4 à 6 options par question) : chaque option est liée à une dimension différente. L'étudiant ne choisit qu'une réponse → le score de la dimension correspondante augmente de 1. Ce format s'inspire du **ipsative measurement** utilisé dans le SDS de Holland.

3. **Questions situationnelles et projectives** : au lieu de demander "Es-tu créatif ?", on demande "Quand tu imagines ton futur métier, tu veux surtout : (A) Exprimer ta créativité...". Les questions situationnelles réduisent le biais de désirabilité sociale (Lievens & Sackett, 2012).

### Justification question par question

| # | Catégorie | Question | Ce qu'elle mesure | Justification scientifique |
|---|-----------|----------|-------------------|---------------------------|
| 1 | **Aspirations** | "Quand tu imagines ton futur métier..." | RIASEC complet | Mesure directe des intérêts vocationnels (Holland, 1997). Les 6 options couvrent les 6 types RIASEC. |
| 2 | **Satisfaction** | "Ce qui te rend le plus fier..." | Sources de satisfaction intrinsèque | Basé sur la théorie de l'auto-détermination (Deci & Ryan, 2000). Identifie si la motivation est artistique, sociale, intellectuelle ou organisationnelle. |
| 3 | **Stress** | "Ce qui te fatigue le plus..." | Tolérance au stress, besoins d'autonomie | Mesure inversée : ce qui épuise révèle les besoins non satisfaits. Fondé sur le modèle Demandes-Ressources (Bakker & Demerouti, 2007). |
| 4 | **Environnement** | "Tu supportes mal..." | Fit personne-environnement | Théorie du Person-Environment Fit (Kristof-Brown et al., 2005). Les irritants révèlent les valeurs profondes. |
| 5 | **Pression** | "Face à une forte pression..." | Coping et résilience | Distingue les profils évitants, résistants et stimulés par le stress (Lazarus & Folkman, 1984). |
| 6 | **Aversion** | "Tu te sentirais mal dans un métier où..." | Contre-indications vocationnelles | Approche par exclusion : identifier les environnements incompatibles est aussi prédictif que les préférences (Gottfredson, 1981). |
| 7 | **Vision** | "Dans 10 ans, ce qui te rendrait fier..." | Valeurs à long terme | Les objectifs à long terme sont plus stables que les intérêts immédiats (Super, 1990). |
| 8 | **Identité** | "Le mot qui te ressemble le plus..." | Auto-concept vocationnel | Mesure directe de l'identité professionnelle (Savickas, 2005). Format concis et intuitif. |
| 9 | **Engagement** | "Tu serais prêt à accepter..." | Investissement et valeurs | Mesure la volonté de sacrifice, indicateur de la force de l'intérêt vocationnel (Lent et al., 1994). |
| 10 | **Équilibre** | "Ton équilibre idéal..." | Priorités de vie | Basé sur la théorie des ancres de carrière (Schein, 1990). |
| 11 | **Critères** | "Quand tu choisis une formation..." | Facteurs de décision | Distingue motivation intrinsèque vs extrinsèque (Ryan & Deci, 2000). |
| 12 | **Durée** | "Tu serais prêt à étudier pendant..." | Tolérance à l'investissement temporel | Corrélé à Conscientiousness et Investigative (études longues → recherche). |
| 13 | **Budget** | "Le coût est-il déterminant ?" | Pragmatisme vs idéalisme | Indicateur de la dimension Conventional (sécurité) vs Openness (flexibilité). |

### Couverture dimensionnelle

Chaque dimension est accessible depuis **au moins 2 questions différentes**, garantissant qu'un score nul sur une question ne bloque pas la dimension :

| Dimension | Questions où elle apparaît comme option |
|-----------|---------------------------------------|
| Artistic | Q1, Q2, Q7, Q8, Q10 |
| Social | Q1, Q2, Q4, Q7, Q8, Q10 |
| Investigative | Q1, Q2, Q4, Q8, Q9, Q10, Q12 |
| Enterprising | Q1, Q2, Q5, Q7, Q8, Q9, Q11 |
| Conventional | Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q9, Q10, Q11, Q13 |
| Realistic | Q9, Q12 |
| Innovation (Ouverture) | Q3, Q4, Q6, Q9, Q10, Q13 |
| Dependability (Conscienciosité) | Q3, Q6, Q7, Q11, Q12 |
| Social Orientation (Extraversion) | Q5, Q6, Q13 |
| Cooperation (Agréabilité) | Q3, Q6 |
| Stress Tolerance | Q3, Q4, Q5, Q6 |
| Achievement Orientation | Q2, Q3, Q4, Q5, Q9, Q11, Q12, Q13 |
| Self-Control (Patience) | Q5 |
| Intellectual Curiosity (Logique) | — (capturée indirectement via Investigative) |

---

## 5. Pipeline de calcul

### 5.1 Étape 1 — Scores bruts

Pour chaque réponse au quiz, on incrémente le compteur de la dimension liée à l'option choisie :

$$
\text{rawScore}[d] = \sum_{q \in \text{quiz}} \mathbb{1}[\text{option choisie à } q \text{ est liée à } d]
$$

Où $d$ est un nom de dimension (ex: "Artistic", "Social").

**Exemple** : si un étudiant choisit des options liées à "Artistic" dans 3 questions sur 13, alors $\text{rawScore}[\text{Artistic}] = 3$.

### 5.2 Étape 2 — Normalisation

Le score brut est normalisé par le **nombre maximum de questions où la dimension aurait pu être choisie** (nombre de questions distinctes ayant au moins une option de cette dimension) :

$$
\text{normalizedScore}[d] = \min\left(\frac{\text{rawScore}[d]}{\text{maxPossible}[d]}, 1\right)
$$

Où :
$$
\text{maxPossible}[d] = \left|\{q \mid \exists \text{ option } o \in q \text{ telle que } o.\text{dimension} = d\}\right|
$$

Le `min(..., 1)` est un **clamp** de sécurité (le score ne peut dépasser 1.0 même en cas d'anomalie).

**Pourquoi cette normalisation ?** Sans elle, les dimensions qui apparaissent dans beaucoup de questions (comme Conventional, présent dans 11 questions) auraient un avantage structurel sur celles présentes dans peu de questions (comme Realistic, présent dans 2).

**Résultat** : un vecteur étudiant $\vec{s} \in [0, 1]^{22}$ où chaque composante représente l'affinité normalisée avec une dimension.

### 5.3 Étape 3 — Produit scalaire pondéré

La compatibilité entre un étudiant et un métier (ou domaine) est calculée par **produit scalaire pondéré** :

$$
\text{dotProduct} = \sum_{i=1}^{22} s_i \cdot w_i
$$

Où $s_i$ est le score normalisé de l'étudiant sur la dimension $i$ et $w_i$ est le poids du métier sur cette dimension (issu d'O\*NET).

**Normalisation des poids** : si la somme des poids $W = \sum w_i$ n'est pas égale à 1 (tolérance de 0.01), on divise :

$$
\text{compatibility} = \begin{cases}
\frac{\text{dotProduct}}{W} & \text{si } |W - 1| > 0.01 \\
\text{dotProduct} & \text{sinon}
\end{cases}
$$

**Conversion en pourcentage** :

$$
\text{compatibility\%} = \text{round}(\text{compatibility} \times 100, 1)
$$

**Pourquoi le produit scalaire ?** Le produit scalaire mesure la projection d'un vecteur sur un autre, ce qui représente naturellement "à quel point le profil de l'étudiant s'aligne avec le profil requis par le métier". C'est mathématiquement équivalent à une **similarité cosinus pondérée** lorsque les vecteurs sont normalisés (Salton & McGill, 1983 ; utilisé aussi dans les systèmes de recommandation modernes).

### 5.4 Étape 4 — Classement et stockage

Les résultats sont triés par compatibilité décroissante et seuls sont sauvegardés :
- **Top 5 domaines**
- **Top 10 métiers**

Ce filtrage évite de noyer l'étudiant sous trop d'options et suit les recommandations UX de l'orientation (Schwartz, 2004 — "Paradox of Choice").

---

## 6. Système de like/dislike et recalcul adaptatif

### Principe

Après avoir reçu ses recommandations, l'étudiant peut **liker** ou **disliker** des métiers. Chaque interaction ajuste son profil dimensionnel selon les poids du métier concerné, puis relance un calcul complet.

### Formule d'ajustement

Pour chaque interaction (like/dislike) sur un métier $m$ :

$$
s'_i = \text{clamp}\left(s_i + \text{sign} \times \alpha \times w_{m,i}, \; 0, \; 1\right)
$$

Où :
- $s_i$ = score normalisé original de l'étudiant (issu du quiz, pas des ajustements précédents)
- $\text{sign} = +1$ si like, $-1$ si dislike
- $\alpha = 0.15$ = facteur d'ajustement
- $w_{m,i}$ = poids du métier $m$ sur la dimension $i$
- $\text{clamp}(x, 0, 1) = \max(0, \min(1, x))$

### Choix de α = 0.15

Le facteur $\alpha = 0.15$ a été choisi pour que :
- Un like sur un métier dont le poids maximal est ~0.15 (typique O\*NET normalisé) produise un ajustement de ~0.0225 (2.25% d'impact maximal par dimension)
- Plusieurs likes convergents s'accumulent mais ne peuvent pas dominer le profil quiz (il faudrait ~7 likes convergents pour décaler une dimension de 0 à 1)
- L'étudiant garde le contrôle : le quiz reste la source principale, les interactions affinent

### Propriété importante

Les ajustements repartent toujours des **scores quiz originaux** (table `StudentDimension`), pas d'un ajustement précédent. Cela évite la dérive (drift) et garantit la reproductibilité :

```
scoreAjusté = scoreQuiz + Σ(interactions)   // toujours additif depuis la base
```

---

## 7. Calcul des poids des domaines

Chaque domaine contient 1 à 5 métiers. Les poids du domaine sont calculés comme la **moyenne des poids normalisés de ses métiers**, re-normalisée :

$$
\bar{w}_{d,i} = \frac{1}{|M_d|} \sum_{m \in M_d} w_{m,i}
$$

Puis :

$$
w_{d,i}^{\text{final}} = \frac{\bar{w}_{d,i}}{\sum_j \bar{w}_{d,j}}
$$

Cela signifie que le profil dimensionnel d'un domaine reflète le "centre de gravité" de ses métiers.

**Exemple** : le domaine "Informatique & Numérique" contient Développeur, Data Scientist, Analyste cybersécurité, Analyste systèmes et DSI. Son poids sur "Investigative" sera la moyenne des poids Investigative de ces 5 métiers.

---

## 8. Recommandation d'écoles

Les écoles sont recommandées via une relation **École ↔ Domaine** :

1. Récupérer les résultats domaine de l'étudiant (top 5)
2. Trouver toutes les écoles liées à ces domaines (table `SchoolDomain`)
3. Pour chaque école, calculer le **meilleur match** = max de compatibilité parmi ses domaines liés
4. Trier par meilleur match décroissant

$$
\text{bestMatch}(\text{école}) = \max_{d \in \text{domaines}(\text{école})} \text{compatibility}(d)
$$

---

## 9. Propriétés mathématiques et garanties

| Propriété | Garantie |
|-----------|----------|
| **Bornes** | Tous les scores ∈ [0%, 100%] |
| **Normalisation** | Les poids de chaque métier/domaine somment à 1 |
| **Idempotence** | Refaire le quiz avec les mêmes réponses → même résultat |
| **Reset propre** | Chaque calcul supprime les anciennes données avant d'écrire |
| **Clamp** | Aucun score ne peut dépasser [0, 1] avant % |
| **Pas de division par zéro** | `maxPossible` minimum = 1 ; `weightSum` vérifié > 0 |
| **Pas de drift** | Les ajustements like/dislike repartent des scores quiz |
| **Déterminisme** | Même entrée → même sortie (pas de composante aléatoire) |

### Complexité

- **Quiz** : $O(Q)$ où $Q$ = nombre de questions (13)
- **Matching** : $O(D \cdot K + M \cdot K)$ où $D$ = domaines (10), $M$ = métiers (20), $K$ = dimensions (22)
- **Recalcul interactions** : $O(I \cdot K + D \cdot K + M \cdot K)$ où $I$ = nombre d'interactions

Le tout est **linéaire** et s'exécute en < 100ms.

---

## 10. Références

1. **Holland, J. L.** (1997). *Making Vocational Choices: A Theory of Vocational Personalities and Work Environments* (3rd ed.). Psychological Assessment Resources.

2. **Costa, P. T., & McCrae, R. R.** (1992). *Revised NEO Personality Inventory (NEO-PI-R) and NEO Five-Factor Inventory (NEO-FFI) Professional Manual*. Psychological Assessment Resources.

3. **Rounds, J., & Tracey, T. J.** (1996). Cross-cultural structural equivalence of RIASEC models and measures. *Journal of Counseling Psychology*, 43(3), 310–329.

4. **Larson, L. M., Rottinghaus, P. J., & Borgen, F. H.** (2002). Meta-analyses of Big Six interests and Big Five personality factors. *Journal of Vocational Behavior*, 61(2), 217–239.

5. **Mount, M. K., Barrick, M. R., Scullen, S. M., & Rounds, J.** (2005). Higher-order dimensions of the Big Five personality traits and the Big Six vocational interest types. *Personnel Psychology*, 58(2), 447–478.

6. **Kristof-Brown, A. L., Zimmerman, R. D., & Johnson, E. C.** (2005). Consequences of individuals' fit at work: A meta-analysis. *Personnel Psychology*, 58(2), 281–342.

7. **Bakker, A. B., & Demerouti, E.** (2007). The Job Demands-Resources model: State of the art. *Journal of Managerial Psychology*, 22(3), 309–328.

8. **Deci, E. L., & Ryan, R. M.** (2000). The "what" and "why" of goal pursuits: Human needs and the self-determination of behavior. *Psychological Inquiry*, 11(4), 227–268.

9. **Savickas, M. L.** (2005). The theory and practice of career construction. In S. D. Brown & R. W. Lent (Eds.), *Career Development and Counseling* (pp. 42–70). Wiley.

10. **Gottfredson, L. S.** (1981). Circumscription and compromise: A developmental theory of occupational aspirations. *Journal of Counseling Psychology*, 28(6), 545–579.

11. **Lent, R. W., Brown, S. D., & Hackett, G.** (1994). Toward a unifying social cognitive theory of career and academic interest, choice, and performance. *Journal of Vocational Behavior*, 45(1), 79–122.

12. **Schein, E. H.** (1990). *Career Anchors: Discovering Your Real Values*. Pfeiffer.

13. **Super, D. E.** (1990). A life-span, life-space approach to career development. In D. Brown & L. Brooks (Eds.), *Career Choice and Development* (2nd ed., pp. 197–261). Jossey-Bass.

14. **Lievens, F., & Sackett, P. R.** (2012). The validity of interpersonal skills assessment via situational judgment tests for predicting academic success and job performance. *Journal of Applied Psychology*, 97(2), 460–468.

15. **Salton, G., & McGill, M. J.** (1983). *Introduction to Modern Information Retrieval*. McGraw-Hill.

16. **Schwartz, B.** (2004). *The Paradox of Choice: Why More Is Less*. Ecco.

17. **O\*NET Resource Center** — U.S. Department of Labor. https://www.onetcenter.org/

---

*Document généré pour le projet EIP Matching — Epitech.*
