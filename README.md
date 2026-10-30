# Blom Doelgroepoverzicht 2026

Enquête per label en segment voor de Blom doelgroepmodellen, met A3-posters per label.

* **Enquête:** https://blominteriors.github.io/doelgroepoverzicht/
* **Opslag:** een afgeschermde Google Sheet ("Blom Doelgroepoverzicht 2026 – antwoorden"), via een Apps Script.

Iedere invuller krijgt een persoonlijke link met een eigen wachtwoord. Invullers zien alleen hun eigen antwoorden en posters; beheerders zien alles.

## Hoe het in elkaar zit

| Bestand | Wat het doet |
| --- | --- |
| `index.html` | De enquête en de dashboards (de pagina die iedereen opent). |
| `config.js` | Het webadres van het Apps Script. |
| `apps-script/Code.gs` | Het script in de Google Sheet dat wachtwoorden controleert en antwoorden opslaat. |
| `migratie/testdata.json` | Eenmalige overzetting van de testpersonen uit de eerdere versie. Mag weg na de import. |

In deze repository staan geen wachtwoorden en geen antwoorden. Die staan alleen in de Google Sheet.

## Eenmalig instellen

1. Open de Google Sheet, kies **Extensies > Apps Script**.
2. Vervang de inhoud van `Code.gs` door de inhoud van `apps-script/Code.gs` en sla op.
3. Kies bovenaan de functie `importeerOudeAntwoorden` en klik op **Uitvoeren** (geef toestemming als Google daarom vraagt).
4. Klik op **Implementeren > Nieuwe implementatie**, type **Web-app**:
   * Uitvoeren als: **Ik**
   * Wie heeft toegang: **Iedereen**
5. Kopieer de web-app-URL (eindigt op `/exec`) en zet die in `config.js`.

## Beheer

* **Iemand toevoegen:** voeg in de Sheet op het tabblad *Toegang* een rij toe met naam, wachtwoord en rol (`beheerder` of `invuller`). De persoonlijke link staat in kolom D. Zet de naam ook in de namenlijst (dat doet een beheerder in de enquête zelf).
* **Wachtwoord intrekken:** wijzig of wis het wachtwoord in het tabblad *Toegang*.
* **Segmenten:** beheerders voegen die toe met de knop **+ Segment** in de enquête.
* **Script aangepast?** Kies in Apps Script **Implementeren > Implementaties beheren**, bewerk de bestaande implementatie en kies **Nieuwe versie**. Dan blijft de URL hetzelfde.
