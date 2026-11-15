# Demo de 2–3 minute: cum planifică un utilizator o misiune

Site: https://mars-atlas-mu.vercel.app. Deschideți-l înainte, pe un laptop cu internet bun, ca imaginile NASA să fie deja în cache.

| Timp | Ce faci | Ce spui |
|---|---|---|
| 0:00 | Pagina se deschide pe Jezero, strat Viking, zoom 7. Arată indicatorul de sursă („Viking · z7”). | „Mars Atlas e un spațiu de planificare pentru Jezero, construit pe imagini NASA reale. Indicatorul arată mereu ce date vezi și la ce zoom.” |
| 0:15 | Alege **HiRISE Jezero** și mergi la zoom 10. Indicatorul devine „HiRISE 25 cm · z10”. | „Acum vedem ortomozaicul HiRISE. Unde HiRISE nu are date, harta spune cinstit «Viking upscaled».” |
| 0:35 | **+ New mission**, apoi modul **Draw**: pune 4–5 waypointuri de la zona de aterizare spre deltă. | „Utilizatorul decide traseul. Nimic nu e pus automat.” |
| 1:00 | Arată distanța rutei și deschide **Analytics → Terrain**: încarcă DEM-ul și arată profilul de altitudine și pantă. | „Distanța e calculată pe sfera lui Marte, cu raza de 3.396.190 m. Altitudinile vin din DEM-ul CTX publicat de USGS.” |
| 1:30 | Adaugă o zonă de evitat, recalculează și deschide comparația de rute. | „Algoritmul recalculează, iar comparația arată ce câștigăm și ce pierdem.” |
| 1:55 | Modul **Note**: pune o observație pe hartă. | „Observațiile rămân legate de coordonate.” |
| 2:10 | **Mission Center**: salvează, exportă JSON/GeoJSON, arată share. | „Misiunea se poate salva, exporta și partaja cu echipa, cu drepturi de vizualizare sau editare.” |
| 2:30 | Deschide pagina de surse / `docs/AI_USE_AND_SOURCES.md`. | „Toate datele au sursă NASA/USGS, iar ajutorul AI la cod e declarat.” |

**Varianta rapidă:** butonul **Open Jezero example mission** din panoul din stânga deschide o misiune exemplu, separat de misiunile voastre.

**Dacă pică internetul:** apare bannerul „No connection · showing imagery already loaded”. Spuneți că harta se reface singură când revine rețeaua. Asta e o funcție, nu o eroare.

**Notă pentru echipă:** pasul 3.4 („De ce acest traseu?”) nu e încă implementat. Până atunci, la 1:30 arătați comparația de rute existentă.
