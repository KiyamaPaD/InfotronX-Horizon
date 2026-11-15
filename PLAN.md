# PLAN MARS ATLAS — pentru Claude Code

> Pune fișierul ăsta în rădăcina repo-ului (`Mars-Atlas/PLAN.md`) și spune-i lui Claude Code:
> **„Citește PLAN.md și fă Etapa 1, pasul 1.1. Nu trece mai departe până nu-ți confirm.”**
> Lucrează pe câte un singur pas o dată. După fiecare pas: teste, commit mic, push, verificare pe Vercel.

---

## 0. Reguli pentru Claude Code (citește-le la fiecare sesiune)

1. Sursa de adevăr e codul din `main`. Înainte de orice, rulează `git pull --ff-only origin main` și citește fișierele relevante. Nu presupune nimic din documente vechi.
2. **Manual-first:** tot ce ține de misiuni, rute, waypointuri și observații trebuie să meargă fără AI.
3. Schimbări mici și testate. Nu atinge module care n-au legătură cu pasul curent.
4. Stil de cod: acolade **Allman**, nume de funcții naturale, expresiile scurte pe un singur rând, comentarii puține (doar matematică, sursa datelor, compromisuri).
5. După fiecare schimbare: `npm test`. Dacă e ceva de hartă, rulează și testul de browser (commit cu `[browser]` în mesaj sau workflow dispatch pe `map-browser`).
6. Nu relaxa politicile RLS din Supabase și nu rula din nou migrațiile din `local-sql/` pe proiectul live.
7. Nu pune chei, parole sau tokenuri în cod sau în commituri.
8. Nu afirma „perfect” sau „testat complet”. La finalul fiecărui pas raportează: fișiere schimbate, cauza, soluția, teste rulate, ce încă nu e verificat.
9. Textele din interfață trebuie să arate ca un produs final: fără „beta”, „TODO”, „admin side”, versiuni interne.
10. Nu prezenta nimic ca fiind certificat sau aprobat de NASA.

---

## Feedback mentor (15 nov 2026)

Mentorul Space Apps a cerut:
- verificarea calculelor de distanță → **2.7**
- verificarea instrumentelor de planificare → **2.8**
- felul în care prezentăm datele științifice → **3.2**, **3.4**
- menționarea surselor AI folosite → **3.1**, **4.7**
- un demo scurt despre cum planifică un utilizator o misiune → **4.6** (folosește misiunea demo din **4.2**)
- o prezentare pe project-showcase → **4.7**
- dacă avem timp: explicația de ce un traseu e preferabil altuia → **3.4**

Ordinea rămâne: întâi terminăm Etapa 1 (harta).

---

## ETAPA 1 — Harta (P0, obligatoriu primul)

**Scop:** harta să fie stabilă pe desktop și mobil, fără trucuri de zoom.
**Fișiere de început:** `docs/MAP_ENGINE.md`, `src/map.js`, `src/constants.js`, `src/geo.js`, `scripts/map-browser-smoke.mjs`, `DOCUMENTATIE/TESTE_HARTA.md`.

### 1.1 Extinde testul automat de browser
- Adaugă în `scripts/map-browser-smoke.mjs` scenariile:
  - cold load direct pe Viking zoom 7, apoi HiRISE zoom 8, 9, 10, 11
  - secvența rapidă 7→8→9→10→11→10→8→7 (butoane + wheel)
  - pan mare (peste 1000 px) la zoom 11 și recenter
  - viewport 375px, 768px și desktop
- Pentru fiecare scenariu salvează: număr de cereri, coduri HTTP, cereri duplicate, screenshot.
- **Gata când:** zero 404 pe nivelurile folosite, zero cereri duplicate pentru același tile, zero erori în consolă.

### 1.1b Fundalul Viking nu se mai anulează la pan
- Tile-urile Viking din fundal nu se anulează în timpul pan-ului dacă sunt încă în viewport sau în cache-ul de ~24.
- Dovadă: pe Slow 3G, testul de browser arată `net::ERR_ABORTED` urmat de o nouă cerere (`reissue-after-abort`) pentru tile-uri Viking zoom 7; în CI, la pan mare, 12 tile-uri Viking cerute de două ori.
- **Gata când:** `reissue-after-abort` = 0 pentru tile-urile Viking în toate scenariile, inclusiv Slow 3G.

### 1.2 Marginile HiRISE
- Fă un test care merge la colțurile envelope-ului HiRISE (S 18.3068, N 18.6693, W 77.2229, E 77.5840) și verifică că tile-urile cerute se intersectează cu envelope-ul.
- Distinge „lipsesc date în sursă” (PNG transparent) de „bug de poziționare”.
- Pe hartă, zona fără HiRISE să fie etichetată clar ca fundal Viking mărit.

### 1.3 Rețea slabă și erori
- Simulează Slow 3G, offline și revenire online (Playwright `route` / `context.setOffline`).
- Interfața arată un singur mesaj clar de degradare, fără pop-up-uri repetate, și se reface singură când revine rețeaua.
- Verifică că reîncercarea tile-urilor eșuate nu creează „furtuni” de cereri.

### 1.4 Mobil și touch
- Pinch zoom, pan cu degetul, drag pe waypoint fără decalaj între deget și punct.
- Butoanele de zoom și selectorul de strat să fie ușor de apăsat (minim 44×44 px).

### 1.5 Performanță
- Măsoară timpul până la prima imagine reală (nu placeholder), LCP și memoria după 2 minute de pan/zoom.
- Scrie cifrele reale în `docs/MAP_ENGINE.md`. Nu inventa cifre.

### 1.6 Indicatorul de sursă
- Pe hartă să se vadă mereu ce strat e afișat și la ce zoom real (de ex. „HiRISE 25 cm” vs „Viking mărit de la zoom 7”).
- MOLA marcat clar ca „relief umbrit, nu altitudine”.

**Criteriu final Etapa 1:** teste JS + browser trec, fără 404 sistematice, fără overlay mutat, fără request storms, încarcă fără truc de zoom, echipa aprobă vizual pe telefon și pe laptop.

---

## ETAPA 2 — Review final de produs (P0)

### 2.1 Curățenie texte în interfață
- Caută în `index.html` și `src/` toate textele vizibile cu: beta, TODO, debug, admin, build, v0., test, „doar în acest build”.
- Înlocuiește-le cu texte de produs final sau scoate-le.

### 2.2 Butoane redundante
- Fă o listă cu toate butoanele din Analytics (Overview, Terrain, Models, Mission) și Mission Center.
- Tot ce ține de salvare, încărcare, export, share să fie doar în Mission Center.

### 2.3 Accesibilitate
- Contrast text minim 4.5:1, focus vizibil pe toate butoanele, navigare din tastatură, `aria-label` pe butoanele cu iconițe.
- Testează cu Lighthouse Accessibility și scrie scorul real.

### 2.4 Test cu 2 conturi reale (îl fac oamenii, Claude Code scrie checklist-ul)
- Creează `DOCUMENTATIE/TEST_DOUA_CONTURI.md` cu pașii:
  A salvează → B nu vede → A dă „Can view” → B deschide, nu poate salva → A dă „Can edit” → B salvează → A revocă → B pierde acces → invitație pe email pending devine membru după confirmare → conflict de revizie → export de siguranță.
- Dacă apare un bug, reparația se face fără a relaxa RLS.

### 2.5 Erori și reîncărcare
- Pagina 404 pentru rute greșite, reload pe orice stare nu pierde misiunea (autosave local).
- Link-ul de share cu date în URL: avertizare scurtă că oricine are linkul vede datele.

### 2.6 Responsive general
- Toate panourile utilizabile pe 375px, fără scroll orizontal.

### 2.7 Verificarea distanțelor
- Găsește toate calculele de distanță (analytics, geo, rutare).
- Trebuie folosită raza Marte 3.396.190 m, nu a Pământului. Verifică formula (mare cerc) și unitățile.
- Teste cu valori independente: 1° latitudine ≈ 59,27 km, două puncte din Jezero, rută cu 3+ puncte = suma segmentelor.
- Dacă există distanță 3D (cu panta din DEM), interfața arată clar care e plană și care e pe teren.

### 2.8 Verificarea planificării
- A*, D* Lite și Pareto testate pe grilă mică, cu ruta corectă cunoscută dinainte.
- Recalcul corect după mutare/adăugare/ștergere de waypoint și după zonă de excluziune.
- Fără cuvântul „optim” dacă nu e dovedit; folosește „cel mai bun dintre variantele calculate”.

---

## ETAPA 3 — Verificare științifică (P1)

### 3.1 Surse
- Pagină „Surse și date” în site cu: Viking MDIM 2.1, HiRISE Jezero ortomozaic, MOLA/HRSC, CTX DTM Fergason et al. 2020 (DOI 10.5066/P906QQT8), cu linkuri.
- Menționează ajutorul AI la cod și documentație (cerință Space Apps).
- Obligatoriu: ce instrumente AI am folosit și pentru ce (cod, documentație, cercetare).

### 3.2 Etichete măsurat vs. modelat
- Fiecare cifră din Analytics să aibă una din etichetele: **Măsurat (NASA/USGS)**, **Calculat**, **Scenariu ilustrativ**, **Notă utilizator**.
- Verifică unitățile (m, grade, %), și că altitudinile sunt raportate la datum-ul Marte, nu „nivelul mării”.

### 3.3 Limitele DEM
- Când o rută iese din clipul DEM (104×96 celule), interfața spune clar „fără date de altitudine aici” în loc să calculeze ceva.
- NoData nu e tratat niciodată ca teren sigur.

### 3.4 „De ce acest traseu?”
- Panou lângă rută și în comparația de rute, generat determinist din cifre, fără AI.
- Conține: distanță, pantă medie/maximă, urcare/coborâre, cât din rută are date HiRISE/DEM vs doar Viking, zone evitate, criteriul și ponderile.
- La comparație, propoziții de tipul „B e cu 320 m mai lung, dar panta maximă scade de la 18° la 9°”, cu cifre reale.
- Fiecare cifră etichetată Măsurat / Calculat / Scenariu (vezi 3.2). Cu teste.

---

## ETAPA 4 — Predare și release (P1)

### 4.1 README pentru juriu și colegi
- Ce face aplicația în 3 propoziții, screenshot, link site, cum rulezi local, cum rulezi testele, echipa și rolurile.

### 4.2 Versiune de demo
- O misiune exemplu încărcabilă cu un click („Încarcă misiune demo”) ca juriul să vadă tot în 30 de secunde.
- Tag Git `v1.0-demo`.

### 4.3 Șabloane GitHub
- `.github/ISSUE_TEMPLATE/bug_harta.md` cu formularul de bug (layer, zoom, coordonate, browser, pași, Network, screenshot, prioritate P0/P1/P2).

### 4.4 Domeniu propriu (opțional)
- Subdomeniu de pe Hostinger (ex. `mars.infotronx.com`) legat prin CNAME la Vercel.
- După schimbare: adaugă domeniul în Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).

### 4.5 Eligibilitate Space Apps
- Verificați manual regulile oficiale despre cod scris înainte de hackathon, contributori și resurse folosite. (Asta o fac oamenii, nu Claude Code.)

### 4.6 Demo 2–3 minute
- `DOCUMENTATIE/DEMO.md` cu scenariul:
  1. harta Jezero (Viking → HiRISE zoom 10)
  2. misiune nouă cu 4–5 waypointuri spre deltă
  3. calcul rută + distanță + profil pantă
  4. zonă de evitat → recalcul → comparație + „De ce acest traseu” (3.4)
  5. observație
  6. salvare / export / share
  7. pagina de surse (3.1)
- Misiunea demo din 4.2 trebuie să permită exact scenariul ăsta.

### 4.7 Text pentru project-showcase
- 5–8 rânduri: problema, ce face aplicația, datele NASA folosite, link site, link repo, echipa, surse AI.

---

## De investigat

- Scenariul `network-nasa-503` din testul de browser: tile-ul părinte Viking zoom 5 (`5/12/45.jpg`) e cerut de două ori la ~4 ms distanță. Probabil două tile-uri copil cer același părinte ca preview, iar răspunsurile cu eroare nu ajung în cache. Mic, nu blochează nimic.
- Rezolvat: dublura de mai sus era cauza CI-ului roșu din scenariul 503; preview-urile părinte folosesc acum o singură cerere comună (commit b001177).
- Indicatorul de sursă decide acoperirea HiRISE după centrul hărții. Când vederea taie marginea acoperirii ar trebui să afișeze „HiRISE (partial)”.
- `net::ERR_BLOCKED_BY_ORB` pe URL-urile de rezervă `default/default` (HiRISE/CTX, văzut pe Slow 3G): verifică în WMTSCapabilities dacă există; dacă nu, nu le mai cerem.

---

## ETAPA 5 — Idei noi (doar după Etapele 1–4)

Ordonate după valoare / efort. Fiecare se face ca pas separat, cu teste.

| # | Idee | Ce face | Efort |
|---|------|---------|-------|
| 5.1 | Diff între checkpointuri | Arată ce s-a schimbat între două versiuni ale unei misiuni (puncte adăugate, mutate, șterse, distanță în plus/minus) | Mic |
| 5.2 | Briefing de misiune | Buton care generează un rezumat printabil/PDF: hartă, rută, distanță, pantă, observații, surse | Mic–mediu |
| 5.3 | Acoperire și încredere | Pe rută, colorează segmentele după ce date există (HiRISE + DEM / doar Viking / fără DEM) | Mediu |
| 5.4 | Istoric pe traseu | Fiecare modificare de rută salvată cu motivul scris de utilizator | Mic |
| 5.5 | Surse pe observație | La fiecare observație: ce imagine/instrument a fost folosit, link | Mic |
| 5.6 | Return-to-base ilustrativ | Calculează ruta înapoi la punctul de start cu același algoritm, marcată „ilustrativ” | Mic |
| 5.7 | Export offline | Pachet ZIP cu misiunea (JSON + GeoJSON) și tile-urile vizitate, pentru prezentare fără internet | Mediu |
| 5.8 | Profil de altitudine interactiv | Grafic sub hartă cu altitudinea pe rută, hover sincronizat cu harta | Mediu |
| 5.9 | AI Mission Copilot opțional | Doar propune, cu surse și incertitudini, nu modifică nimic fără click de confirmare; se poate dezactiva complet | Mare |
| 5.10 | Vizualizare 3D | Teren 3D din DEM-ul inclus (ex. three.js), doar pentru zona clipului | Mare |
| 5.11 | Colaborare live | Editare în timp real între conturi; doar cu protocol clar pentru conflicte | Mare |

---

## Prompturi gata de copiat în Claude Code

- `Citește PLAN.md, secțiunea 0 și Etapa 1. Apoi fă pasul 1.1. Arată-mi planul înainte să modifici cod.`
- `Rulează npm test și spune-mi ce pică, fără să repari încă nimic.`
- `Fă pasul 1.2 din PLAN.md. La final dă-mi raportul cerut în regula 8.`
- `Caută în tot proiectul textele vizibile din pasul 2.1 și dă-mi lista înainte să le schimbi.`
- `Fă commit cu un mesaj scurt și clar și push pe main, apoi verifică GitHub Actions.`
