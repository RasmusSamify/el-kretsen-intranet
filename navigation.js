// ═══════════════════════════════════════════════
//  navigation.js — Fliknavigering
// ═══════════════════════════════════════════════

let quizMounted = false;
let aiMounted   = false;

function switchTab(tab) {
    const tabs     = ['elvis', 'ai', 'kretskampen'];
    const contents = {};
    const buttons  = {};

    tabs.forEach(t => {
        contents[t] = document.getElementById(`content-${t}`);
        buttons[t]  = document.getElementById(`tab-${t}`);
    });

    tabs.forEach(t => {
        contents[t].classList.toggle('hidden', t !== tab);
        buttons[t].classList.toggle('active', t === tab);
    });

    // Lazy-mount AI-assistenten första gången fliken öppnas
    if (tab === 'ai' && !aiMounted) {
        aiMounted = true;
        initAIAssistant();
    }

    // Lazy-mount Kretskampen (React)
    if (tab === 'kretskampen' && !quizMounted) {
        quizMounted = true;
        ReactDOM.createRoot(document.getElementById('quiz-root'))
            .render(React.createElement(window.KretskampenApp));
    }
}
