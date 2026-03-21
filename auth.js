// ═══════════════════════════════════════════════
//  auth.js — Inloggning & session
// ═══════════════════════════════════════════════

const loginScreen    = document.getElementById('login-screen');
const intranetScreen = document.getElementById('intranet-screen');
const errorMsg       = document.getElementById('error-message');

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) showIntranet();
}
checkSession();

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.auth.signInWithPassword({
        email:    document.getElementById('email').value,
        password: document.getElementById('password').value,
    });
    if (error) {
        errorMsg.textContent = 'Fel e-post eller lösenord';
        errorMsg.classList.remove('hidden');
    } else {
        showIntranet();
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    location.reload();
});

function showIntranet() {
    loginScreen.classList.add('hidden');
    intranetScreen.classList.remove('hidden');
    loadDocuments();
}
