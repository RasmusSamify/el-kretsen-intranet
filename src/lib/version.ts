/**
 * ELvis Hub · version & changelog
 *
 * Semantic versioning:
 *   MAJOR.MINOR.PATCH
 *   - MAJOR: breaking changes eller stora nya kapitel
 *   - MINOR: nya funktioner bakåt-kompatibla
 *   - PATCH: buggfixar, textjusteringar, finputsning
 */

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
  highlights: string[];
}

export const CURRENT_VERSION = '1.4.1';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.1',
    date: '2026-04-22',
    title: 'Mail-assistenten får feedback-knappar och syns i insikter',
    summary:
      'Ni kan nu ge tumme-upp eller tumme-ner på varje mail-svar som AI:n genererar, och insikter-sidan visar hur mycket mail-assistenten används och vad ni tycker om svaren.',
    highlights: [
      'Tumme-upp / tumme-ner under varje genererat mail-svar — ett klick räcker för att tala om ifall svaret var användbart.',
      'Vid tumme-ner öppnas en valfri kommentar-ruta så ni kan skriva i klartext vad som saknades eller var fel. Hjälper oss förbättra AI:n över tid.',
      'Insikter-sidan har nu en egen rad för mail-assistenten: hur många svar som genererats senaste 7 dagarna, hur många positiva och negativa röster som kommit in.',
      'Andelen positiva svar visas som procent — ni ser direkt om kvaliteten håller bra nivå eller om något behöver granskas.',
      'Varje mail-svar som genereras loggas nu (ingen persondata — bara språk, tidstämpel, längd och antal källor som användes) så vi kan följa utvecklingen.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-04-22',
    title: 'Renare kunskapsbas och bättre kontroll över era källor',
    summary:
      'Vi har städat bort skräp från webbsidor i kunskapsbasen, förbättrat granskningsfliken så den bara visar riktiga motsägelser, och lagt grunden för att hantera när lagar ersätts eller interna dokument redigeras.',
    highlights: [
      'Granskningsfliken visar nu bara ÄKTA motsägelser — tidigare flaggades olika stycken i samma dokument som motsägelser (t.ex. när en lag listade olika datum för olika batterityper). Systemet jämför nu bara mellan OLIKA dokument, vilket är där verkliga konflikter finns.',
      'Ny "Drift · Intern vs lag"-markering — när en intern instruktion säger något annat än lagtexten får den en gul flagga i Granskning. Det är den här typen av konflikt El-kretsen verkligen behöver fånga innan den påverkar svar.',
      'Städat bort 162 textbitar med skräpkod från webb-källorna — gamla SVG-fragment, "Skriv ut"-knappar, sidfotsnavigering och paginering. Citaten i ELvis-svaren blir renare och mer läsbara.',
      'ELvis respekterar nu "giltigt till"-datum — om ni markerar att en lag eller intern instruktion upphörde gälla ett visst datum, kommer ELvis sluta använda den från och med då. Förhindrar att utgången information påverkar svar.',
      'Alla redigeringar av interna dokument sparas i historik — varje gång ni ändrar ett internt dokument sparas föregående version. Compliance-säkerhet: man kan alltid visa "vad stod det 1 mars 2026?".',
      'Ny bakgrundsfunktion bevakar URL-källor — systemet kan nu jämföra hur el-kretsen.se (eller riksdagen.se, eur-lex.europa.eu m.fl.) ser ut just nu mot vad som finns indexerat i kunskapsbasen. Om sidan ändrats flaggas den för granskning.',
      'Versionsrutan öppnas nu som en riktig popup i mitten av skärmen (inte trycks ihop i sidomenyn).',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04-21',
    title: 'ELvis hittar rätt svar ännu bättre',
    summary:
      'Vi förbättrade hur ELvis söker i kunskapsbasen så att exakta termer som produktkoder, paragrafnummer och lagbeteckningar alltid fångas upp. Plus att källhänvisningar nu pekar ut den mest relevanta meningen.',
    highlights: [
      'Produktkoder som "B74" och paragrafer som "§ 12" hittas nu tillförlitligt — tidigare kunde exakta sökord ibland missas även om de fanns i kunskapsbasen.',
      'ELvis vet nu alltid vilket dokument varje textstycke tillhör, vilket hjälper AI:n att skilja mellan liknande text i olika lagar (t.ex. producentansvar i två olika förordningar).',
      'När du klickar på en källhänvisning markeras den mest relevanta meningen i gult — så du ser direkt var i dokumentet svaret kommer ifrån.',
      'Källhänvisningen visar som standard bara några få rader runt det viktiga — du kan expandera till hela stycket när du vill.',
      'Om frågan är otydlig ställer ELvis nu klargörande motfrågor istället för att gissa. Exempel: "För mobiltelefon — gäller frågan själva telefonen eller batteriet inuti?"',
      'Hårdare regler mot påhittade svar: ELvis citerar nu siffror, datum och procedurer ordagrant istället för att omformulera.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-04-21',
    title: 'Administratörer kan nu hantera kunskapsbasen direkt',
    summary:
      'Utvalda personer kan redigera och ta bort källor från kunskapsbasen utan att behöva kontakta Samify. ELvis börjar omedelbart använda den uppdaterade informationen.',
    highlights: [
      'Administratörer ser nu en "Admin"-markering i Kunskapsbas-fliken.',
      'Hovra över en intern källa → klicka pennan → redigera texten direkt i en ruta → klicka Spara. ELvis använder den nya versionen omedelbart.',
      'Röd papperskorg tar bort en källa helt. Kräver att man skriver "TA BORT" för att bekräfta — förhindrar misstag.',
      'Gäller bara interna dokument som ni själva laddat upp. Hämtade webbsidor (t.ex. från riksdagen.se) kan raderas men inte redigeras — de tillhör originalkällan.',
      'Administratörer styrs av en e-postlista. Den som har behörighet kan ändras utan att Samify behöver göra något.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-21',
    title: 'Ny granskningssida som hittar motsägelser automatiskt',
    summary:
      'AI:n jämför kontinuerligt alla textstycken i kunskapsbasen mot varandra och flaggar när två säger emot varandra — olika datum, olika belopp, olika regler. Ni slipper leta fel manuellt.',
    highlights: [
      'Ny flik "Granskning" i sidomenyn som listar alla motsägelser ELvis hittat.',
      'Varje motsägelse får ett allvarlighetsbetyg från 1 (marginell formulering) till 5 (direkt motstridiga lagkrav).',
      'AI:n skriver i klartext varför två stycken motsäger varandra, så ni vet exakt vad som behöver granskas.',
      'Knappar för "Åtgärdad" eller "Ignorera" per ärende — håller listan ren över tid.',
      'Systemet granskar kunskapsbasen varje natt självgående och nya motsägelser dyker upp automatiskt på morgonen.',
      'Fokuserar på primärkällor (lagar + interna dokument) — webbsidor ignoreras eftersom de har mer brus.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-19',
    title: 'ELvis Hub första version',
    summary:
      'Första produktionslanseringen av El-kretsens AI-drivna intranät. Sex verktyg som ska göra vardagen snabbare och säkrare — utan att AI:n hittar på något.',
    highlights: [
      'ELvis AI-assistent — ställ valfri fråga om producentansvar, batterier eller WEEE. Varje svar är backat med källhänvisning som ni kan klicka för att se exakt vilket dokument informationen kommer ifrån.',
      'Mail-assistenten — klistra in ett långt kundmail och få ett färdigt svarsutkast på svenska eller engelska, redo att kopiera in i Outlook.',
      'Avgifts-kalkylator — skriv in en produkt och mängd, få rätt produktkod och total avgift på några sekunder.',
      'Insikter-dashboard — landningssida med översikt: hur mycket ELvis används, vilka frågor som är populärast, och vilka frågor som inte kunde besvaras (kunskapsluckor).',
      'Kunskapsbas-hantering — lägg till nya källor genom att klistra in en webbadress eller ladda upp en textfil. Varje källa indexeras och blir sökbar inom sekunder.',
      'Två utbildningsspel — Kretskampen (AI-genererad frågesport) och Avgifts-duellen (snabbt prisjämförelsespel) för att lära upp nya medarbetare på ett roligt sätt.',
      'Garanterat konsekventa svar — samma fråga ger alltid exakt samma svar, varje gång. Viktigt för compliance.',
      'Automatiska mailnotiser när ELvis inte kan besvara en fråga, så ni proaktivt kan lägga till källor och fylla luckor.',
      'Färdig kunskapsbas från start: 138 källor indexerade, inklusive alla centrala lagar (Miljöbalken, EU-batteriförordningen m.fl.), hela el-kretsen.se och interna dokument som prislistan.',
    ],
  },
];
