// ═══════════════════════════════════════════════
//  documents.js — Dokumentbank (sidopanel)
// ═══════════════════════════════════════════════

const documentList = document.getElementById('document-list');
const searchInput  = document.getElementById('search-input');
const fileUpload   = document.getElementById('file-upload');
const uploadBtn    = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

function getFileIconHTML(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    let bg = 'bg-gray-100', text = 'text-gray-500';
    let icon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>`;

    if (ext === 'pdf') {
        bg = 'bg-red-50'; text = 'text-red-500';
    } else if (['xls','xlsx','csv'].includes(ext)) {
        bg = 'bg-green-50'; text = 'text-green-500';
        icon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>`;
    } else if (['doc','docx'].includes(ext)) {
        bg = 'bg-blue-50'; text = 'text-blue-500';
    } else if (['png','jpg','jpeg','gif','svg'].includes(ext)) {
        bg = 'bg-purple-50'; text = 'text-purple-500';
        icon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>`;
    } else if (['html','htm'].includes(ext)) {
        bg = 'bg-orange-50'; text = 'text-orange-500';
        icon = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>`;
    }

    return `<div class="w-10 h-10 rounded-xl ${bg} ${text} flex items-center justify-center flex-shrink-0 shadow-sm border border-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>
    </div>`;
}

async function loadDocuments() {
    if (!documentList) return;
    documentList.innerHTML = '<li class="text-sm text-gray-500 py-10 text-center font-bold animate-pulse">Hämtar dokument...</li>';
    const { data, error } = await supabaseClient.storage.from(BUCKET_DOCUMENTS).list();
    if (error) { documentList.innerHTML = '<li class="text-sm text-red-500 py-10 text-center">Kunde inte hämta dokument.</li>'; return; }
    documentList.innerHTML = '';
    if (!data || data.length === 0) { documentList.innerHTML = '<li class="text-sm text-gray-400 py-10 text-center">Inga dokument uppladdade ännu.</li>'; return; }

    data.forEach(file => {
        if (file.name === '.emptyFolderPlaceholder') return;
        const { data: urlData } = supabaseClient.storage.from(BUCKET_DOCUMENTS).getPublicUrl(file.name);
        const li = document.createElement('li');
        li.className = 'doc-item';
        li.innerHTML = `
            <a class="flex items-center p-3 bg-white rounded-2xl border border-gray-100 hover:border-[var(--primary)] hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
                ${getFileIconHTML(file.name)}
                <div class="flex-1 min-w-0 ml-3">
                    <p class="font-bold text-sm truncate text-gray-800 group-hover:text-[var(--primary)] transition-colors">${file.name}</p>
                    <p class="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">Läs dokument</p>
                </div>
                <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </a>`;
        li.querySelector('a').addEventListener('click', async () => {
            if (file.name.endsWith('.html')) {
                const html = await (await fetch(urlData.publicUrl)).text();
                window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
            } else {
                window.open(urlData.publicUrl, '_blank');
            }
        });
        documentList.appendChild(li);
    });
}

if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
        const file = fileUpload.files[0];
        if (!file) { showUploadStatus('Välj en fil först!', 'text-red-500'); return; }
        showUploadStatus('Laddar upp...', 'text-gray-500');
        uploadBtn.disabled = true;
        const contentType = file.name.endsWith('.html') ? 'text/html' : file.type;
        const { error } = await supabaseClient.storage.from(BUCKET_DOCUMENTS).upload(file.name, file, { cacheControl: '3600', upsert: true, contentType });
        uploadBtn.disabled = false;
        if (error) { showUploadStatus('Fel: ' + error.message, 'text-red-500'); }
        else {
            showUploadStatus('Uppladdning lyckades!', 'text-green-500');
            fileUpload.value = '';
            loadDocuments();
            setTimeout(() => uploadStatus.classList.add('hidden'), 3000);
        }
    });
}

function showUploadStatus(msg, colorClass) {
    if (uploadStatus) {
        uploadStatus.textContent = msg;
        uploadStatus.className = `text-xs mt-2 block ${colorClass}`;
        uploadStatus.classList.remove('hidden');
    }
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.doc-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(term) ? 'block' : 'none';
        });
    });
}
