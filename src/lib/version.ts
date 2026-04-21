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
  highlights: string[];
}

export const CURRENT_VERSION = '1.2.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-04-21',
    title: 'Admin-roll: redigera och radera källor',
    highlights: [
      'Ny admin-roll via ADMIN_EMAILS env var (kommaseparerad e-postlista)',
      'Admin-badge i Kunskapsbas-sidans header när inloggad user är admin',
      'Redigera-knapp på varje TXT-fil — hela texten återskapas från chunks, kan ändras och sparas',
      'Vid sparning: re-chunkas och re-embeddas automatiskt via Voyage',
      'Radera-knapp med TA BORT-bekräftelse (oåterkalleligt)',
      'URL-källor (riksdagen.se, el-kretsen.se m.fl.) kan bara raderas — redigering skulle bryta spårbarhet mot original',
      'Backend verifierar admin via Supabase JWT på varje anrop',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-21',
    title: 'Kunskapsbas-audit: motsägelsedetektion',
    highlights: [
      'Ny flik "Granskning" med alla AI-detekterade motsägelser mellan chunks',
      'Nattlig körning via pg_cron kl 03:15 som skannar kunskapsbasen',
      'Severity-skala 1-5 + filtrering på status/severity/filnamn',
      'Claude Sonnet 4 bedömer par med sim 0.75-0.95, parallellt 8 i taget',
      'Resolve/Ignore/Reopen-åtgärder med audit trail (vem och när)',
      'Unique constraint på least/greatest så varje par bara testas en gång',
      'Kostnad: ~400 kr för första fulla audit, ~1 kr/natt därefter',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-19',
    title: 'Första produktionslanseringen',
    highlights: [
      'ELvis AI-assistent med grounded RAG — svar alltid backade av citations',
      'Mail-assistent på svenska och engelska',
      'Avgifts-kalkylator som hittar rätt produktkod + räknar ut totalen',
      'Insikter-dashboard med KPI, obesvarade frågor och källor-statistik',
      'Kunskapsbas-hantering med URL- och filuppladdning',
      'Kretskampen (AI-genererat quiz) och Avgifts-duellen (prisgissnings-spel)',
      'Email-notifikationer via Resend när en fråga inte kan besvaras',
      'Full El-kretsen-indexering: 138 källor, 1 661 chunks (lagar, el-kretsen.se, interna)',
      'Voyage voyage-3 embeddings + Claude Sonnet 4 (temperature 0) för konsekventa svar',
      'Vertikal sidebar, full-width header, responsiv layout i 1400 px',
    ],
  },
];
