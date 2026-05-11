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

export const CURRENT_VERSION = '1.5.2';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.5.2',
    date: '2026-05-11',
    title: 'Buggfix: filuppladdning till kunskapsbasen',
    summary:
      'Uppladdning av textfiler kunde stoppas med felet "unsupported Unicode escape sequence" när filen innehöll dolda NUL-tecken — typiskt efter en kopiering ur PDF via Notepad. Filerna saneras nu automatiskt innan de indexeras.',
    highlights: [
      'Dolda NUL-tecken (\\u0000) och trasiga UTF-16-surrogat strippas tyst innan texten skickas till databasen, så uppladdning fungerar även för filer som kommer från PDF→Anteckningar-flödet.',
      'Samma sanering gäller även URL-importer för konsistens, om en sida skulle innehålla osynliga kontrolltecken.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-05-09',
    title: 'Välj själv hur personlig mail-assistenten ska vara',
    summary:
      'Mail-assistenten har fått en ton-väljare så ni kan bestämma per mail hur saklig eller personlig AI:n ska vara i sina svar. Valet kommer ihåg mellan inloggningar.',
    highlights: [
      'Ny "Ton"-väljare bredvid språkväljaren med tre nivåer: Saklig (konsekvent och formell — samma mail ger nästan identiskt svar), Balanserad (standard — varierad ton men strikt på fakta), Personlig (varmare och mer fritt formulerat — som om en kollega skrev mailet).',
      'Det valda tonläget sparas automatiskt så ni slipper välja varje gång — har ni en gång klickat Personlig stannar det där tills ni byter.',
      'Beskrivning av aktivt val syns alltid under knapparna så det är tydligt vad det gör innan ni klickar Generera.',
      'Fakta påverkas inte av tonvalet — siffror, datum, paragrafer och produktkoder kommer fortfarande ordagrant från kunskapsbasen tack vare grounding-reglerna i AI:ns systemprompt.',
      'Tidigare svarade mail-assistenten alltid på samma deterministiska sätt vilket kunde kännas stelt över flera mail till samma kund. Nu får ni välja vad som passar situationen.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-09',
    title: 'Stora sök-uppgraderingar och inbyggt feedback-formulär',
    summary:
      'ELvis blir mer precis i sina svar tack vare flera förbättringar i hur kunskapsbasen söks igenom, och ni kan nu skicka feedback direkt i appen istället för via Google Forms.',
    highlights: [
      'ELvis söker nu i två nivåer — små textstycken för exakt sökning, men levererar större omgivande stycken till AI:n när svaret skrivs. Resultatet: ELvis hittar rätt mening MEN har också omgivningen för att tolka den korrekt. Bra t.ex. när en lagparagraf hänvisar till en föregående definition.',
      'En extra prickskytte-AI har lagts till mellan första sökningen och svaret. Den väger varje kandidat-avsnitt mot frågan och plockar ut de mest relevanta — halverar typiskt antalet felmatchningar.',
      'Korta frågor som "B74" eller "kostar kod 3.5 något?" expanderas nu automatiskt med produktnamnet innan sök ("B74 Li-jon LFP – Litium-järnfosfat..."). Innebär att ni får lika bra resultat med en kort fråga som med en utskriven.',
      'Smart överlapp mellan textstycken följer nu meningsgränser istället för en hård avskärning på exakt 200 tecken. Citation-utdragen blir därmed mer läsbara — inga halva meningar.',
      'Varje textstycke bär nu en automatisk lag- och paragrafmärkning när det är möjligt (t.ex. "SFS 2022:1276" och "15 kap. 17 §") — totalt 1 042 av 1 654 stycken har fått sådan metadata. Grunden för framtida sökfilter direkt i UI:t.',
      'Ny inbyggd Feedback-knapp i toppmenyn — välj kategori (Förbättring/Bugg/Fråga/Annat), skriv ditt meddelande, klicka Skicka. Mejl landar direkt hos Samify och vi kan svara från samma tråd. Ersätter Google Forms-formuläret.',
      'Chatt-historiken med ELvis försvinner inte längre när ni växlar flik till Mail-assistenten eller någon annan vy — den lever kvar tills ni stänger fliken eller loggar ut. Ingen risk att nästa person på samma konto ser era tidigare frågor.',
    ],
  },
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
