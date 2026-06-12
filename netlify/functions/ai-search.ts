import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_shared/auth';
import { expandQueryWithCodes } from './_shared/queryExpansion';

interface AISearchRequest {
  query: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachedFileContent?: string | null;
  /** När true strömmas svaret token-för-token som NDJSON i stället för en JSON-respons.
   *  Innehållet är identiskt (samma retrieval, temperature 0) — bara leveranssättet skiljer. */
  stream?: boolean;
}

/** Markör som Claude avslutar svaret med. Måste döljas i den strömmade texten. */
const FOLLOWUP_OPEN = '<följdfrågor';

interface Citation {
  id: string;
  filename: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

const MAX_FOLLOW_UPS = 3;

interface MatchedChunk {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  similarity: number;
}

const VOYAGE_EMBEDDING_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const EMBEDDING_MODEL = 'voyage-3';
const RERANK_MODEL = 'rerank-2.5';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
// Hybrid match → wide retrieval, rerank cherry-picks the most relevant ones
// med en cross-encoder. Total kostnad per query ökar marginellt (~$0.0002),
// men kvaliteten på det Claude ser blir märkbart bättre.
const RETRIEVAL_COUNT = 25;
const FINAL_COUNT = 10;

const SYSTEM_PROMPT = `Du är ELvis — El-kretsens interna AI-assistent för producentansvar, avfallshantering och regelefterlevnad. El-kretsen är Sveriges nationella insamlingssystem för WEEE (elektronikavfall) och batterier. Du används internt av El-kretsens medarbetare — ofta för att förbereda svar på kundfrågor, inklusive långa mail på svenska eller engelska.

## ABSOLUTA REGLER (avvik ALDRIG)

1. **Grundningsregel** — Alla påståenden om LAGAR, PARAGRAFER, SIFFROR, BELOPP, DATUM, TIDSRAMAR, PROCEDURER, PRODUKTKODER, KATEGORIER, ANSVARSFÖRDELNING, TRÖSKELVÄRDEN och AVGIFTER måste grunda sig på innehållet i <kunskapsbas>-taggen. Hitta ALDRIG på något av detta — inte ens "självklara" fakta.

2. **Ordagrant-regel** — Citera juridiska termer, paragrafer, siffror, datum, avgifter, procedurbeskrivningar och produktnamn ORDAGRANT från kunskapsbasen. Omformulera inte. Paraphrasering av lagtext är en hallucinationsrisk.

3. **Citation per påstående** — Varje faktapåstående får en inline-citation: [källa: filnamn, stycke N]. I LISTOR ska VARJE bullet ha sin egen citation — aldrig bara en på slutet av hela listan. Dela upp meningar som stöds av olika källor så varje del citerar rätt källa.

4. **Tvetydighet** — Om kunskapsbasen är otydlig eller kan tolkas på flera sätt: SÄG det uttryckligen. Välj inte en tolkning och presentera den som säker. Skriv t.ex. "Kunskapsbasen är inte entydig på detta — det kan tolkas som A [källa: …] eller B [källa: …]."

5. **Tidsstämpel** — Datum och regelverk i kunskapsbasen var aktuella vid indexeringen. Om frågan rör lagar som kan ha uppdaterats nyligen — nämn att användaren bör verifiera mot aktuell version.

6. **Språk** — Svara ALLTID på svenska, även om frågan är på annat språk. Använd svenska expansioner av förkortningar ("utökat producentansvar" inte "EPR", "insamlingssystem" inte "collection scheme").

7. **Motstridiga källor** — Redovisa båda och rekommendera verifiering. Välj inte sida.

8. **Anti-sycophancy** — Var hellre ärlig än snäll. Säg "det står inte i kunskapsbasen" istället för "jag tror att". Säg "jag vet inte" istället för att gissa. Rätta hellre felaktiga premisser i frågan än bekräftar dem artigt.

## FÖRTYDLIGANDE FRÅGOR (viktigt för kategoriseringsfrågor)

Många produkter kan kategoriseras under olika El-kretsen-koder beroende på detaljer som inte framgår av frågan. Att gissa här = felaktig avgift + felaktig kundrapport. INNAN du ger kod-/avgift-/procedurssvar — verifiera att du har nödvändig info genom att ställa korta följdfrågor.

**Triggers — när du ska ställa följdfrågor:**
- Produktnamn utan specifikation ("mobiltelefon", "kylskåp", "lampa", "verktyg", "dator")
- "Batteri" utan typ (kemi? storlek? bärbart / industri / startbatteri / elbilsbatteri?)
- Dimensioner som påverkar kod (>50 cm / <50 cm, över/under 40 kg, över/under 25 kg)
- Produkter med och utan integrerade batterier — minns att **nästan alla elektronikprodukter innehåller batterier som ska deklareras separat**
- Konsument vs professionell användning
- Grön avgift — har produkten grön dokumentation?
- Avgiftsberäkning utan antal eller vikt

**Exempel-flöde — fråga "Vilken kod är mobiltelefon?":**

## Klargörande behövs
För att ge rätt kod(er) behöver jag några detaljer:

1. Gäller frågan **själva mobiltelefonen** eller **batteriet inuti**? (Båda måste deklareras separat i de flesta fall.)
2. För telefonen: är det **konsument** eller **professionell** utrustning?
3. För batteriet (om inbyggt Li-jon): är kemin specificerad, eller ska tillfällig samlingskod användas?

## Det jag kan säga direkt
Mobiltelefoner som helhet deklareras normalt under kod 3.5 [källa: ...].
Inbyggda Li-jon-batterier måste alltid deklareras separat på batteriraden, antingen med specifik kemikod (B71–B76) eller samlingskod (B77, gäller 2026) [källa: ...].

---

**När du INTE ska ställa följdfrågor:**
- Frågan är exakt specificerad ("Vad kostar kod B74?")
- Användaren har redan gett alla nödvändiga detaljer
- Det är ett enkelt lookup mot prislistan
- Frågan gäller regelverk/procedur snarare än kategorisering

Håll följdfrågorna KORTA. Max 3 frågor, be om minsta möjliga info. När användaren svarat fortsätter du med normalt strukturerat svar.

## PARTIELLA SVAR (när kunskapsbasen täcker vissa delar men inte alla)

Om frågan har FLERA delar och kunskapsbasen täcker vissa men inte alla:
- Besvara de delar du HAR källa på — med inline-citationer — under "## Svar" och "## Detaljer"
- Lista delar du INTE har källa på under "## Saknas i kunskapsbasen"
- Lämna saknade delar obesvarade istället för att gissa

Endast om kunskapsbasen inte innehåller NÅGOT relevant för frågan, svara kort: "Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig."

## SVARSFORMAT

**Vid tvetydig/kategoriserande fråga:**

## Klargörande behövs
[1-3 korta följdfrågor med tydlig motivering]

## Det jag kan säga direkt
[Om något är säkert oavsett svaren — med citations. Utelämna sektionen om inget är säkert.]

**Vid specifik fråga med tillräcklig info:**

## Svar
[1-3 meningars direkt slutsats med inline-citationer]

## Detaljer
- [Bullets med citation per rad]

## Saknas i kunskapsbasen
[Valfritt — bara när relevant]

## UPPFÖLJNINGSFRÅGOR I SAMMA TRÅD

Om <kontext>follow_up</kontext> är angiven nedan är detta en uppföljning på en tidigare fråga i tråden. Då:
- Du behöver INTE använda ## Svar / ## Detaljer-strukturen — svara mer fritt och samtalsmässigt
- ALLA grounding-, citation- och anti-hallucinations-regler gäller fortfarande
- Hänvisa gärna till vad du sa tidigare i tråden ("som jag nämnde…", "till skillnad från B74 vi pratade om…")
- Håll svaret kort och fokuserat på det nya som efterfrågas

## FÖRSLAG PÅ FÖLJDFRÅGOR

Avsluta ALLTID hela ditt svar med en separat blockstart "<följdfrågor>" och avslutande "</följdfrågor>" på egen rad. Mellan dem listar du 2-3 konkreta följdfrågor som naturligt kan komma härnäst från användaren, en per rad. Tagga ALDRIG följdfrågorna med citationer. Exempel:

<följdfrågor>
Vilken kemikod gäller för litium-järnfosfat-batterier?
Vad händer om producenten missar deklarationen i tid?
Vilka avgifter berörs av övergången?
</följdfrågor>

Förslagen ska:
- Vara konkreta uppföljningar baserat på vad du just sa, inte generella
- Sluta med frågetecken
- Vara korta (max ~80 tecken)
- Aldrig upprepa frågan användaren just ställde

Lämna ALDRIG ut <följdfrågor>-blocket. Om du av någon anledning inte kan svara, lista ändå 2-3 omformuleringar som kan ge bättre RAG-träff.`;

const NO_MATCH_RESPONSE =
  'Jag hittar inte svaret i kunskapsbanken. Kontakta ansvarig sakkunnig för en exakt bedömning.';

// Bredare detektion än en enda exakt strängmatch — Claude formulerar sig olika
// trots system-prompten, och vi får inte missa en gap-fråga bara för att frasen
// råkade hamna med synonym. Alla mönster fångar "ELvis kunde inte svara alls".
const FALLBACK_PATTERNS: RegExp[] = [
  /jag hittar inte svaret/i,
  /finns inte i kunskapsbas(en|anken)/i,
  /står inte i kunskapsbas(en|anken)/i,
  /kunskapsbas(en|anken) (täcker|innehåller|saknar)/i,
  /jag (har|saknar) (tyvärr )?(ingen|inte) (tillräcklig )?(information|kunskap)/i,
  /kontakta (ansvarig )?sakkunnig/i,
];

type AnswerOutcome = 'answered' | 'partial' | 'unanswered';

function classifyAnswer(answer: string): { outcome: AnswerOutcome; gaps: string | null } {
  const gapsMatch = answer.match(/##\s*Saknas\s+i\s+kunskapsbasen\s*\n([\s\S]+?)(?=\n##|$)/i);
  const gaps = gapsMatch ? gapsMatch[1].trim() : null;

  // "Kort svar med fall-back-fras" = ingenting kunde besvaras. Längdgräns hindrar
  // att ett långt strukturerat svar som råkar nämna "kontakta sakkunnig" på slutet
  // felklassas som unanswered.
  const isCompleteMiss =
    answer.length < 400 && FALLBACK_PATTERNS.some((p) => p.test(answer));
  if (isCompleteMiss) return { outcome: 'unanswered', gaps: null };
  if (gaps) return { outcome: 'partial', gaps };
  return { outcome: 'answered', gaps: null };
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey || !anthropicKey || !supabaseUrl || !supabaseServiceKey) {
    return json(
      {
        error:
          'Server not configured: saknar en eller flera av VOYAGE_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.',
      },
      500,
    );
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  let body: AISearchRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const query = (body.query ?? '').trim();
  if (!query) return json({ error: 'Query required' }, 400);

  // Failsafe: ALLA fel i pipelinen loggas med outcome='error' så frågan finns
  // kvar i Insikter även när Voyage/Claude/DB failar. Utan detta tappades
  // tidigare frågan helt vid 502:or — och just de fallen är ofta intressantast
  // (lång fråga, edge-case input som triggar API-fel).
  try {
    // Step 1: Embed query via Voyage AI. Expand produktkoder ("B74", "3.5") med
    // produktnamn innan embedding så retrieval hittar rätt KB-avsnitt även när
    // användaren bara skriver koden. Original-frågan går oförändrad till Claude.
    const embeddingQuery = expandQueryWithCodes(query);
    const embedding = await embedText(embeddingQuery, voyageKey);

    // Step 2: Match chunks via pgvector
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Hybrid search v2: embeddings (semantic) + BM25 (exact term/code matching)
    // merged via Reciprocal Rank Fusion. Söker mot små chunks (precision),
    // returnerar parent large chunks (kontext) för Claude. Fångar produktkoder
    // som embeddings ibland missar.
    const { data: matches, error: matchError } = await supabase.rpc('match_kb_chunks_hybrid_v2', {
      query_text: query,
      query_embedding: embedding,
      match_count: RETRIEVAL_COUNT,
    });

    if (matchError) throw new Error(`DB match failed: ${matchError.message}`);

    const candidateChunks = (matches ?? []) as MatchedChunk[];

    // Rerank: Voyage rerank-2.5 (cross-encoder) väger varje kandidat mot frågan
    // och plockar ut de mest relevanta. Halverar typiskt false positives.
    const chunks = await rerankChunks(embeddingQuery, candidateChunks, voyageKey);

    // Step 3: No matches → log + notify + return not-found answer
    if (chunks.length === 0) {
      await logQuestionOutcome({
        question: query,
        outcome: 'unanswered',
        supabaseUrl,
        serviceKey: supabaseServiceKey,
      });
      if (body.stream) {
        return streamResponse(async (write) => {
          write({ type: 'delta', text: NO_MATCH_RESPONSE });
          write({
            type: 'done',
            answer: NO_MATCH_RESPONSE,
            citations: [],
            sourceFiles: [],
            grounded: false,
            suggestedFollowUps: [],
          });
        });
      }
      return json(
        {
          answer: NO_MATCH_RESPONSE,
          citations: [],
          sourceFiles: [],
          grounded: false,
        },
        200,
      );
    }

    // Step 4: Call Claude with grounded context
    const citations: Citation[] = chunks.map((c) => ({
      id: c.id,
      filename: c.filename,
      chunkIndex: c.chunk_index,
      text: c.text,
      similarity: c.similarity,
    }));

    const contextBlock = chunks
      .map((c) => `[källa: ${c.filename}, stycke ${c.chunk_index + 1}]\n${c.text}`)
      .join('\n\n---\n\n');

    const isFollowUp = (body.conversationHistory ?? []).length > 0;
    const contextTag = isFollowUp ? '\n\n<kontext>follow_up</kontext>' : '';
    const userContent = body.attachedFileContent
      ? `${query}\n\n<bifogad_fil>\n${body.attachedFileContent}\n</bifogad_fil>\n\n<kunskapsbas>\n${contextBlock}\n</kunskapsbas>${contextTag}`
      : `${query}\n\n<kunskapsbas>\n${contextBlock}\n</kunskapsbas>${contextTag}`;

    const apiMessages = [
      ...body.conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userContent },
    ];

    // Vy #2 — strömma svaret token-för-token. Samma anrop men stream:true; vi
    // vidarebefordrar den synliga texten löpande, döljer <följdfrågor>-blocket,
    // och skickar citations/källor/grounded/följdfrågor i ett avslutande done-event.
    if (body.stream) {
      return streamResponse(async (write) => {
       try {
        const claudeStream = await fetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 1400,
            temperature: 0,
            system: SYSTEM_PROMPT,
            messages: apiMessages,
            stream: true,
          }),
        });

        if (!claudeStream.ok || !claudeStream.body) {
          const errText = await claudeStream.text().catch(() => '');
          throw new Error(`Claude API error (${claudeStream.status}): ${errText}`);
        }

        let raw = '';
        let sentVisible = 0;
        const reader = claudeStream.body.getReader();
        const decoder = new TextDecoder();
        let sseBuf = '';

        const flushVisible = (final: boolean) => {
          const idx = raw.indexOf(FOLLOWUP_OPEN);
          let visibleEnd: number;
          if (idx !== -1) {
            visibleEnd = idx; // följdfrågor-blocket börjar → dölj allt därifrån
          } else if (final) {
            visibleEnd = raw.length;
          } else {
            // Håll tillbaka en svans som kan vara en halv markör delad över deltas.
            visibleEnd = Math.max(sentVisible, raw.length - (FOLLOWUP_OPEN.length - 1));
          }
          if (visibleEnd > sentVisible) {
            write({ type: 'delta', text: raw.slice(sentVisible, visibleEnd) });
            sentVisible = visibleEnd;
          }
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuf += decoder.decode(value, { stream: true });
          const lines = sseBuf.split('\n');
          sseBuf = lines.pop() ?? '';
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith('data:')) continue;
            const payload = l.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            let evt: { type?: string; delta?: { type?: string; text?: string } };
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
              raw += evt.delta.text;
              flushVisible(false);
            }
          }
        }
        flushVisible(true);

        const { answer, suggestedFollowUps } = extractFollowUps(raw);
        const referencedFiles = extractReferencedFiles(answer, chunks);
        const { outcome, gaps } = classifyAnswer(answer);
        if (outcome !== 'answered') {
          await logQuestionOutcome({
            question: query,
            outcome,
            supabaseUrl,
            serviceKey: supabaseServiceKey,
            topFilename: chunks[0]?.filename ?? null,
            topSimilarity: chunks[0]?.similarity ?? null,
            gapsText: gaps,
          });
        }

        write({
          type: 'done',
          answer,
          citations,
          sourceFiles: referencedFiles,
          grounded: outcome === 'answered',
          suggestedFollowUps,
        });
       } catch (e) {
         // Logga som icke-stream-grenen så frågan finns kvar i Insikter vid API-fel.
         await logQuestionOutcome({
           question: query,
           outcome: 'error',
           supabaseUrl,
           serviceKey: supabaseServiceKey,
           errorMessage: (e as Error).message,
         });
         throw e; // streamResponse skickar ett {type:'error'}-event till klienten
       }
      });
    }

    const claudeRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1400,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API error (${claudeRes.status}): ${errText}`);
    }

    const claudeData = (await claudeRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const rawAnswer = claudeData.content?.find((c) => c.type === 'text')?.text ?? '';
    const { answer, suggestedFollowUps } = extractFollowUps(rawAnswer);

    // Extract which source files Claude actually referenced
    const referencedFiles = extractReferencedFiles(answer, chunks);

    // Klassa svaret: helt missad fråga, partiellt svar med ## Saknas-sektion,
    // eller komplett besvarad. Logga om något fattades.
    const { outcome, gaps } = classifyAnswer(answer);
    if (outcome !== 'answered') {
      await logQuestionOutcome({
        question: query,
        outcome,
        supabaseUrl,
        serviceKey: supabaseServiceKey,
        topFilename: chunks[0]?.filename ?? null,
        topSimilarity: chunks[0]?.similarity ?? null,
        gapsText: gaps,
      });
    }

    return json(
      {
        answer,
        citations,
        sourceFiles: referencedFiles,
        grounded: outcome === 'answered',
        suggestedFollowUps,
      },
      200,
    );
  } catch (e) {
    const message = (e as Error).message ?? 'Unknown error';
    await logQuestionOutcome({
      question: query,
      outcome: 'error',
      supabaseUrl,
      serviceKey: supabaseServiceKey,
      errorMessage: message,
    });
    return json({ error: message }, 502);
  }
};

async function logQuestionOutcome(params: {
  question: string;
  outcome: 'partial' | 'unanswered' | 'error';
  supabaseUrl: string;
  serviceKey: string;
  topFilename?: string | null;
  topSimilarity?: number | null;
  gapsText?: string | null;
  errorMessage?: string | null;
}) {
  const {
    question,
    outcome,
    supabaseUrl,
    serviceKey,
    topFilename = null,
    topSimilarity = null,
    gapsText = null,
    errorMessage = null,
  } = params;
  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: inserted } = await client
      .from('ai_unanswered')
      .insert({
        question_text: question,
        outcome,
        top_match_filename: topFilename,
        top_match_similarity: topSimilarity,
        gaps_text: gapsText,
        error_message: errorMessage,
      })
      .select('id')
      .single();

    // Mail-notiser: endast för totalt missade frågor. Partiella + tekniska fel
    // skulle bli för mycket brus — de syns istället i Insikter-vyn.
    if (outcome !== 'unanswered') return;

    const resendKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.NOTIFICATION_EMAIL;
    if (!resendKey || !notifyTo) return;

    const subject = `[ELvis Hub] Obesvarad fråga: "${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"`;
    const similarityLine = topSimilarity != null
      ? `Närmast matchning: <code>${topFilename}</code> (${(topSimilarity * 100).toFixed(1)} %)`
      : 'Inga chunks passerade tröskeln — kunskapsbasen saknade något liknande helt.';

    const body = `
      <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 560px; color: #1e293b;">
        <h2 style="color: #0369a1; margin-bottom: 8px;">Obesvarad AI-fråga</h2>
        <p style="color: #475569; margin: 0 0 20px;">
          En användare ställde en fråga som inte kunde besvaras från kunskapsbasen.
        </p>

        <div style="background: #f1f5f9; border-left: 4px solid #0284c7; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
          <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;">Fråga</strong>
          <p style="margin: 6px 0 0; font-size: 15px; line-height: 1.5;">${escapeHtml(question)}</p>
        </div>

        <p style="font-size: 14px; color: #475569;">${similarityLine}</p>

        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
          <strong>Åtgärd:</strong> Lägg till en källa som täcker ämnet — klistra in en URL i "Källor"-fliken i ELvis Hub, eller ladda upp TXT/PDF till Supabase-bucketen och kör backfill.
        </p>

        <p style="font-size: 11px; color: #94a3b8; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          ELvis Hub · El-kretsen · <a href="https://elkretsen.netlify.app" style="color:#0284c7">Öppna</a>
        </p>
      </div>`.trim();

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'ELvis Hub <hub@updates.samify.se>',
        to: notifyTo.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        html: body,
      }),
    });

    if (emailRes.ok && inserted) {
      await client.from('ai_unanswered').update({ notified: true }).eq('id', inserted.id);
    } else if (!emailRes.ok) {
      const errBody = await emailRes.text().catch(() => '<no body>');
      console.warn(`logQuestionOutcome: Resend ${emailRes.status} — ${errBody.slice(0, 400)}`);
    }
  } catch (e) {
    // Loggning får aldrig krascha användarens svar.
    console.warn('logQuestionOutcome failed:', (e as Error).message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

async function rerankChunks(
  query: string,
  candidates: MatchedChunk[],
  apiKey: string,
): Promise<MatchedChunk[]> {
  if (candidates.length <= FINAL_COUNT) return candidates;

  try {
    const response = await fetch(VOYAGE_RERANK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        query,
        documents: candidates.map((c) => c.text),
        top_k: FINAL_COUNT,
      }),
    });

    if (!response.ok) {
      // Rerank ska aldrig blockera ett svar — fall tillbaka till hybrid-ordningen.
      console.warn(`Voyage rerank ${response.status}: ${await response.text()}`);
      return candidates.slice(0, FINAL_COUNT);
    }

    const data = (await response.json()) as {
      data: Array<{ index: number; relevance_score: number }>;
    };

    // Behåll original cosine-similarity i `similarity` så UI-procenten är
    // konsistent — rerank används bara för ordning och urval.
    return data.data.map((d) => candidates[d.index]).filter(Boolean);
  } catch (e) {
    console.warn(`Rerank failed, fallback to hybrid order: ${(e as Error).message}`);
    return candidates.slice(0, FINAL_COUNT);
  }
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(VOYAGE_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [text],
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

function extractFollowUps(raw: string): { answer: string; suggestedFollowUps: string[] } {
  // Claude instrueras avsluta varje svar med <följdfrågor>...</följdfrågor>.
  // Vi plockar ut dem, normaliserar och returnerar svaret utan blocket — chips
  // renderas separat i UI:t istället för i textflödet.
  const match = raw.match(/<följdfrågor>\s*([\s\S]*?)\s*<\/följdfrågor>/i);
  if (!match) return { answer: raw.trim(), suggestedFollowUps: [] };

  const items = match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
    .filter((line) => line.length >= 5 && line.length <= 120)
    .slice(0, MAX_FOLLOW_UPS);

  const answer = raw.replace(match[0], '').trim();
  return { answer, suggestedFollowUps: items };
}

function extractReferencedFiles(answer: string, chunks: MatchedChunk[]): string[] {
  const regex = /\[källa:\s*([^,\]]+?)(?:,\s*stycke\s*\d+)?\]/gi;
  const referenced = new Set<string>();
  const availableFiles = new Set(chunks.map((c) => c.filename.toLowerCase()));

  for (const match of answer.matchAll(regex)) {
    const raw = match[1].trim();
    const lower = raw.toLowerCase();
    const exact = [...availableFiles].find((f) => f === lower);
    if (exact) {
      const orig = chunks.find((c) => c.filename.toLowerCase() === exact)!.filename;
      referenced.add(orig);
      continue;
    }
    const partial = chunks.find(
      (c) =>
        c.filename.toLowerCase().includes(lower) ||
        lower.includes(c.filename.toLowerCase().replace(/\.[^/.]+$/, '')),
    );
    if (partial) referenced.add(partial.filename);
  }

  return [...referenced];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/** Bygg ett NDJSON-strömmat svar (en JSON-rad per event). `producer` får en
 *  `write`-funktion; kastar den ett fel skickas ett {type:'error'}-event innan
 *  strömmen stängs så klienten alltid får ett tydligt slut. */
function streamResponse(producer: (write: (obj: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        await producer(write);
      } catch (e) {
        write({ type: 'error', message: (e as Error).message ?? 'Okänt strömningsfel' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      ...corsHeaders(),
    },
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

export const config: Config = {
  path: '/api/ai-search',
};
