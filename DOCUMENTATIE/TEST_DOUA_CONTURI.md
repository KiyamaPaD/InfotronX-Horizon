# Test cu două conturi reale (pasul 2.4)

Îl fac doi oameni, fiecare cu contul lui, pe https://mars-atlas-mu.vercel.app. **A** e proprietarul misiunii, **B** e colegul. Folosiți browsere diferite (sau unul în fereastră privată) ca sesiunile să nu se amestece.

Bifați fiecare pas. La orice „NU”, faceți screenshot, notați ora și deschideți un bug cu șablonul `bug_harta.md` sau `bug_report.md`.

**Regulă:** un bug găsit aici se repară fără a relaxa politicile RLS din Supabase.

| # | Cine | Pas | Rezultat așteptat | OK? |
|---|---|---|---|---|
| 1 | A | Se loghează, creează o misiune nouă cu 3 waypointuri și o salvează în cloud | Misiunea apare în Mission Center la A | ☐ |
| 2 | B | Se loghează și caută misiunea lui A | B **nu** vede misiunea | ☐ |
| 3 | A | Din Mission Center îi dă lui B acces **Can view** (după email) | Invitația apare la A | ☐ |
| 4 | B | Deschide misiunea | O vede, dar butonul de salvare e blocat sau salvarea e refuzată | ☐ |
| 5 | A | Schimbă accesul lui B în **Can edit** | Rolul se schimbă la A | ☐ |
| 6 | B | Mută un waypoint și salvează | Salvarea reușește; A vede modificarea după reîncărcare | ☐ |
| 7 | A | Revocă accesul lui B | B dispare din lista de membri | ☐ |
| 8 | B | Reîncarcă pagina și încearcă să deschidă misiunea | B pierde accesul (nu o mai vede / eroare de permisiune) | ☐ |
| 9 | A | Invită un email care **nu are încă cont** | Invitația apare ca „Pending” | ☐ |
| 10 | Persoana invitată | Își face cont cu acel email și confirmă | Invitația devine membru cu rolul dat | ☐ |
| 11 | A și B (Can edit) | Deschid aceeași misiune; A salvează, apoi B salvează fără să reîncarce | B primește avertisment de conflict de revizie; nimic nu se pierde în tăcere | ☐ |
| 12 | A | Exportă misiunea (JSON și GeoJSON) din Mission Center | Fișierele se descarcă și se pot reimporta | ☐ |

Data testului: ________  Testat de A: ________  B: ________  Browser/telefon: ________
