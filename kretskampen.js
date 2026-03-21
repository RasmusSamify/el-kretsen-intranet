// ═══════════════════════════════════════════════
//  kretskampen.js — Quiz-app (React/JSX via Babel)
//  Laddas med: <script type="text/babel" data-presets="react" src="components/kretskampen.js">
// ═══════════════════════════════════════════════

const KNOWLEDGE_BASE_URL = 'https://jnwatbnkdzuyhqmcerej.supabase.co/storage/v1/object/sign/Quiz%20dokument/Elkretsen_Kunskapsbas_Samlad_Quiz.txt?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMDg2ZWVkMy1mZDdhLTQ0NWYtOTY5OS1iMDViNDE1NDI5MzciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJRdWl6IGRva3VtZW50L0Vsa3JldHNlbl9LdW5za2Fwc2Jhc19TYW1sYWRfUXVpei50eHQiLCJpYXQiOjE3NzI2NTI2NzYsImV4cCI6NDkyNjI1MjY3Nn0.3zkcFjaJmwLPFEoWa9sJx15eq2xil9NiteRPb76mtKQ';

async function getKnowledgeBase() {
    const response = await fetch(KNOWLEDGE_BASE_URL);
    return await response.text();
}

const CATEGORIES = [
    { id: 'all', label: 'Alla kategorier', emoji: '⚡' },
    { id: 'C',   label: 'EU & Reglering',  emoji: '🇪🇺' },
    { id: 'A',   label: 'Ekonomi',          emoji: '💰' },
    { id: 'B',   label: 'Teknik',           emoji: '🔧' },
    { id: 'D',   label: 'Juridik',          emoji: '⚖️' },
];

const ANSWER_COLORS = ['#EF4444','#3B82F6','#22C55E','#F59E0B'];
const ANSWER_ICONS  = ['▲','◆','●','✦'];
const TIME_PER_Q    = 20;

async function generateQuestions(category, count) {
    const kb = await getKnowledgeBase();
    const seed = new Date().getTime();
    const catLabel = category === 'all' ? 'alla kategorier' : CATEGORIES.find(c => c.id === category)?.label;
    const prompt = `SESSION: ${seed}. Skapa ${count} flervalsfrågor på SVENSKA om: ${catLabel}. Plocka frågor från HELA dokumentet, sprid ut dem! Kunskapsbas: ${kb}. Svara i JSON: { "questions": [ { "question": "Text?", "answers": ["A","B","C","D"], "correct": 0, "explanation": "Varför?" } ] }`;

    const res = await fetch('https://jnwatbnkdzuyhqmcerej.supabase.co/functions/v1/smooth-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return JSON.parse(text.replace(/```json|```/g, '').trim()).questions;
}

function calcScore(timeLeft, correct) {
    return correct ? Math.round(500 + (timeLeft / TIME_PER_Q) * 500) : 0;
}

function TimerRing({ timeLeft, total }) {
    const r = 34, cx = 42, cy = 42, circ = 2 * Math.PI * r;
    const offset = circ * (1 - timeLeft / total);
    const color = timeLeft > 10 ? 'var(--primary)' : timeLeft > 5 ? '#F59E0B' : '#EF4444';
    return (
        <div style={{ position:'relative', width:84, height:84 }}>
            <svg width="84" height="84" style={{ transform:'rotate(-90deg)' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E7EB" strokeWidth={6}/>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s linear' }}/>
            </svg>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:900, color:"#111827", fontFamily:"'Barlow Condensed'" }}>{timeLeft}</div>
        </div>
    );
}

function KretskampenApp() {
    const [screen,    setScreen]    = React.useState('home');
    const [questions, setQuestions] = React.useState([]);
    const [player,    setPlayer]    = React.useState('');
    const [score,     setScore]     = React.useState(0);
    const [category,  setCategory]  = React.useState('all');

    const startQuiz = async (name, cat, count) => {
        setPlayer(name); setCategory(cat); setScreen('loading');
        try {
            const qs = await generateQuestions(cat, count);
            setQuestions(qs); setScreen('quiz');
        } catch(e) { alert('Fel vid AI-generering: ' + e.message); setScreen('home'); }
    };

    const finishQuiz = async (finalScore, hist) => {
        setScore(finalScore); setScreen('result');
        const correctCount = hist.filter(h => h.correct).length;
        await supabaseClient.from('kretskampen_scores').insert([{
            name: player, score: finalScore, correct: correctCount,
            total: questions.length, category, played_at: new Date().toISOString()
        }]);
    };

    if (screen === 'home') return (
        <div className="flex flex-col items-center py-12 px-4 h-full relative z-10">
            <div className="kk-card bg-white/90 backdrop-blur-xl border border-white/50">
                <div className="text-center mb-8">
                    <h2 className="text-5xl font-black italic uppercase drop-shadow-sm" style={{fontFamily:"'Barlow Condensed',sans-serif", color:'var(--primary)'}}>⚡ Kretskampen</h2>
                    <p className="text-gray-600 font-medium">Utmana kollegorna i El-kretsens stora kunskapskamp!</p>
                </div>
                <div className="mb-6">
                    <label className="kk-label">Ditt Namn</label>
                    <input className="kk-input" value={player} onChange={e=>setPlayer(e.target.value)} placeholder="T.ex. Linnea..." maxLength="20" />
                </div>
                <div className="mb-6">
                    <label className="kk-label">Kategori</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CATEGORIES.map(cat => (
                            <button key={cat.id} className={`kk-cat-btn ${category === cat.id ? 'selected' : ''}`} onClick={()=>setCategory(cat.id)} style={{marginBottom:0}}>
                                {cat.emoji} {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
                <button className="kk-primary-btn mb-4 text-xl py-4 shadow-xl" disabled={!player.trim()} onClick={()=>startQuiz(player, category, 10)}>Starta Kampen 🚀</button>
                <button onClick={()=>setScreen('leaderboard')} className="w-full text-sm font-bold uppercase text-gray-500 hover:text-gray-800 transition-colors py-2">Visa Highscore 🏆</button>
            </div>
        </div>
    );

    if (screen === 'loading') return (
        <div className="flex flex-col items-center justify-center py-20 relative z-10">
            <div className="bg-white/90 backdrop-blur-xl border border-white/50 p-10 rounded-3xl shadow-2xl text-center max-w-sm w-full">
                <div className="flex justify-center gap-1 mb-6">
                    <span className="kk-dot"></span><span className="kk-dot"></span><span className="kk-dot"></span>
                </div>
                <p className="font-black italic uppercase tracking-widest text-xl" style={{fontFamily:"'Barlow Condensed',sans-serif",color:'var(--primary)'}}>AI laddar dokumentet...</p>
                <p className="text-gray-500 font-medium text-sm mt-2">Letar upp kluriga frågor åt {player}</p>
            </div>
        </div>
    );

    if (screen === 'quiz') return (
        <div className="relative z-10 py-6 px-4 flex-1 overflow-auto flex flex-col items-center">
            <QuizWindow questions={questions} player={player} onFinish={finishQuiz} />
        </div>
    );

    if (screen === 'result') return (
        <div className="flex flex-col items-center py-12 relative z-10">
            <div className="kk-card text-center bg-white/90 backdrop-blur-xl border border-white/50">
                <div className="text-7xl mb-4 drop-shadow-md" style={{animation:'kk-pop 0.5s ease'}}>🏆</div>
                <h2 className="text-3xl font-bold mb-2 text-gray-800">Snyggt jobbat, {player}!</h2>
                <div className="p-8 rounded-3xl my-8 shadow-inner border border-gray-100 bg-gray-50">
                    <div className="text-sm uppercase font-black mb-1 text-gray-500">Din Slutpoäng</div>
                    <div className="text-6xl font-black drop-shadow-sm" style={{fontFamily:"'Barlow Condensed',sans-serif",color:'var(--primary)'}}>{score.toLocaleString()}</div>
                </div>
                <button className="kk-primary-btn mb-4 py-4 text-lg shadow-xl" onClick={()=>setScreen('leaderboard')}>Se var du hamnade 🏅</button>
                <button className="w-full text-sm font-bold uppercase text-gray-500 hover:text-gray-800 py-2" onClick={()=>setScreen('home')}>Spela igen</button>
            </div>
        </div>
    );

    if (screen === 'leaderboard') return (
        <div className="relative z-10 py-8 h-full">
            <Leaderboard onBack={()=>setScreen(score > 0 ? 'result' : 'home')} player={player} score={score} />
        </div>
    );
}

function QuizWindow({ questions, player, onFinish }) {
    const [idx,      setIdx]      = React.useState(0);
    const [score,    setScore]    = React.useState(0);
    const [selected, setSelected] = React.useState(null);
    const [history,  setHistory]  = React.useState([]);
    const [timeLeft, setTimeLeft] = React.useState(TIME_PER_Q);
    const timerRef = React.useRef();
    const q = questions[idx];

    const handleAns = (i) => {
        if (selected !== null) return;
        clearInterval(timerRef.current);
        setSelected(i);
        const correct = i === q.correct;
        const gained  = calcScore(timeLeft, correct);
        setScore(s => s + gained);
        setHistory(h => [...h, { gained, correct, timeLeft }]);
    };

    React.useEffect(() => {
        setSelected(null); setTimeLeft(TIME_PER_Q);
        timerRef.current = setInterval(() => {
            setTimeLeft(t => { if(t <= 1){ clearInterval(timerRef.current); handleAns(-1); return 0; } return t - 1; });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [idx]);

    return (
        <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col">
            <div className="bg-white p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center z-10 shadow-sm">
                <div>
                    <div className="text-xs uppercase font-bold text-gray-400 tracking-wider" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Fråga {idx+1}/{questions.length}</div>
                    <div className="text-xl font-bold text-gray-900" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{player}</div>
                </div>
                <TimerRing timeLeft={timeLeft} total={TIME_PER_Q} />
                <div className="text-right">
                    <div className="text-xs uppercase font-bold text-gray-400 tracking-wider" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Poäng</div>
                    <div className="text-3xl font-black text-gray-900" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>{score.toLocaleString()}</div>
                </div>
            </div>
            <div className="p-6 sm:p-8 flex-1 bg-gray-50/50">
                <h3 className="text-xl sm:text-2xl font-bold mb-8 text-center leading-relaxed text-gray-900">{q.question}</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {q.answers.map((a, i) => {
                        let btnStyle = { background:'white', color:'#1F2937', border:'2px solid #E5E7EB' };
                        if (selected !== null) {
                            if (i === q.correct) btnStyle = { background:'#10B981', color:'white', border:'2px solid #059669', transform:'scale(1.02)' };
                            else if (i === selected) btnStyle = { background:'#EF4444', color:'white', border:'2px solid #B91C1C', opacity:0.9 };
                            else btnStyle = { background:'white', color:'#9CA3AF', border:'2px solid #F3F4F6', opacity:0.5 };
                        }
                        return (
                            <button key={i} onClick={()=>handleAns(i)} disabled={selected !== null}
                                className="flex flex-col p-5 rounded-2xl transition-all duration-200 shadow-sm text-left"
                                style={btnStyle}>
                                <div style={{fontSize:26, marginBottom:8, opacity:0.9}}>{ANSWER_ICONS[i]}</div>
                                <div style={{fontSize:16, fontWeight:700, lineHeight:1.4}}>{a}</div>
                            </button>
                        );
                    })}
                </div>
                {selected !== null && (
                    <div className="kk-fadein rounded-2xl border-l-4 overflow-hidden shadow-lg bg-white mt-8"
                        style={{borderColor: selected === q.correct ? '#10B981' : '#EF4444'}}>
                        <div className="p-5" style={{background: selected === q.correct ? '#ECFDF5' : '#FEF2F2'}}>
                            <div className="flex justify-between items-center mb-2">
                                <div style={{fontWeight:800, fontSize:18, color: selected === q.correct ? '#059669' : '#B91C1C'}}>
                                    {selected === q.correct ? '🎉 Rätt svar!' : selected === -1 ? '⏱ Tiden var ute!' : '❌ Tyvärr fel'}
                                </div>
                                {selected === q.correct && (
                                    <div className="font-black text-green-800 bg-green-200 px-3 py-1.5 rounded-full text-sm shadow-sm">
                                        +{history[history.length-1]?.gained} p
                                    </div>
                                )}
                            </div>
                            <div className="text-gray-800 leading-relaxed font-medium text-sm sm:text-base">{q.explanation}</div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <button className="kk-primary-btn py-3 shadow-md" onClick={()=>{ idx < questions.length-1 ? setIdx(idx+1) : onFinish(score, history); }}>
                                {idx < questions.length-1 ? 'Nästa fråga →' : 'Se Resultat 🏆'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Leaderboard({ onBack, player, score }) {
    const [list, setList] = React.useState([]);
    React.useEffect(() => {
        supabaseClient.from('kretskampen_scores').select('*').order('score',{ascending:false}).limit(50)
            .then(({data}) => setList(data || []));
    }, []);

    return (
        <div className="flex flex-col items-center px-4 h-full">
            <div className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50 flex flex-col h-full max-h-[850px]">
                <div className="p-6 sm:p-8 text-white text-center relative shadow-lg z-10" style={{background:'var(--header-gradient)'}}>
                    <button onClick={onBack} className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-sm uppercase opacity-90 hover:opacity-100 bg-black/20 px-3 py-2 rounded-xl transition-all shadow-inner border border-white/10 text-white">← Tillbaka</button>
                    <h2 className="text-4xl sm:text-5xl font-black italic uppercase tracking-wider drop-shadow-md text-white" style={{fontFamily:"'Barlow Condensed',sans-serif"}}>Hjältar 🏅</h2>
                    <p className="text-sm sm:text-base font-bold opacity-80 mt-2 tracking-widest uppercase text-white">Topp 50 hos El-kretsen</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50/50 space-y-3">
                    {list.length === 0
                        ? <div className="text-center py-20 text-gray-500 font-bold text-lg animate-pulse">Laddar resultat...</div>
                        : list.map((s, i) => {
                            const isMe = s.name === player && s.score === score && score > 0;
                            const rankClass = i === 0 ? 'kk-rank-gold shadow-md' : i === 1 ? 'kk-rank-silver shadow-md' : i === 2 ? 'kk-rank-bronze shadow-md' : 'shadow-sm';
                            const catEmoji = CATEGORIES.find(c => c.id === s.category)?.emoji || '⚡';
                            return (
                                <div key={i} className={`kk-score-row ${rankClass}`} style={isMe ? {borderColor:'var(--primary)',borderWidth:'2px',boxShadow:'0 8px 25px rgba(0,0,0,0.1)',transform:'scale(1.02)'} : {}}>
                                    <div className="text-3xl font-black italic w-12 text-center" style={{fontFamily:"'Barlow Condensed',sans-serif",color:i<3?'#475569':'#94A3B8'}}>
                                        {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                                    </div>
                                    <div className="flex-1 ml-2">
                                        <div className="font-black text-gray-800 text-lg flex items-center gap-2">
                                            {s.name}
                                            {isMe && <span className="text-white text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider hidden sm:inline-block shadow-sm" style={{background:'var(--primary)'}}>Det är du!</span>}
                                        </div>
                                        <div className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">
                                            {catEmoji} {s.correct}/{s.total} rätt <span className="mx-1 opacity-50">•</span> {new Date(s.played_at).toLocaleDateString('sv-SE',{day:'numeric',month:'short'})}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black italic drop-shadow-sm" style={{fontFamily:"'Barlow Condensed',sans-serif",color:'var(--primary)'}}>{s.score.toLocaleString()}</div>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}

window.KretskampenApp = KretskampenApp;
