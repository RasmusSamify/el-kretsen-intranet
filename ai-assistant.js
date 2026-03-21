// ═══════════════════════════════════════════════
//  ai-assistant.js — AI-analys med Supabase RAG
//
//  Flöde:
//  1. Hämtar alla TXT-filer från Supabase bucket
//     "ai-kunskapsbas" vid första anropet (cachas)
//  2. Chunkar varje fil och gör keyword-relevans
//     mot användarens fråga (enkel BM25-liknande)
//  3. Skickar top-chunks + konversationshistorik
//     till Claude API
//  4. Renderar svaret med käll-chips
// ═══════════════════════════════════════════════

// ── State ──────────────────────────────────────
const AI_STATE = {
    messages: [],          // { role: 'user'|'assistant', content: string }
    knowledgeChunks: [],   // { filename, text, score }
    kbLoaded: false,
    isStreaming: false,
};

const EK_SYSTEM_PROMPT = `Du är El-kretsens interna AI-assistent och specialist på producentansvar, avfallshantering och regelefterlevnad. Ditt syfte är att hjälpa medarbetare att navigera i komplexa lagar och regler.

Svara ALLTID på svenska. Var saklig, juridiskt korrekt och hjälpsam.

Svarsstruktur:
1. Direkt svar/slutsats
2. Källa (vilken fil/paragraf)
3. Praktisk innebörd för El-kretsen
4. Om osäker: "Det saknas specifik policy för detta i min nuvarande data, men baserat på befintligt underlag gäller..."

Du får INTE hitta på fakta. Om du inte förstår: "Oj, nu blev det kortslutning i mina ledningar. Kan du formulera om dig?"
Om informationen saknas: "Jag har inte information om detta i min kunskapsbank."

Batterikoder 2026 följer: [Kategori][Kemi][Storlek]. B=Bärbart, L=Lätta transportmedel, S=Start/belysning, I=Industri, E=Elbil. B77 (Li-jon ospecificerad) är temporär och tas bort fr.o.m. 2027.`;

// ── Chunking ────────────────────────────────────
function chunkText(text, filename, chunkSize = 1200, overlap = 200) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push({ filename, text: text.slice(i, end) });
        if (end === text.length) break;
        i += chunkSize - overlap;
    }
    return chunks;
}

// ── Relevans-scoring (keyword BM25-inspirerat) ──
function scoreChunk(chunk, query) {
    const qTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const cText   = chunk.text.toLowerCase();
    let score = 0;
    qTokens.forEach(token => {
        const count = (cText.match(new RegExp(token, 'g')) || []).length;
        score += count > 0 ? 1 + Math.log(count) : 0;
    });
    return score;
}

function getTopChunks(query, n = 6) {
    return AI_STATE.knowledgeChunks
        .map(c => ({ ...c, score: scoreChunk(c, query) }))
        .filter(c => c.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, n);
}

// ── Ladda kunskapsbas från Supabase ─────────────
async function loadKnowledgeBase() {
    const { data: files, error } = await supabaseClient.storage.from(BUCKET_KNOWLEDGE).list();
    if (error || !files) {
        console.warn('Kunde inte hämta kunskapsbas:', error?.message);
        return;
    }

    const txtFiles = files.filter(f => f.name.endsWith('.txt') && f.name !== '.emptyFolderPlaceholder');
    const total = txtFiles.length;
    let loaded = 0;

    updateAIStatus(`Laddar kunskapsbas (0/${total})...`);

    await Promise.all(txtFiles.map(async (file) => {
        try {
            const { data: urlData } = supabaseClient.storage.from(BUCKET_KNOWLEDGE).getPublicUrl(file.name);
            const text = await (await fetch(urlData.publicUrl)).text();
            const chunks = chunkText(text, file.name);
            AI_STATE.knowledgeChunks.push(...chunks);
            loaded++;
            updateAIStatus(`Laddar kunskapsbas (${loaded}/${total})...`);
        } catch (e) {
            console.warn(`Fel vid inläsning av ${file.name}:`, e);
        }
    }));

    AI_STATE.kbLoaded = true;
    updateAIStatus(null);
    updateFileCount();
}

// ── Skicka meddelande till Claude ───────────────
async function sendMessage(userText, uploadedContext = null) {
    if (AI_STATE.isStreaming) return;
    AI_STATE.isStreaming = true;

    // Hitta relevanta chunks
    const topChunks = getTopChunks(userText);
    const usedFiles = [...new Set(topChunks.map(c => c.filename))];

    const contextBlock = topChunks.length > 0
        ? `\n\n<kunskapsbas>\n${topChunks.map(c => `[${c.filename}]\n${c.text}`).join('\n\n---\n\n')}\n</kunskapsbas>`
        : '';

    const fileBlock = uploadedContext
        ? `\n\n<bifogad_fil>\n${uploadedContext}\n</bifogad_fil>`
        : '';

    // Lägg till i state
    const userMsg = userText + (uploadedContext ? '\n\n📎 [Bifogad fil bifogad]' : '');
    AI_STATE.messages.push({ role: 'user', content: userMsg });
    renderMessages();
    showTypingIndicator();

    // Bygg API-meddelanden
    const apiMessages = AI_STATE.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
    }));
    apiMessages.push({
        role: 'user',
        content: userText + contextBlock + fileBlock
    });

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: CLAUDE_MODEL,
                max_tokens: 1500,
                system: EK_SYSTEM_PROMPT,
                messages: apiMessages,
            })
        });

        const data = await response.json();
        const assistantText = data.content?.[0]?.text || 'Inget svar mottaget.';

        AI_STATE.messages.push({ role: 'assistant', content: assistantText });
        hideTypingIndicator();
        renderMessages();
        renderSourceChips(usedFiles);
    } catch (err) {
        hideTypingIndicator();
        AI_STATE.messages.push({ role: 'assistant', content: `❌ Fel vid API-anrop: ${err.message}` });
        renderMessages();
    } finally {
        AI_STATE.isStreaming = false;
        setInputEnabled(true);
    }
}

// ── Rendering ───────────────────────────────────
function renderMessages() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    container.innerHTML = '';

    if (AI_STATE.messages.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center py-12">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style="background:var(--primary-light);color:var(--primary)">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v3"/></svg>
                </div>
                <h3 class="font-bold text-gray-800 text-lg mb-2">Hej Linnea! 👋</h3>
                <p class="text-gray-500 text-sm max-w-sm leading-relaxed">Ställ en fråga, klistra in produktkoder eller ladda upp en fil så hjälper jag dig med regler, avgifter och klassificering.</p>
                <div class="mt-6 flex flex-wrap gap-2 justify-center">
                    ${['Vad kostar B74?', 'Hur deklarerar jag elcykelbatterier?', 'Förklara P24 vs P25', 'Vad händer om vi missar deklaration?'].map(q =>
                        `<button onclick="useQuickPrompt('${q}')" class="text-xs font-bold px-4 py-2 rounded-full border-2 transition-all hover:shadow-md" style="border-color:var(--primary);color:var(--primary);background:var(--primary-light)">${q}</button>`
                    ).join('')}
                </div>
            </div>`;
        return;
    }

    AI_STATE.messages.forEach(msg => {
        const wrap = document.createElement('div');
        wrap.className = `ai-message flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
        const bubble = document.createElement('div');
        bubble.className = msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant';

        if (msg.role === 'assistant') {
            // Enkel markdown-rendering
            bubble.innerHTML = msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/^• (.+)/gm, '<li>$1</li>')
                .replace(/^(\d+)\. (.+)/gm, '<li>$2</li>')
                .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
                .split('\n\n').map(p => p.startsWith('<') ? p : `<p>${p}</p>`).join('');
        } else {
            bubble.textContent = msg.content;
        }

        wrap.appendChild(bubble);
        container.appendChild(wrap);
    });

    container.scrollTop = container.scrollHeight;
}

function renderSourceChips(files) {
    const el = document.getElementById('ai-sources');
    if (!el || files.length === 0) { if (el) el.innerHTML = ''; return; }
    el.innerHTML = '<span class="text-xs text-gray-400 font-bold mr-2">Källor:</span>' +
        files.map(f => `<span class="ai-source-chip">📄 ${f.replace('.txt','')}</span>`).join('');
}

function showTypingIndicator() {
    const container = document.getElementById('ai-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.id = 'ai-typing';
    el.className = 'flex justify-start mb-4';
    el.innerHTML = `<div class="ai-msg-assistant flex items-center gap-1 py-3 px-4">
        <span class="ai-typing-dot"></span><span class="ai-typing-dot"></span><span class="ai-typing-dot"></span>
    </div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    setInputEnabled(false);
}

function hideTypingIndicator() {
    document.getElementById('ai-typing')?.remove();
}

function updateAIStatus(msg) {
    const el = document.getElementById('ai-kb-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
}

function updateFileCount() {
    const el = document.getElementById('ai-file-count');
    if (!el) return;
    const fileCount = [...new Set(AI_STATE.knowledgeChunks.map(c => c.filename))].length;
    el.textContent = `${fileCount} dokument laddade`;
}

function setInputEnabled(enabled) {
    const input  = document.getElementById('ai-input');
    const btn    = document.getElementById('ai-send-btn');
    if (input) input.disabled  = !enabled;
    if (btn)   btn.disabled    = !enabled;
}

function useQuickPrompt(text) {
    const input = document.getElementById('ai-input');
    if (input) { input.value = text; input.focus(); }
}

// ── Fil-upload hantering ─────────────────────────
async function readUploadedFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        if (file.type === 'application/pdf') {
            // PDF läses som text (enkelt, utan extra bibliotek)
            reader.readAsText(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// ── Init ────────────────────────────────────────
function initAIAssistant() {
    const root = document.getElementById('ai-chat-root');
    if (!root) return;

    root.innerHTML = `
    <div class="flex h-full gap-4">

        <!-- Chat-panel -->
        <div class="flex-1 bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 flex flex-col overflow-hidden">

            <!-- Header -->
            <div class="p-5 border-b border-gray-100 flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0" style="background:var(--primary-light);color:var(--primary)">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v3"/></svg>
                </div>
                <div class="flex-1">
                    <h2 class="font-bold text-gray-800 text-base leading-none">AI-analys</h2>
                    <p id="ai-kb-status" class="text-xs text-gray-400 mt-1 font-medium" style="display:none"></p>
                    <p id="ai-file-count" class="text-xs font-semibold mt-1" style="color:var(--primary)"></p>
                </div>
                <button onclick="AI_STATE.messages=[]; renderMessages(); document.getElementById('ai-sources').innerHTML='';" class="text-xs font-bold text-gray-400 hover:text-red-400 transition-colors bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">Rensa</button>
            </div>

            <!-- Meddelanden -->
            <div id="ai-messages" class="flex-1 overflow-y-auto p-5">
                <!-- renderas av renderMessages() -->
            </div>

            <!-- Källhänvisningar -->
            <div id="ai-sources" class="flex flex-wrap items-center gap-2 px-5 pb-2 min-h-[28px]"></div>

            <!-- Input -->
            <div class="p-4 border-t border-gray-100 bg-gray-50/60">
                <!-- Fil-upload -->
                <div id="ai-file-preview" class="hidden mb-3 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                    <span id="ai-file-name" class="text-xs font-bold text-blue-700 truncate flex-1"></span>
                    <button onclick="clearFileUpload()" class="text-blue-400 hover:text-red-400 ml-2 text-lg leading-none">×</button>
                </div>
                <div class="flex gap-3 items-end">
                    <label class="flex-shrink-0 w-10 h-10 rounded-xl border-2 border-dashed border-gray-300 hover:border-[var(--primary)] flex items-center justify-center cursor-pointer transition-colors group" title="Bifoga fil (TXT/PDF)">
                        <input id="ai-file-input" type="file" accept=".txt,.pdf,.csv" class="hidden" onchange="handleFileSelect(this)">
                        <svg class="w-5 h-5 text-gray-400 group-hover:text-[var(--primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    </label>
                    <textarea
                        id="ai-input"
                        rows="1"
                        placeholder="Ställ en fråga eller klistra in 19 produktkoder..."
                        class="flex-1 resize-none bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none transition-all font-medium"
                        style="max-height:120px; overflow-y:auto"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();handleSend();}"
                        oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"
                    ></textarea>
                    <button
                        id="ai-send-btn"
                        onclick="handleSend()"
                        class="flex-shrink-0 w-10 h-10 rounded-xl text-white flex items-center justify-center transition-all hover:scale-105 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                        style="background:var(--header-gradient)"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    </button>
                </div>
                <p class="text-[10px] text-gray-400 mt-2 text-center font-medium">Svar baseras på El-kretsens kunskapsbank · ${new Date().getFullYear()}</p>
            </div>
        </div>

        <!-- Info-panel höger -->
        <div class="w-72 flex-shrink-0 flex flex-col gap-4">

            <!-- Tips-kort -->
            <div class="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-5">
                <h3 class="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                    <span style="color:var(--primary)">💡</span> Tips för Linnea
                </h3>
                <div class="space-y-3 text-xs text-gray-600 leading-relaxed">
                    <div class="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <strong class="text-gray-800 block mb-1">📋 Många produktkoder?</strong>
                        Klistra in hela listan direkt i chatten — AI:n plockar ut relevanta koder och avgifter automatiskt.
                    </div>
                    <div class="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <strong class="text-gray-800 block mb-1">📎 Bifoga fil</strong>
                        Klicka på gem-ikonen för att ladda upp en TXT- eller PDF-fil för direkt analys.
                    </div>
                    <div class="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <strong class="text-gray-800 block mb-1">🔍 Källhänvisningar</strong>
                        Under varje svar visas vilka dokument som användes som underlag.
                    </div>
                </div>
            </div>

            <!-- Snabbsvar-kort -->
            <div class="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 p-5">
                <h3 class="font-bold text-gray-800 text-sm mb-3">⚡ Snabbfrågor</h3>
                <div class="space-y-2">
                    ${[
                        ['Batterikoder 2026', 'Förklara batterikodstrukturen för 2026 med exempel'],
                        ['B77 temporär?', 'Vad gäller för B77 och när tas den bort?'],
                        ['Förseningsavgift', 'Vad händer om vi missar en deklaration?'],
                        ['Inbyggt batteri', 'Hur deklarerar jag en produkt med inbyggt batteri?'],
                        ['P24 vs P25', 'Vad är skillnaden mellan P24 och P25?'],
                        ['Grön avgift', 'Hur ansöker man om grön avgift?'],
                    ].map(([label, prompt]) =>
                        `<button onclick="useQuickPrompt('${prompt}')"
                            class="w-full text-left text-xs font-semibold px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all bg-gray-50 hover:bg-white text-gray-600">
                            ${label}
                        </button>`
                    ).join('')}
                </div>
            </div>
        </div>
    </div>`;

    // Rendera välkomst-state
    renderMessages();

    // Ladda kunskapsbas
    loadKnowledgeBase();
}

// ── Event handlers (globalt scope för inline onclick) ──
window.handleSend = async function() {
    const input    = document.getElementById('ai-input');
    const fileInput = document.getElementById('ai-file-input');
    const text = input?.value?.trim();
    if (!text || AI_STATE.isStreaming) return;

    let fileContent = null;
    if (fileInput?.files[0]) {
        try {
            fileContent = await readUploadedFile(fileInput.files[0]);
            if (fileContent.length > 8000) fileContent = fileContent.slice(0, 8000) + '\n[...trunkerad]';
        } catch (e) { console.warn('Fil-läsfel:', e); }
    }

    input.value = '';
    input.style.height = 'auto';
    clearFileUpload();
    await sendMessage(text, fileContent);
};

window.handleFileSelect = function(input) {
    const file    = input.files[0];
    const preview = document.getElementById('ai-file-preview');
    const name    = document.getElementById('ai-file-name');
    if (!file || !preview || !name) return;
    name.textContent = `📎 ${file.name}`;
    preview.classList.remove('hidden');
};

window.clearFileUpload = function() {
    const input   = document.getElementById('ai-file-input');
    const preview = document.getElementById('ai-file-preview');
    if (input)   input.value = '';
    if (preview) preview.classList.add('hidden');
};

window.useQuickPrompt = useQuickPrompt;
window.AI_STATE       = AI_STATE;
window.renderMessages = renderMessages;
