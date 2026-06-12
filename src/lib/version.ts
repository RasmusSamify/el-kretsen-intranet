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
  releasedAt?: string; // ISO timestamp — krävs för 24h-färskhetsfönstret i Sidebar-badge
  title: string;
  summary: string;
  highlights: string[];
}

export const CURRENT_VERSION = '1.11.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.11.0',
    date: '2026-06-12',
    releasedAt: '2026-06-12T14:30:00+02:00',
    title: 'Crawla hela webbplatser till kunskapsbasen',
    summary:
      'Ni kan nu lägga in en hel webbplats på en gång istället för en länk i taget. Systemet hittar alla undersidor, visar dem som en lista att bocka i och ur, och indexerar bara det ni väljer — så basen hålls kurerad och ni bestämmer alltid vad som kommer in.',
    highlights: [
      'Ny "Crawla sajt"-knapp i Kunskapsbasen: ange en webbplats så hittar systemet alla undersidor via sajtens sitemap.',
      'Allt är förbockat från start — bocka ur det som inte ska in (t.ex. nyhetsarkiv), eller begränsa till en viss sökväg. Bara ikryssade sidor indexeras.',
      'Läget "Klistra in lista": har ni redan exakta länkar (t.ex. specifika vägledningssidor eller EU-förordningar) klistrar ni bara in dem rad för rad.',
      'Live-förlopp under indexeringen visar hur många sidor som lyckats och vilka som inte kunde läsas (oftast JavaScript-renderat innehåll).',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-06-04',
    releasedAt: '2026-06-04T16:00:00+02:00',
    title: 'Kretskampen: Teknik och Juridik laddar nu snabbt',
    summary:
      'Kategorierna Teknik och Juridik kunde ge ett tekniskt fel när frågorna tog för lång tid att skapa. Frågorna genereras nu betydligt snabbare och får plats inom tidsgränsen.',
    highlights: [
      'Kretskampen genererar frågor med en snabbare AI-modell och kortare förklaringar — Teknik och Juridik timeout:ar inte längre.',
      'Skulle något ändå ta för lång tid visas nu ett begripligt meddelande med möjlighet att försöka igen, istället för ett tekniskt felmeddelande.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-06-04',
    releasedAt: '2026-06-04T12:00:00+02:00',
    title: 'Direktkoll av motsägelser + rättelser i Kretskampen och Kunskapsluckor',
    summary:
      'Efter Linneas feedback: nya och ändrade källor kontrolleras nu mot resten av kunskapsbasen direkt vid uppladdning, så motsägelser syns inom minuter istället för att vänta på nattgranskningen. Dessutom tre rättelser i Kretskampen och Kunskapsluckor.',
    highlights: [
      'Granskning: när du lägger till eller ändrar en källa kollas den genast mot befintligt innehåll — säger den emot något hamnar paret i Granskning inom minuter, istället för att vänta tills nattsvepet (som tar ett par veckor) når dit.',
      'Kretskampen: rätt svarsalternativ placeras nu slumpmässigt istället för alltid högst upp till vänster.',
      'Kretskampen: kategorierna Teknik och Juridik fungerar igen — de kunde tidigare ge ett tekniskt felmeddelande när frågor med långa förklaringar blev avhuggna.',
      'Kunskapsluckor: två tydliga val utöver "Skapa utkast" — "Markera åtgärdad" när luckan redan hanterats, och "Inte relevant" när frågan inte rör er.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-05-30',
    releasedAt: '2026-05-30T12:00:00+02:00',
    title: 'Ny sida: På gång — se vad som kommer härnäst',
    summary:
      'En ny flik som visar vad vi planerar att bygga framöver i ELvis Hub, så ni alltid vet vad som är på väg och kan påverka prioriteringen.',
    highlights: [
      '"På gång"-flik i menyn med kommande funktioner och deras status (Näst på tur / Planerad / Under utredning).',
      'Just nu på kartan: Skrivelse-assistent för utgående producentbrev och regelsammanfattningar, Regelradar för automatisk lagbevakning, och en introduktions-läranväg för nyanställda.',
      'Listan uppdateras löpande utifrån era önskemål — använd Feedback-knappen för att påverka vad vi bygger härnäst.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-05-29',
    releasedAt: '2026-05-29T18:00:00+02:00',
    title: 'Elvira, mall-bibliotek, tydligare granskning och ny systemstatus',
    summary:
      'Ett samlat lyft efter genomgången med Linnea: mail-assistenten heter nu Elvira och har fått ett eget mall-bibliotek där ni ser exakt vilka sparade exempel varje svar bygger på. Insikter delas upp per assistent, Granskningssidan förklarar vad den gör, och en ny Systemstatus-sida visar vad som är online och när allt senast uppdaterades.',
    highlights: [
      'Mail-assistenten heter nu Elvira (chatten heter fortsatt ELvis) — namnen syns i menyn, sidhuvuden och i Insikter så det är lätt att hålla isär de två AI-assistenterna.',
      'Nytt "Mallar"-bibliotek i Elvira: alla stilexempel ni sparat listas på ett ställe, med hur många mailsvar som faktiskt byggt på varje mall och när den senast användes. Så ni kan följa upp att era tillägg verkligen tillämpas.',
      'Varje genererat mailsvar visar nu om det byggde på en tidigare inlagd mall — med vilken mall och hur lik den var. Direkt koppling mellan det ni lär Elvira och det hon levererar.',
      'Insikter är uppdelad i två flikar: ELvis (chatt) och Elvira (mail). Slipp blanda ihop frågor till chatten med mail-statistiken.',
      'Elvira-fliken i Insikter har en egen feedback-ström: senaste tummen upp/ner på mailsvar, med kommentarerna synliga så ni ser vad som kan förbättras.',
      'Granskningssidan har fått en "Så funkar granskningen"-panel som i klartext förklarar vad nattaudit och användarrättelser är, var ärendena kommer ifrån och vad knapparna gör.',
      'Helt ny Systemstatus-sida: live-koll av att databas, Claude, embeddings och backend är online — plus när kunskapsbasen, webb-crawlen och nattgranskningen senast kördes.',
      'Webbsidan el-kretsen.se crawlas om automatiskt varje måndag morgon så kunskapsbasen hålls färsk när sajten uppdateras.',
      'Systemstatus har manuella körknappar (admin): crawla om sajten, kör nattgranskningen eller drift-kollen direkt istället för att vänta på schemat.',
      'Ny flik "Kunskapsluckor" i Granskning: gör om obesvarade frågor till färdiga utkast på kunskapskällor som du verifierar och lägger till med ett klick. AI:n hittar aldrig på fakta — det som saknas markeras som "att komplettera".',
      'Säkerhet: bara inloggade administratörer kan lägga till källor i kunskapsbasen (tidigare var de endpointarna öppna).',
      'Avgifts-kalkylatorn och Avgifts-duellen är borttagna eftersom de inte användes.',
      'Ny admin-flik Loggbok: spara möten, samtal och feedback — AI:n sammanfattar, plockar ut nyckelpunkter och action points och föreslår uppföljning.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-05-12',
    releasedAt: '2026-05-12T22:00:00+02:00',
    title: 'Bolla med ELvis · Rätta svar direkt · Mail-assistenten lär sig din ton',
    summary:
      'Tre stora tillägg som gör ELvis Hub mer interaktiv utan att tumma på sakligheten: följdfrågor i chatten flyter mer naturligt, du kan rätta felaktiga svar direkt under varje meddelande, och mail-assistenten lär sig hur Linnea formulerar sig över tid.',
    highlights: [
      'ELvis föreslår 2-3 förslag på följdfrågor under varje svar — klicka istället för att skriva. Förslagen är konkreta uppföljningar baserat på vad ELvis just sa, inte allmänna.',
      'Uppföljningsfrågor i samma tråd får svar i mer naturlig dialog-ton (utan strikt ## Svar/## Detaljer-rubrikering). Alla grounding-regler gäller fortfarande — siffror, datum och paragrafer citeras ordagrant.',
      'Ny "Rätta detta svar"-knapp under varje ELvis-svar. Tre tvingade val: fel källa hänvisades, källan är inaktuell, eller saknas i kunskapsbasen. Tvingade val betyder att inga free-text-tolkningar kan kontaminera kunskapsbasen — alla rättelser kopplas till ett dokument.',
      'Inskickade rättelser landar i nya fliken "Användarrättelser" på Granskningssidan där admin kan markera dem som åtgärdade eller ignorerade, precis som motsägelse-fynden från nattaudit.',
      'Mail-assistenten har fått stil-träning: efter varje genererat svar kan ni klicka "Spara ditt eget svar som stilexempel" och klistra in hur ni faktiskt hade svarat. AI:n lär sig DIN TON och struktur — fakta hämtas fortfarande från kunskapsbasen så siffror och paragrafer kan inte ändras.',
      'Vid framtida mail söker AI:n upp 2 semantiskt liknande tränings-svar och använder dem som "så här brukar Linnea formulera sig"-exempel. Träningen blir alltså personlig per inkommande mailtyp.',
      'Buggfix: mail-assistenten anropade fel sök-RPC efter v1.6.0-städningen och kunde inte hitta källor — nu går allt mot samma kunskapsbas som ELvis själv.',
      'Versionsmärkningen i chat-headern speglar nu automatiskt aktuell version (tidigare hårdkodad till v1.5).',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-12',
    releasedAt: '2026-05-12T20:00:00+02:00',
    title: 'Word-uppladdning, åtdragen kunskapsbas och fixad källcitations-ruta',
    summary:
      'Ett samlat lyft med flera förbättringar runt kunskapsbasen: Ni kan nu släppa in Word-filer direkt, alla uppladdade källor blir omedelbart sökbara av ELvis, Granskning och nattaudit jobbar mot exakt samma kunskap som ELvis svarar utifrån, och källcitations-rutan i chatten klipps inte längre av.',
    highlights: [
      'Word-filer (.docx) parsas nu direkt i webbläsaren när ni drar in dem — ren text extraheras automatiskt utan formatering, så chunkningen blir korrekt och ELvis kan söka i innehållet på en gång.',
      'Felaktiga filer fångas innan de hamnar i kunskapsbasen — släpper någon in en PDF, ett okänt arkiv eller en binärfil får man tydligt felmeddelande istället för att en chunk fylls med oläsbar kod.',
      'Buggfix: nyligen uppladdade filer blir nu omedelbart sökbara av ELvis. Tidigare kunde en fil chunkas och sparas korrekt — men ELvis sökte i en annan tabell och såg därför aldrig innehållet. Drabbade alla källor som lagts till efter den senaste sökmotor-uppgraderingen.',
      'Buggfix: när ni redigerar ett internt dokument via pennan i Kunskapsbas-fliken används den nya texten direkt i ELvis svar. Tidigare uppdaterades bara en bakgrundskopia som inte längre lästes vid sökning.',
      'Nattlig motsägelse-audit och drift-bevakning körs nu mot samma chunks som ELvis söker i. Granskningssidan visar därmed alltid det aktuella läget. De första nya audit-fynden mot den nuvarande basen dyker upp efter nästa nattkörning.',
      'Källcitations-rutan i ELvis-chatten klipps inte längre av när hänvisningen ligger nära botten — den flyter ovanpå chat-fönstret, positioneras smart ovanför eller under chippet, och följer med vid scroll tills du stänger den.',
      'Bakgrundsstädning: en gammal parallell datalagring har tagits bort helt — minskar Supabase-användning och eliminerar risken att framtida ändringar glömmer uppdatera ena halvan.',
      'Mammoth-biblioteket (som läser .docx) laddas bara när någon faktiskt drar in en Word-fil — så ELvis Hub startar lika snabbt som tidigare för alla andra.',
    ],
  },
  {
    version: '1.5.4',
    date: '2026-05-11',
    releasedAt: '2026-05-11T16:30:00+02:00',
    title: 'Grön "Nytt"-markering vid versionen när något uppdaterats',
    summary:
      'En liten grön pill dyker upp bredvid versionsnumret i sidomenyn i 24 timmar efter varje release, så ni snabbt ser om vi har skickat ut nya förbättringar. Klicka på versionen så försvinner pillen.',
    highlights: [
      'Grön "Nytt"-pill bredvid versionsnumret syns i 24 timmar efter varje release — försvinner automatiskt eller direkt när ni öppnar uppdaterings-historiken.',
      'Pillen blinkar lätt så den fångar ögat utan att vara skrikig.',
      'Sparas per webbläsare — om Linnea öppnat uppdaterings-historiken hemma men inte på jobbet ser hon pillen igen på jobbdatorn (så hon definitivt inte missar något).',
    ],
  },
  {
    version: '1.5.3',
    date: '2026-05-11',
    releasedAt: '2026-05-11T15:45:00+02:00',
    title: 'ELvis tappar aldrig en obesvarad fråga längre',
    summary:
      'Vi har härdat loggningen av frågor som ELvis inte kan besvara, så ingen kunskapslucka försvinner i bakgrunden. Partiella svar och tekniska fel fångas nu också — inte bara helt missade frågor.',
    highlights: [
      'Bredare detektion av "kan inte svara"-formuleringar. Tidigare letade systemet efter en exakt mening — om Claude formulerade sig minsta lite annorlunda räknades frågan som besvarad. Nu fångas alla varianter och loggas korrekt.',
      'Partiella svar loggas också — när ELvis besvarar del 1 av en flerdelad fråga men listar "## Saknas i kunskapsbasen" för del 2 sparas själva luckorna i databasen så de syns i Insikter.',
      'Tekniska fel (Voyage embedding-fel, Claude API-fel, databas-fel) tappar inte längre frågan — den loggas med felmeddelandet så ni kan se om något återkommer.',
      'Mailnotiser för obesvarade frågor skickas fortfarande bara för helt missade frågor — partiella och tekniska fel hamnar i Insikter utan extra mail (för att inte fylla inkorgen).',
      'Bakgrund: vi upptäckte att en del frågor föll mellan stolarna när AI:n formulerade fallback-frasen i lite olika ordning. Den här uppdateringen är en ren stärkning av loggningen — själva svaren från ELvis påverkas inte.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-05-11',
    releasedAt: '2026-05-11T14:15:00+02:00',
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
