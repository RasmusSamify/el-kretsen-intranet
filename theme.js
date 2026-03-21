// ═══════════════════════════════════════════════
//  theme.js — Temabyte
// ═══════════════════════════════════════════════

function setTheme(name) {
    document.body.setAttribute('data-theme', name);
    localStorage.setItem('user-theme', name);
}

// Applicera sparat tema direkt vid sidladdning
setTheme(localStorage.getItem('user-theme') || 'default');
