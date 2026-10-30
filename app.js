import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    onAuthStateChanged, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
    getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    doc, onSnapshot, setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCXao0he_pS1dquJPGRbkjhFeeWPkQqxsw",
    authDomain: "gestorfaturas-4e199.firebaseapp.com",
    projectId: "gestorfaturas-4e199",
    storageBucket: "gestorfaturas-4e199.firebasestorage.app",
    messagingSenderId: "779508869408",
    appId: "1:779508869408:web:c1883d5d22832f1c254f45"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
let db;
try {
    // Cache offline compartilhado entre abas (a API antiga enableMultiTabIndexedDbPersistence está obsoleta).
    db = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
    db = getFirestore(fbApp);
}

const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;

/* ============================================================
   Constantes e utilitários
   ============================================================ */
const APP_VERSION = '2.0';
const COLOR_PALETTE = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#ea580c', '#16a34a', '#2563eb', '#9333ea'];
const CARD_COLORS = ['#4338ca', '#0f766e', '#be123c', '#b45309', '#1d4ed8', '#7e22ce', '#0f172a', '#047857'];
const DEFAULT_CARD_COLOR = CARD_COLORS[0];

const CATEGORIES = [
    { id: 'mercado',     name: 'Mercado',     icon: '🛒', color: '#16a34a', kw: ['mercado', 'supermercado', 'atacad', 'padaria', 'hortifruti', 'feira', 'açougue', 'acougue'] },
    { id: 'alimentacao', name: 'Alimentação', icon: '🍔', color: '#ea580c', kw: ['restaurante', 'lanche', 'almoço', 'almoco', 'jantar', 'pizza', 'ifood', 'café', 'cafe', 'hamburg', 'sorvete', 'bar '] },
    { id: 'transporte',  name: 'Transporte',  icon: '🚗', color: '#2563eb', kw: ['uber', '99', 'gasolina', 'combust', 'posto', 'estacion', 'pedágio', 'pedagio', 'ônibus', 'onibus', 'metrô', 'metro'] },
    { id: 'saude',       name: 'Saúde',       icon: '💊', color: '#e11d48', kw: ['farmácia', 'farmacia', 'drogaria', 'médico', 'medico', 'consulta', 'exame', 'dentista', 'plano de saúde', 'hospital'] },
    { id: 'assinaturas', name: 'Assinaturas', icon: '🔁', color: '#7c3aed', kw: ['netflix', 'spotify', 'disney', 'prime', 'youtube', 'hbo', 'max', 'icloud', 'assinatura', 'globoplay', 'deezer'] },
    { id: 'lazer',       name: 'Lazer',       icon: '🎬', color: '#db2777', kw: ['cinema', 'show', 'ingresso', 'jogo', 'game', 'steam', 'teatro', 'parque', 'clube'] },
    { id: 'casa',        name: 'Casa',        icon: '🏠', color: '#b45309', kw: ['aluguel', 'condom', 'luz', 'energia', 'água', 'agua', 'internet', 'gás', 'gas', 'móveis', 'moveis', 'geladeira', 'reforma'] },
    { id: 'compras',     name: 'Compras',     icon: '🛍️', color: '#0891b2', kw: ['amazon', 'shopee', 'mercado livre', 'magalu', 'shein', 'roupa', 'tênis', 'tenis', 'sapato', 'loja', 'americanas'] },
    { id: 'educacao',    name: 'Educação',    icon: '📚', color: '#4f46e5', kw: ['curso', 'escola', 'faculdade', 'livro', 'mensalidade', 'udemy', 'apostila'] },
    { id: 'viagem',      name: 'Viagem',      icon: '✈️', color: '#0d9488', kw: ['passagem', 'hotel', 'hospedagem', 'airbnb', 'voo', 'viagem', 'booking', 'latam', 'gol ', 'azul'] },
    { id: 'outros',      name: 'Outros',      icon: '📦', color: '#64748b', kw: [] }
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const getCategory = (id) => CATEGORY_MAP[id] || CATEGORY_MAP.outros;
const suggestCategory = (text, type) => {
    const t = ' ' + (text || '').toLowerCase() + ' ';
    for (const c of CATEGORIES) if (c.kw.some(k => t.includes(k))) return c.id;
    return type === 'subscription' ? 'assinaturas' : 'outros';
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthOf = (iso) => iso.slice(0, 7);
const parseMonth = (m) => m.split('-').map(Number);
const addMonths = (yyyyMM, n) => {
    const [y, m] = parseMonth(yyyyMM);
    const idx = y * 12 + (m - 1) + n;
    return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
};
const monthDiff = (a, b) => { const [ya, ma] = parseMonth(a); const [yb, mb] = parseMonth(b); return (yb - ya) * 12 + (mb - ma); };
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const toCents = (v) => Math.round((Number(v) || 0) * 100);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Divide em parcelas sem perder centavos: as primeiras absorvem o resto.
const splitCents = (total, n) => {
    const base = Math.floor(total / n);
    const rest = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
};

const AUTH_ERRORS = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'Este e-mail já tem uma conta. Use “Entrar”.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet.'
};

createApp({
    setup() {
        /* ---------- Estado de autenticação ---------- */
        const user = ref(null);
        const authReady = ref(false);
        const loading = ref(false);
        const authMode = ref('login');
        const authForm = reactive({ email: '', password: '' });
        const showPassword = ref(false);

        /* ---------- UI ---------- */
        const currentTab = ref('home');
        const viewMonth = ref(todayISO().slice(0, 7));
        const cardFilter = ref('all');
        const searchQuery = ref('');
        const personFilter = ref('all');
        const categoryFilter = ref('all');
        const visibleCount = ref(30);
        const profileModalOpen = ref(false);
        const online = ref(navigator.onLine);
        const syncStatus = ref('idle'); // idle | syncing | error

        /* ---------- Dados (sincronizados) ---------- */
        const cards = ref([]);
        const people = ref(['Eu']);
        const transactions = ref([]);
        const payments = ref({});
        const personColors = ref({});
        const userPixKey = ref('');

        /* ---------- Preferências locais ---------- */
        const themePref = ref(localStorage.getItem('theme') || 'auto');
        const groqApiKey = ref(localStorage.getItem('groq_api_key') || '');
        const groqModel = ref(localStorage.getItem('groq_model') || 'openai/gpt-oss-120b');
        const groqAutoConfirm = ref(localStorage.getItem('groq_auto_confirm') !== 'false');
        const showGroqKey = ref(false);
        const groqTesting = ref(false);

        const ownerName = computed(() => people.value[0] || 'Eu');

        /* ============================================================
           Tema
           ============================================================ */
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = () => {
            const dark = themePref.value === 'dark' || (themePref.value === 'auto' && mql.matches);
            document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0e1a' : '#f4f5fa');
        };
        const setTheme = (t) => { themePref.value = t; localStorage.setItem('theme', t); applyTheme(); };
        mql.addEventListener?.('change', applyTheme);
        applyTheme();

        /* ============================================================
           Toast (com ação opcional, ex.: Desfazer)
           ============================================================ */
        const toast = reactive({ show: false, message: '', type: 'info', action: null });
        let toastTimer = null;
        const showToast = (message, type = 'info', action = null) => {
            clearTimeout(toastTimer);
            Object.assign(toast, { message, type, action, show: true });
            toastTimer = setTimeout(() => { toast.show = false; }, action ? 6000 : 3000);
        };
        const runToastAction = () => { const fn = toast.action?.fn; toast.show = false; fn?.(); };

        const confirmDialog = reactive({ show: false, title: '', message: '', confirmLabel: 'Confirmar', danger: true, onConfirm: null });
        const askConfirm = (title, message, onConfirm, { label = 'Confirmar', danger = true } = {}) => {
            Object.assign(confirmDialog, { show: true, title, message, confirmLabel: label, danger, onConfirm: () => { confirmDialog.show = false; onConfirm(); } });
        };
        const promptDialog = reactive({ show: false, title: '', message: '', value: '', onConfirm: null });

        /* ============================================================
           Sincronização com o Firestore
           (sem "eco": só envia quando o estado local realmente mudou)
           ============================================================ */
        let unsubscribeStore = null;
        let cloudReady = false;
        let lastSynced = '';
        let pushTimer = null;

        const docRefFor = (uid_) => doc(db, 'artifacts', 'gestor-faturas', 'users', uid_, 'appData', 'main');
        const buildPayload = () => ({
            cards: cards.value,
            people: people.value,
            transactions: transactions.value,
            payments: payments.value,
            personColors: personColors.value,
            pixKey: userPixKey.value,
            groqApiKey: groqApiKey.value,
            groqModel: groqModel.value,
            groqAutoConfirm: groqAutoConfirm.value
        });
        const fingerprint = () => JSON.stringify(buildPayload());

        const resetLocalData = () => {
            cards.value = []; people.value = ['Eu']; transactions.value = []; payments.value = {};
            personColors.value = {}; userPixKey.value = '';
        };

        const startSync = (uid_) => {
            cloudReady = false;
            unsubscribeStore = onSnapshot(docRefFor(uid_), (snap) => {
                if (snap.metadata.hasPendingWrites) return; // eco da nossa própria escrita
                if (snap.exists()) {
                    const d = snap.data();
                    cards.value = d.cards || [];
                    people.value = d.people?.length ? d.people : ['Eu'];
                    transactions.value = d.transactions || [];
                    payments.value = d.payments || {};
                    personColors.value = d.personColors || {};
                    userPixKey.value = d.pixKey || '';
                    if (d.groqApiKey && !groqApiKey.value) groqApiKey.value = d.groqApiKey;
                    if (d.groqModel) groqModel.value = d.groqModel;
                    if (d.groqAutoConfirm !== undefined) groqAutoConfirm.value = d.groqAutoConfirm;
                    lastSynced = fingerprint();
                    cloudReady = true;
                } else if (!snap.metadata.fromCache) {
                    // Conta nova: o servidor confirmou que não há dados.
                    lastSynced = fingerprint();
                    cloudReady = true;
                }
            }, (err) => {
                console.error('Falha ao ouvir a nuvem:', err);
                showToast('Não foi possível sincronizar com a nuvem.', 'error');
            });
        };

        const pushToCloud = async () => {
            clearTimeout(pushTimer);
            if (!user.value || !cloudReady) return;
            const fp = fingerprint();
            if (fp === lastSynced) return;
            syncStatus.value = 'syncing';
            try {
                await setDoc(docRefFor(user.value.uid), { ...buildPayload(), updatedAt: new Date().toISOString() });
                lastSynced = fp;
                syncStatus.value = 'idle';
            } catch (e) {
                console.error('Erro ao sincronizar com a nuvem:', e);
                syncStatus.value = 'error';
            }
        };

        watch([cards, people, transactions, payments, personColors, userPixKey, groqApiKey, groqModel, groqAutoConfirm], () => {
            if (!cloudReady || fingerprint() === lastSynced) return;
            clearTimeout(pushTimer);
            pushTimer = setTimeout(pushToCloud, 700);
        }, { deep: true });

        // Garante que alterações recentes saiam antes de o app ser fechado/minimizado.
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushToCloud(); });
        window.addEventListener('pagehide', () => pushToCloud());
        window.addEventListener('online', () => { online.value = true; pushToCloud(); });
        window.addEventListener('offline', () => { online.value = false; });

        const syncLabel = computed(() => {
            if (!online.value) return 'Offline · salvo no aparelho';
            if (syncStatus.value === 'syncing') return 'Sincronizando…';
            if (syncStatus.value === 'error') return 'Erro ao sincronizar';
            return 'Sincronizado';
        });
        const syncDotClass = computed(() => !online.value || syncStatus.value === 'error' ? 'off' : (syncStatus.value === 'syncing' ? 'busy' : ''));

        /* ============================================================
           Autenticação
           ============================================================ */
        const handleAuth = async () => {
            loading.value = true;
            try {
                if (authMode.value === 'login') {
                    await signInWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
                    showToast('Bem-vindo de volta!', 'success');
                } else {
                    await createUserWithEmailAndPassword(auth, authForm.email.trim(), authForm.password);
                    showToast('Conta criada com sucesso!', 'success');
                }
                authForm.password = '';
            } catch (e) {
                showToast(AUTH_ERRORS[e.code] || 'Não foi possível entrar. Tente novamente.', 'error');
            } finally {
                loading.value = false;
            }
        };

        const resetPassword = async () => {
            const email = authForm.email.trim();
            if (!email) { showToast('Digite seu e-mail para receber o link.', 'error'); return; }
            try {
                await sendPasswordResetEmail(auth, email);
                showToast('Enviamos um link de redefinição para o seu e-mail.', 'success');
            } catch (e) {
                showToast(AUTH_ERRORS[e.code] || 'Não foi possível enviar o e-mail.', 'error');
            }
        };

        const logout = async () => {
            await pushToCloud();
            profileModalOpen.value = false;
            await signOut(auth);
            showToast('Sessão encerrada.', 'info');
        };

        onMounted(() => {
            onAuthStateChanged(auth, (u) => {
                if (unsubscribeStore) { unsubscribeStore(); unsubscribeStore = null; }
                clearTimeout(pushTimer);
                cloudReady = false;
                user.value = u;
                authReady.value = true;
                if (u) startSync(u.uid);
                else resetLocalData(); // evita vazar dados de uma conta para outra
            });
        });

        /* ============================================================
           Formatação
           ============================================================ */
        const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        const formatMoney = (v) => moneyFmt.format(v || 0);
        const formatCents = (c) => moneyFmt.format((c || 0) / 100);
        const formatDate = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; };
        const formatMonthLabel = (m) => {
            if (!m) return '';
            const [y, mo] = parseMonth(m);
            return cap(new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
        };
        const formatMonthShort = (m) => { const [y, mo] = parseMonth(m); return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); };
        const formatDayLabel = (iso) => {
            const today = todayISO();
            const [y, m, d] = iso.split('-').map(Number);
            const yest = new Date(); yest.setDate(yest.getDate() - 1);
            const yestISO = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
            if (iso === today) return 'Hoje';
            if (iso === yestISO) return 'Ontem';
            return cap(new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''));
        };
        const formatDuration = (sec) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;

        const hashColor = (name) => {
            let h = 0;
            for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
            return COLOR_PALETTE[h % COLOR_PALETTE.length];
        };
        // Sem efeitos colaterais: pode ser chamada no template com segurança.
        const getPersonColor = (name) => personColors.value[name] || hashColor(name || '?');
        const getCardName = (id) => cards.value.find(c => c.id === id)?.name || 'Cartão removido';
        const getCardColor = (id) => cards.value.find(c => c.id === id)?.color || DEFAULT_CARD_COLOR;
        const initial = (s) => (s || '?').trim().charAt(0).toUpperCase();

        /* ============================================================
           Motor de faturas
           ============================================================ */
        // Mês (AAAA-MM) do vencimento da fatura em que a compra cai.
        const getInvoiceMonth = (purchaseISO, closingDay, dueDay) => {
            const [y, m, d] = purchaseISO.split('-').map(Number);
            const closing = Math.min(Math.max(Number(closingDay) || 31, 1), daysInMonth(y, m));
            let offset = 0;
            if (d >= closing) offset++;
            if ((Number(dueDay) || 10) <= (Number(closingDay) || 31)) offset++;
            return addMonths(`${y}-${pad(m)}`, offset);
        };

        const projectedInvoices = computed(() => {
            const invs = {};
            const ensure = (m) => (invs[m] ??= { charges: 0, debt: 0, total: 0, byPerson: {}, byCard: {}, byCategory: {} });
            const ensurePerson = (m, p) => (ensure(m).byPerson[p] ??= { total: 0, items: [] });
            const cardMap = new Map(cards.value.map(c => [c.id, c]));
            const curMonth = monthOf(todayISO());

            for (const tx of transactions.value) {
                const card = cardMap.get(tx.cardId);
                if (!card || !tx.date) continue;
                const start = getInvoiceMonth(tx.date, card.closingDay, card.dueDay);
                const totalC = toCents(tx.amount);
                let parts;
                if (tx.type === 'installment') {
                    parts = splitCents(totalC, Math.max(2, parseInt(tx.installments) || 2));
                } else if (tx.type === 'subscription') {
                    const limit = tx.endMonth || addMonths(curMonth, 12);
                    parts = Array(Math.max(1, monthDiff(start, limit) + 1)).fill(totalC);
                } else {
                    parts = [totalC];
                }
                const category = tx.category || 'outros';
                parts.forEach((val, i) => {
                    const m = addMonths(start, i);
                    const inv = ensure(m);
                    const p = ensurePerson(m, tx.person);
                    inv.charges += val; inv.total += val; p.total += val;
                    inv.byCard[card.id] = (inv.byCard[card.id] || 0) + val;
                    inv.byCategory[category] = (inv.byCategory[category] || 0) + val;
                    p.items.push({
                        id: tx.id, desc: tx.description, amount: val, isDebt: false,
                        parcelaInfo: tx.type === 'installment' ? `${i + 1}/${parts.length}` : '',
                        cardId: card.id, category, person: tx.person
                    });
                });
            }

            // Saldo devedor: fatura não paga rola para o mês seguinte.
            const keys = Object.keys(invs).sort();
            if (keys.length) {
                const stopAt = addMonths(curMonth, 2);
                for (let m = keys[0]; m < stopAt; m = addMonths(m, 1)) {
                    if (!invs[m]) continue;
                    const next = addMonths(m, 1);
                    for (const [person, pd] of Object.entries(invs[m].byPerson)) {
                        if (payments.value[m]?.[person] || pd.total <= 0) continue;
                        const target = ensurePerson(next, person);
                        const [yy, mm] = parseMonth(m);
                        target.items.unshift({ id: `debt-${m}-${person}`, desc: `Saldo anterior de ${pad(mm)}/${yy}`, amount: pd.total, isDebt: true });
                        target.total += pd.total;
                        invs[next].debt += pd.total;
                        invs[next].total += pd.total;
                    }
                }
            }
            return invs;
        });

        const navigateMonth = (delta) => { viewMonth.value = addMonths(viewMonth.value, delta); };
        const goToday = () => { viewMonth.value = todayISO().slice(0, 7); };
        const isCurrentMonth = computed(() => viewMonth.value === todayISO().slice(0, 7));

        const currentInv = computed(() => projectedInvoices.value[viewMonth.value] || null);

        /* ---------- Painel (Início) ---------- */
        const dash = computed(() => {
            const inv = currentInv.value;
            const prev = projectedInvoices.value[addMonths(viewMonth.value, -1)];
            const charges = inv?.charges || 0;
            const prevCharges = prev?.charges || 0;
            const delta = prevCharges > 0 ? Math.round(((charges - prevCharges) / prevCharges) * 100) : null;

            const mine = inv?.byPerson[ownerName.value];
            const minePaid = !!payments.value[viewMonth.value]?.[ownerName.value];
            let receivable = 0, debtors = 0;
            if (inv) {
                for (const [name, d] of Object.entries(inv.byPerson)) {
                    if (name === ownerName.value || payments.value[viewMonth.value]?.[name]) continue;
                    receivable += d.total; debtors++;
                }
            }

            const catTotal = charges || 1;
            const categories = Object.entries(inv?.byCategory || {})
                .map(([id, amount]) => ({ ...getCategory(id), amount, pct: Math.round((amount / catTotal) * 100) }))
                .sort((a, b) => b.amount - a.amount);

            const trendMonths = Array.from({ length: 6 }, (_, i) => addMonths(viewMonth.value, i - 5));
            const trendVals = trendMonths.map(m => projectedInvoices.value[m]?.charges || 0);
            const trendMax = Math.max(...trendVals, 1);
            const trend = trendMonths.map((m, i) => ({
                month: m, label: formatMonthShort(m), value: trendVals[i],
                h: Math.max(4, Math.round((trendVals[i] / trendMax) * 100)), active: m === viewMonth.value
            }));

            const [vy, vm] = parseMonth(viewMonth.value);
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const dues = cards.value
                .filter(c => (inv?.byCard[c.id] || 0) > 0)
                .map(c => {
                    const day = Math.min(Number(c.dueDay) || 1, daysInMonth(vy, vm));
                    const days = Math.round((new Date(vy, vm - 1, day) - now) / 86400000);
                    return { card: c, day, days, amount: inv.byCard[c.id] };
                })
                .sort((a, b) => a.day - b.day);

            return { charges, delta, prevCharges, mineTotal: mine?.total || 0, minePaid, receivable, debtors, categories, trend, dues, debt: inv?.debt || 0 };
        });

        const dueLabel = (d) => d.days === 0 ? 'vence hoje' : d.days > 0 ? `vence em ${d.days} ${d.days === 1 ? 'dia' : 'dias'}` : `venceu há ${-d.days} ${d.days === -1 ? 'dia' : 'dias'}`;
        const dueClass = (d) => d.days < 0 ? 'bad' : d.days <= 3 ? 'warn' : 'plain';

        /* ---------- Faturas por pessoa ---------- */
        const invoiceView = computed(() => {
            const inv = currentInv.value;
            if (!inv) return null;
            const peopleList = [];
            for (const [name, d] of Object.entries(inv.byPerson)) {
                const items = cardFilter.value === 'all' ? d.items : d.items.filter(i => !i.isDebt && i.cardId === cardFilter.value);
                if (!items.length) continue;
                const total = items.reduce((s, i) => s + i.amount, 0);
                peopleList.push({ name, items, total, paid: !!payments.value[viewMonth.value]?.[name] });
            }
            if (!peopleList.length) return null;
            peopleList.sort((a, b) => b.total - a.total);
            const total = peopleList.reduce((s, p) => s + p.total, 0);
            const paidCents = peopleList.filter(p => p.paid).reduce((s, p) => s + p.total, 0);
            return { people: peopleList, total, paidCents, pct: total ? Math.round((paidCents / total) * 100) : 0 };
        });

        const togglePayment = (m, p) => {
            const copy = { ...payments.value };
            const month = { ...(copy[m] || {}) };
            if (month[p]) delete month[p]; else month[p] = true;
            if (Object.keys(month).length) copy[m] = month; else delete copy[m];
            payments.value = copy;
        };

        const clearPastDebts = (person) => {
            askConfirm('Quitar histórico', `Marcar como pagas todas as faturas de ${person} anteriores ao mês atual? Os saldos devedores passados serão zerados.`, () => {
                const cur = monthOf(todayISO());
                const copy = { ...payments.value };
                let count = 0;
                for (const [month, inv] of Object.entries(projectedInvoices.value)) {
                    if (month >= cur || !inv.byPerson[person]) continue;
                    // Só conta o que é novo no mês, sem o saldo rolado (evita contar duas vezes).
                    if (inv.byPerson[person].items.every(i => i.isDebt)) continue;
                    if (!copy[month]?.[person]) { copy[month] = { ...(copy[month] || {}), [person]: true }; count++; }
                }
                payments.value = copy;
                showToast(count ? `${count} fatura(s) de ${person} marcadas como pagas.` : 'Nada pendente no histórico.', count ? 'success' : 'info');
            }, { label: 'Quitar', danger: false });
        };

        /* ============================================================
           Lançamentos
           ============================================================ */
        const txSheetOpen = ref(false);
        const isEditingTx = ref(null);
        const categoryTouched = ref(false);
        const formError = ref('');
        const blankTx = () => ({
            description: '', amount: null, amountType: 'total', date: todayISO(), cardId: cards.value[0]?.id || '',
            person: ownerName.value, type: 'single', installments: 2, category: 'outros', endMonth: ''
        });
        const formTx = reactive(blankTx());

        watch(() => formTx.description, (v) => {
            if (!categoryTouched.value && !isEditingTx.value) formTx.category = suggestCategory(v, formTx.type);
        });
        watch(() => formTx.type, (t) => {
            if (!categoryTouched.value && !isEditingTx.value) formTx.category = suggestCategory(formTx.description, t);
        });

        const openNewTx = (prefill = null) => {
            isEditingTx.value = null;
            categoryTouched.value = !!prefill?.category;
            formError.value = '';
            Object.assign(formTx, blankTx(), prefill || {});
            txSheetOpen.value = true;
        };
        const editTransaction = (tx) => {
            isEditingTx.value = tx.id;
            categoryTouched.value = true;
            formError.value = '';
            Object.assign(formTx, blankTx(), tx, { amountType: 'total', category: tx.category || 'outros', endMonth: tx.endMonth || '' });
            txSheetOpen.value = true;
        };
        const editTransactionById = (id) => { const tx = transactions.value.find(t => t.id === id); if (tx) editTransaction(tx); };
        const closeTxSheet = () => { txSheetOpen.value = false; isEditingTx.value = null; };

        const installmentPreview = computed(() => {
            const amt = Number(formTx.amount) || 0;
            const n = Math.max(2, parseInt(formTx.installments) || 2);
            if (!amt) return '';
            return formTx.amountType === 'total'
                ? `${n}x de ${formatMoney(amt / n)}`
                : `${n}x de ${formatMoney(amt)} · total ${formatMoney(amt * n)}`;
        });

        const saveTransaction = () => {
            formError.value = '';
            const desc = (formTx.description || '').trim();
            const amount = Number(formTx.amount);
            if (!desc) { formError.value = 'Informe a descrição.'; return; }
            if (!(amount > 0)) { formError.value = 'Informe um valor maior que zero.'; return; }
            if (!formTx.cardId || !cards.value.some(c => c.id === formTx.cardId)) { formError.value = 'Escolha um cartão. Cadastre um em Ajustes se ainda não tiver.'; return; }
            if (!formTx.person) { formError.value = 'Escolha quem fez o gasto.'; return; }
            const n = Math.min(Math.max(parseInt(formTx.installments) || 2, 2), 120);
            const isInst = formTx.type === 'installment';
            const total = isInst && formTx.amountType === 'installment' ? Math.round(amount * n * 100) / 100 : amount;

            const tx = {
                id: isEditingTx.value || uid(),
                description: desc, amount: total, date: formTx.date || todayISO(), cardId: formTx.cardId,
                person: formTx.person, type: formTx.type, installments: isInst ? n : 1,
                category: formTx.category || 'outros'
            };
            if (formTx.type === 'subscription' && formTx.endMonth) tx.endMonth = formTx.endMonth;

            if (isEditingTx.value) {
                const idx = transactions.value.findIndex(t => t.id === isEditingTx.value);
                if (idx !== -1) transactions.value[idx] = tx;
                showToast('Lançamento atualizado.', 'success');
            } else {
                transactions.value.push(tx);
                showToast('Lançamento salvo.', 'success');
            }
            closeTxSheet();
        };

        const deleteTransaction = (id) => {
            const idx = transactions.value.findIndex(t => t.id === id);
            if (idx === -1) return;
            const removed = transactions.value[idx];
            transactions.value.splice(idx, 1);
            closeTxSheet();
            showToast('Lançamento excluído.', 'info', {
                label: 'Desfazer',
                fn: () => { transactions.value.splice(Math.min(idx, transactions.value.length), 0, removed); }
            });
        };

        const duplicateTransaction = (id) => {
            const tx = transactions.value.find(t => t.id === id);
            if (!tx) return;
            const copy = { ...tx, id: uid(), date: todayISO() };
            transactions.value.push(copy);
            closeTxSheet();
            showToast('Lançamento duplicado com a data de hoje.', 'success', { label: 'Editar', fn: () => editTransaction(copy) });
        };

        // Lista filtrada, agrupada por dia
        const filteredTransactions = computed(() => {
            const q = searchQuery.value.trim().toLowerCase();
            return transactions.value
                .filter(t => personFilter.value === 'all' || t.person === personFilter.value)
                .filter(t => categoryFilter.value === 'all' || (t.category || 'outros') === categoryFilter.value)
                .filter(t => !q || (t.description || '').toLowerCase().includes(q) || (t.person || '').toLowerCase().includes(q) || getCardName(t.cardId).toLowerCase().includes(q))
                .map((t, i) => ({ t, i }))
                .sort((a, b) => (b.t.date || '').localeCompare(a.t.date || '') || b.i - a.i)
                .map(x => x.t);
        });
        const groupedTransactions = computed(() => {
            const groups = [];
            for (const t of filteredTransactions.value.slice(0, visibleCount.value)) {
                const last = groups[groups.length - 1];
                if (last && last.date === t.date) last.items.push(t);
                else groups.push({ date: t.date, label: formatDayLabel(t.date), items: [t] });
            }
            return groups;
        });
        const usedCategories = computed(() => {
            const ids = new Set(transactions.value.map(t => t.category || 'outros'));
            return CATEGORIES.filter(c => ids.has(c.id));
        });
        watch([searchQuery, personFilter, categoryFilter], () => { visibleCount.value = 30; });

        /* ============================================================
           Cartões
           ============================================================ */
        const cardSheetOpen = ref(false);
        const isEditingCard = ref(null);
        const formCard = reactive({ name: '', closingDay: 1, dueDay: 10, color: DEFAULT_CARD_COLOR });
        const cardError = ref('');

        const openNewCard = () => {
            isEditingCard.value = null; cardError.value = '';
            Object.assign(formCard, { name: '', closingDay: 1, dueDay: 10, color: CARD_COLORS[cards.value.length % CARD_COLORS.length] });
            cardSheetOpen.value = true;
        };
        const editCard = (card) => {
            isEditingCard.value = card.id; cardError.value = '';
            Object.assign(formCard, { name: card.name, closingDay: card.closingDay, dueDay: card.dueDay, color: card.color || DEFAULT_CARD_COLOR });
            cardSheetOpen.value = true;
        };
        const saveCard = () => {
            const name = (formCard.name || '').trim();
            const cd = parseInt(formCard.closingDay), dd = parseInt(formCard.dueDay);
            if (!name) { cardError.value = 'Informe o nome do cartão.'; return; }
            if (!(cd >= 1 && cd <= 31) || !(dd >= 1 && dd <= 31)) { cardError.value = 'Os dias devem estar entre 1 e 31.'; return; }
            const data = { name, closingDay: cd, dueDay: dd, color: formCard.color };
            if (isEditingCard.value) {
                const idx = cards.value.findIndex(c => c.id === isEditingCard.value);
                if (idx !== -1) cards.value[idx] = { ...data, id: isEditingCard.value };
                showToast('Cartão atualizado.', 'success');
            } else {
                cards.value.push({ ...data, id: uid() });
                showToast('Cartão cadastrado.', 'success');
            }
            cardSheetOpen.value = false;
        };
        const confirmDeleteCard = (card) => {
            const used = transactions.value.filter(t => t.cardId === card.id).length;
            const msg = used
                ? `${card.name} tem ${used} lançamento(s). Eles também serão excluídos. Esta ação pode ser desfeita logo após.`
                : `Remover o cartão ${card.name}?`;
            askConfirm('Excluir cartão', msg, () => {
                const prevCards = cards.value, prevTx = transactions.value;
                cards.value = cards.value.filter(c => c.id !== card.id);
                transactions.value = transactions.value.filter(t => t.cardId !== card.id);
                if (cardFilter.value === card.id) cardFilter.value = 'all';
                showToast('Cartão removido.', 'info', { label: 'Desfazer', fn: () => { cards.value = prevCards; transactions.value = prevTx; } });
            });
        };
        const cardUsage = (id) => transactions.value.filter(t => t.cardId === id).length;

        /* ============================================================
           Pessoas
           ============================================================ */
        const newPerson = ref('');
        const addPerson = () => {
            const name = (newPerson.value || '').trim();
            if (!name) return;
            if (people.value.some(p => p.toLowerCase() === name.toLowerCase())) { showToast('Essa pessoa já existe.', 'error'); return; }
            people.value.push(name);
            personColors.value = { ...personColors.value, [name]: COLOR_PALETTE[people.value.length % COLOR_PALETTE.length] };
            newPerson.value = '';
            showToast(`${name} adicionado(a).`, 'success');
        };
        const cyclePersonColor = (name) => {
            const cur = getPersonColor(name);
            const next = COLOR_PALETTE[(COLOR_PALETTE.indexOf(cur) + 1) % COLOR_PALETTE.length];
            personColors.value = { ...personColors.value, [name]: next };
        };
        const openEditPersonModal = (oldName) => {
            Object.assign(promptDialog, {
                show: true, title: 'Renomear pessoa', message: `Novo nome para ${oldName}:`, value: oldName,
                onConfirm: () => {
                    const n = (promptDialog.value || '').trim();
                    if (!n || n === oldName) { promptDialog.show = false; return; }
                    if (people.value.some(p => p.toLowerCase() === n.toLowerCase())) { showToast('Esse nome já existe.', 'error'); return; }
                    people.value = people.value.map(p => (p === oldName ? n : p));
                    const colors = { ...personColors.value };
                    if (colors[oldName]) { colors[n] = colors[oldName]; delete colors[oldName]; }
                    personColors.value = colors;
                    transactions.value.forEach(tx => { if (tx.person === oldName) tx.person = n; });
                    // O status "pago" também está atrelado ao nome.
                    const pay = {};
                    for (const [m, who] of Object.entries(payments.value)) {
                        pay[m] = {};
                        for (const [p, v] of Object.entries(who)) pay[m][p === oldName ? n : p] = v;
                    }
                    payments.value = pay;
                    if (personFilter.value === oldName) personFilter.value = n;
                    promptDialog.show = false;
                    showToast('Nome atualizado.', 'success');
                }
            });
        };
        const confirmRemovePerson = (p) => {
            const used = transactions.value.filter(t => t.person === p).length;
            if (used) { showToast(`${p} tem ${used} lançamento(s). Exclua-os ou renomeie a pessoa antes de remover.`, 'error'); return; }
            askConfirm('Remover pessoa', `Remover ${p} da lista?`, () => {
                people.value = people.value.filter(x => x !== p);
                showToast(`${p} removido(a).`, 'info');
            });
        };
        const openNewPersonFromForm = () => {
            Object.assign(promptDialog, {
                show: true, title: 'Nova pessoa', message: 'Quem fez este gasto?', value: '',
                onConfirm: () => {
                    const n = (promptDialog.value || '').trim();
                    if (n) {
                        const existing = people.value.find(p => p.toLowerCase() === n.toLowerCase());
                        if (!existing) {
                            people.value.push(n);
                            personColors.value = { ...personColors.value, [n]: COLOR_PALETTE[people.value.length % COLOR_PALETTE.length] };
                        }
                        formTx.person = existing || n;
                    }
                    promptDialog.show = false;
                }
            });
        };
        const handlePersonSelectChange = () => {
            if (formTx.person === '__new__') { formTx.person = ownerName.value; openNewPersonFromForm(); }
        };

        /* ============================================================
           Cobrança: WhatsApp, copiar, PIX
           ============================================================ */
        const buildSummary = (p) => {
            let msg = `💳 *Fatura de ${formatMonthLabel(viewMonth.value)}*\n`;
            msg += `Olá *${p.name}*, segue o resumo da sua parte: *${formatCents(p.total)}*\n\n📋 *Detalhamento:*\n`;
            p.items.forEach(i => { msg += `• ${i.desc}${i.parcelaInfo ? ` _(${i.parcelaInfo})_` : ''}: ${formatCents(i.amount)}\n`; });
            if (userPixKey.value.trim()) msg += `\n⚡ *Chave PIX:*\n\`${userPixKey.value.trim()}\`\n`;
            return msg + `\n_Gerado pelo Gestor de Faturas_`;
        };
        const copyText = async (text, okMsg) => {
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); } catch (_) { /* ignora */ }
                ta.remove();
            }
            showToast(okMsg, 'success');
        };
        const exportToWhatsApp = (p) => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(buildSummary(p))}`, '_blank', 'noopener');
        const copySummary = (p) => copyText(buildSummary(p).replace(/[*_`]/g, ''), 'Resumo copiado.');
        const copyPix = () => userPixKey.value.trim() ? copyText(userPixKey.value.trim(), 'Chave PIX copiada.') : showToast('Cadastre sua chave PIX em Ajustes.', 'error');
        const savePixKey = () => { userPixKey.value = userPixKey.value.trim(); showToast('Chave PIX salva.', 'success'); };

        /* ============================================================
           Backup / exportação
           ============================================================ */
        const download = (blob, filename) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        const exportBackup = () => {
            const data = {
                appName: 'GestorDeCartoes', version: APP_VERSION,
                cards: cards.value, people: people.value, transactions: transactions.value, payments: payments.value,
                personColors: personColors.value, pixKey: userPixKey.value, exportedAt: new Date().toISOString()
            };
            download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `Backup_Gestor_${todayISO()}.json`);
            showToast('Backup baixado.', 'success');
        };
        const importBackup = (e) => {
            const file = e.target.files[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                let data;
                try { data = JSON.parse(ev.target.result); } catch (_) { showToast('Não foi possível ler o arquivo JSON.', 'error'); return; }
                if (!data || (!Array.isArray(data.transactions) && !Array.isArray(data.cards))) { showToast('Arquivo de backup inválido.', 'error'); return; }
                askConfirm('Restaurar backup', `Isso substitui todos os dados atuais (${transactions.value.length} lançamentos) pelos do arquivo (${(data.transactions || []).length} lançamentos). Continuar?`, () => {
                    cards.value = data.cards || [];
                    people.value = data.people?.length ? data.people : ['Eu'];
                    transactions.value = data.transactions || [];
                    payments.value = data.payments || {};
                    personColors.value = data.personColors || {};
                    userPixKey.value = data.pixKey || '';
                    showToast('Backup restaurado.', 'success');
                }, { label: 'Substituir' });
            };
            reader.readAsText(file);
        };
        const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const exportCsv = () => {
            const rows = [['Mês da fatura', 'Pessoa', 'Descrição', 'Parcela', 'Categoria', 'Cartão', 'Valor (R$)']];
            const inv = currentInv.value;
            if (!inv) { showToast('Não há dados neste mês para exportar.', 'error'); return; }
            for (const [name, d] of Object.entries(inv.byPerson)) {
                d.items.forEach(i => rows.push([viewMonth.value, name, i.desc, i.parcelaInfo, i.isDebt ? 'Saldo anterior' : getCategory(i.category).name, i.cardId ? getCardName(i.cardId) : '', (i.amount / 100).toFixed(2).replace('.', ',')]));
            }
            const csv = '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
            download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Fatura_${viewMonth.value}.csv`);
            showToast('Planilha exportada.', 'success');
        };

        /* ============================================================
           IA e voz (Groq Cloud)
           ============================================================ */
        const voiceModalOpen = ref(false);
        const voiceState = ref('ready'); // ready | need_key | recording | processing | review | error
        const voiceProcessingStep = ref('');
        const voiceRecordingDuration = ref(0);
        const voiceTranscription = ref('');
        const voiceParsedData = ref(null);
        const voiceAutoConfirmTimer = ref(3);
        const voiceErrorMessage = ref('');
        let recorder = null, recStream = null, recChunks = [], recInterval = null, autoInterval = null, recCancelled = false;

        const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b'];

        const cancelAutoConfirm = () => { clearInterval(autoInterval); autoInterval = null; voiceAutoConfirmTimer.value = 0; };
        const stopRecordingResources = () => {
            clearInterval(recInterval); recInterval = null;
            recStream?.getTracks().forEach(t => t.stop()); recStream = null;
        };

        const saveGroqSettings = () => {
            groqApiKey.value = (groqApiKey.value || '').trim();
            groqModel.value = (groqModel.value || '').trim() || GROQ_MODELS[0];
            localStorage.setItem('groq_api_key', groqApiKey.value);
            localStorage.setItem('groq_model', groqModel.value);
            localStorage.setItem('groq_auto_confirm', groqAutoConfirm.value ? 'true' : 'false');
            showToast('Configurações de IA salvas.', 'success');
            if (voiceState.value === 'need_key' && groqApiKey.value) voiceState.value = 'ready';
        };

        const testGroqConnection = async () => {
            if (!groqApiKey.value.trim()) { showToast('Insira sua chave Groq primeiro.', 'error'); return; }
            groqTesting.value = true;
            try {
                const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${groqApiKey.value.trim()}` } });
                if (res.ok) showToast('Conexão com a Groq realizada com sucesso.', 'success');
                else { const err = await res.json().catch(() => ({})); showToast(`Erro na Groq: ${err?.error?.message || res.statusText}`, 'error'); }
            } catch (e) {
                showToast(`Falha ao conectar: ${e.message}`, 'error');
            } finally { groqTesting.value = false; }
        };

        const openVoiceModal = () => {
            cancelAutoConfirm();
            voiceErrorMessage.value = ''; voiceTranscription.value = ''; voiceParsedData.value = null; voiceRecordingDuration.value = 0;
            voiceState.value = groqApiKey.value.trim() ? 'ready' : 'need_key';
            voiceModalOpen.value = true;
        };
        const closeVoiceModal = () => {
            cancelAutoConfirm();
            recCancelled = true;
            if (recorder?.state === 'recording') { try { recorder.stop(); } catch (_) { /* ignora */ } }
            stopRecordingResources();
            voiceModalOpen.value = false;
            voiceState.value = 'ready';
        };

        const startVoiceRecording = async () => {
            if (!groqApiKey.value.trim()) { voiceState.value = 'need_key'; return; }
            if (!cards.value.length) { voiceState.value = 'error'; voiceErrorMessage.value = 'Cadastre ao menos um cartão em Ajustes antes de lançar por voz.'; return; }
            if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { voiceState.value = 'error'; voiceErrorMessage.value = 'Este navegador não suporta gravação de áudio.'; return; }

            voiceErrorMessage.value = ''; voiceTranscription.value = ''; voiceParsedData.value = null; voiceRecordingDuration.value = 0;
            cancelAutoConfirm();
            recCancelled = false;

            try {
                recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
                recChunks = [];
                const rec = recorder = mimeType ? new MediaRecorder(recStream, { mimeType }) : new MediaRecorder(recStream);
                rec.ondataavailable = (ev) => { if (ev.data?.size > 0) recChunks.push(ev.data); };
                rec.onstop = async () => {
                    stopRecordingResources();
                    if (recCancelled) return;
                    if (!recChunks.length) { voiceState.value = 'error'; voiceErrorMessage.value = 'Nenhum áudio foi capturado. Fale novamente.'; return; }
                    await processVoicePipeline(new Blob(recChunks, { type: rec.mimeType || 'audio/webm' }), rec.mimeType || 'audio/webm');
                };
                rec.start();
                voiceState.value = 'recording';
                recInterval = setInterval(() => {
                    voiceRecordingDuration.value++;
                    if (voiceRecordingDuration.value >= 60) stopVoiceRecording(); // limite de segurança
                }, 1000);
            } catch (err) {
                stopRecordingResources();
                voiceState.value = 'error';
                voiceErrorMessage.value = (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
                    ? 'Permissão de microfone negada. Autorize o microfone no navegador para gravar.'
                    : `Erro ao acessar o microfone: ${err.message}`;
            }
        };
        const stopVoiceRecording = () => { if (recorder?.state === 'recording') recorder.stop(); };
        const cancelVoiceRecording = () => {
            recCancelled = true;
            if (recorder?.state === 'recording') { try { recorder.stop(); } catch (_) { /* ignora */ } }
            stopRecordingResources();
            voiceState.value = 'ready';
        };

        const processVoicePipeline = async (blob, mimeType) => {
            voiceState.value = 'processing';
            try {
                voiceProcessingStep.value = 'Transcrevendo sua fala…';
                const text = (await transcribeAudio(blob, mimeType) || '').trim();
                if (!text) throw new Error('Não identifiquei nenhuma fala. Tente falar mais perto do microfone.');
                voiceTranscription.value = text;

                voiceProcessingStep.value = 'Entendendo a compra…';
                voiceParsedData.value = await parseExpense(text);
                voiceState.value = 'review';

                if (groqAutoConfirm.value) {
                    voiceAutoConfirmTimer.value = 3;
                    autoInterval = setInterval(() => {
                        voiceAutoConfirmTimer.value--;
                        if (voiceAutoConfirmTimer.value <= 0) { cancelAutoConfirm(); applyVoiceTransaction(); }
                    }, 1000);
                }
            } catch (err) {
                console.error('Falha no pipeline de IA:', err);
                voiceState.value = 'error';
                voiceErrorMessage.value = err.message || 'Falha ao processar o comando de voz.';
            }
        };

        const transcribeAudio = async (blob, mimeType) => {
            const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
            const fd = new FormData();
            fd.append('file', new File([blob], `audio.${ext}`, { type: mimeType }));
            fd.append('model', 'whisper-large-v3');
            fd.append('language', 'pt');
            fd.append('response_format', 'json');
            fd.append('prompt', 'Lançamento de compras no cartão de crédito, valores em reais, parcelas e nomes de pessoas');
            const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST', headers: { Authorization: `Bearer ${groqApiKey.value.trim()}` }, body: fd
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error?.message || `Erro na transcrição (${res.status})`);
            }
            return (await res.json()).text;
        };

        const parseExpense = async (text) => {
            const today = todayISO();
            const cardsList = cards.value.map(c => ({ id: c.id, name: c.name }));
            const systemPrompt = `Você é o assistente do app 'Gestor de Faturas'. Extraia os dados de uma despesa a partir da fala do usuário.

HOJE: ${today}
CARTÕES: ${JSON.stringify(cardsList)}
PESSOAS: ${JSON.stringify(people.value)}
CATEGORIAS (ids): ${CATEGORIES.map(c => c.id).join(', ')}

Responda SOMENTE com um objeto JSON com estes campos:
- "description": título curto da despesa (ex: "Supermercado", "Almoço").
- "amount": número positivo (ex: 150.5).
- "amountType": "total" (valor da compra toda) ou "installment" (valor de cada parcela). Padrão "total".
- "type": "single" (à vista), "installment" (parcelado) ou "subscription" (assinatura/mensal recorrente).
- "installments": inteiro (mínimo 2 se parcelado; 1 caso contrário).
- "person": se disser "eu", "para mim" ou "minha", use "${ownerName.value}". Se citar alguém, use o nome cadastrado correspondente ou o nome falado com inicial maiúscula.
- "cardId": id do cartão citado. Se não citar ou não encontrar, use "${cardsList[0]?.id || ''}".
- "category": um dos ids de categoria acima.
- "date": AAAA-MM-DD. "hoje" = ${today}, "ontem" = dia anterior. Padrão ${today}.`;

            const models = [...new Set([(groqModel.value || '').trim() || GROQ_MODELS[0], GROQ_MODELS[0], GROQ_MODELS[2]])];
            let lastError = null;
            for (const model of models) {
                try {
                    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${groqApiKey.value.trim()}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model, temperature: 0.1, response_format: { type: 'json_object' },
                            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }]
                        })
                    });
                    if (!res.ok) {
                        const e = await res.json().catch(() => ({}));
                        lastError = new Error(e?.error?.message || `Erro no modelo ${model} (${res.status})`);
                        if (res.status === 401 || res.status === 403) throw lastError;
                        continue;
                    }
                    const data = await res.json();
                    const raw = (data.choices?.[0]?.message?.content || '').replace(/^```(?:json)?|```$/gm, '').trim();
                    return normalizeParsed(JSON.parse(raw), today);
                } catch (e) {
                    lastError = e;
                    if (/401|403|invalid_api_key/i.test(e.message || '')) throw e;
                }
            }
            throw lastError || new Error('Não foi possível interpretar a compra.');
        };

        const normalizeParsed = (p, today) => {
            const type = ['single', 'installment', 'subscription'].includes(p.type) ? p.type : 'single';
            const amount = Number(p.amount) || 0;
            if (!(amount > 0)) throw new Error('Não entendi o valor da compra. Diga o valor em reais.');
            let person = String(p.person || ownerName.value).trim();
            if (/^(eu|mim|minha|meu)$/i.test(person)) person = ownerName.value;
            const known = people.value.find(x => x.toLowerCase() === person.toLowerCase());
            person = known || person.charAt(0).toUpperCase() + person.slice(1);
            return {
                description: String(p.description || 'Compra por voz').trim(),
                amount, amountType: p.amountType === 'installment' ? 'installment' : 'total', type,
                installments: type === 'installment' ? Math.min(Math.max(parseInt(p.installments) || 2, 2), 120) : 1,
                person,
                cardId: cards.value.some(c => c.id === p.cardId) ? p.cardId : cards.value[0]?.id,
                category: CATEGORY_MAP[p.category] ? p.category : suggestCategory(p.description, type),
                date: /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : today
            };
        };

        const registerPerson = (name) => {
            if (!people.value.includes(name)) {
                people.value.push(name);
                personColors.value = { ...personColors.value, [name]: COLOR_PALETTE[people.value.length % COLOR_PALETTE.length] };
            }
        };

        const applyVoiceTransaction = () => {
            cancelAutoConfirm();
            const d = voiceParsedData.value;
            if (!d) return;
            registerPerson(d.person);
            const n = d.installments;
            const total = d.type === 'installment' && d.amountType === 'installment' ? Math.round(d.amount * n * 100) / 100 : d.amount;
            const tx = {
                id: uid(), description: d.description, amount: total, date: d.date, cardId: d.cardId, person: d.person,
                type: d.type, installments: n, category: d.category
            };
            transactions.value.push(tx);
            showToast(`Lançado: ${tx.description} (${formatMoney(tx.amount)})`, 'success', {
                label: 'Desfazer', fn: () => { transactions.value = transactions.value.filter(t => t.id !== tx.id); }
            });
            closeVoiceModal();
        };

        const editInFormFromVoice = () => {
            cancelAutoConfirm();
            const d = voiceParsedData.value;
            if (!d) return;
            registerPerson(d.person);
            closeVoiceModal();
            openNewTx({
                description: d.description, amount: d.amount, amountType: d.amountType, type: d.type,
                installments: Math.max(2, d.installments), person: d.person, cardId: d.cardId, date: d.date, category: d.category
            });
        };

        const voicePreviewCondition = computed(() => {
            const d = voiceParsedData.value;
            if (!d) return '';
            if (d.type === 'installment') {
                const per = d.amountType === 'installment' ? d.amount : d.amount / d.installments;
                return `${d.installments}x de ${formatMoney(per)}`;
            }
            return d.type === 'subscription' ? 'Mensal' : 'À vista';
        });

        /* Fecha camadas com a tecla Esc */
        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (confirmDialog.show) confirmDialog.show = false;
            else if (promptDialog.show) promptDialog.show = false;
            else if (voiceModalOpen.value) closeVoiceModal();
            else if (txSheetOpen.value) closeTxSheet();
            else if (cardSheetOpen.value) cardSheetOpen.value = false;
            else if (profileModalOpen.value) profileModalOpen.value = false;
        });

        const noCards = computed(() => cards.value.length === 0);
        const hasTransactions = computed(() => transactions.value.length > 0);
        const goTab = (t) => { currentTab.value = t; window.scrollTo({ top: 0 }); };

        return {
            APP_VERSION, CATEGORIES, CARD_COLORS, GROQ_MODELS,
            user, authReady, loading, authMode, authForm, showPassword, handleAuth, resetPassword, logout,
            currentTab, goTab, viewMonth, cardFilter, searchQuery, personFilter, categoryFilter, visibleCount, profileModalOpen,
            syncLabel, syncDotClass, themePref, setTheme,
            cards, people, transactions, payments, ownerName, noCards, hasTransactions,
            toast, runToastAction, confirmDialog, promptDialog,
            formatMoney, formatCents, formatDate, formatMonthLabel, formatDuration, getPersonColor, getCardName, getCardColor, initial, getCategory,
            navigateMonth, goToday, isCurrentMonth, currentInv, dash, dueLabel, dueClass, invoiceView, togglePayment, clearPastDebts,
            txSheetOpen, isEditingTx, formTx, formError, categoryTouched, installmentPreview, openNewTx, editTransaction, editTransactionById,
            closeTxSheet, saveTransaction, deleteTransaction, duplicateTransaction, groupedTransactions, filteredTransactions, usedCategories,
            cardSheetOpen, isEditingCard, formCard, cardError, openNewCard, editCard, saveCard, confirmDeleteCard, cardUsage,
            newPerson, addPerson, cyclePersonColor, openEditPersonModal, confirmRemovePerson, handlePersonSelectChange,
            userPixKey, exportToWhatsApp, copySummary, copyPix, savePixKey,
            exportBackup, importBackup, exportCsv,
            groqApiKey, groqModel, groqAutoConfirm, showGroqKey, groqTesting, saveGroqSettings, testGroqConnection,
            voiceModalOpen, voiceState, voiceProcessingStep, voiceRecordingDuration, voiceTranscription, voiceParsedData,
            voiceAutoConfirmTimer, voiceErrorMessage, voicePreviewCondition,
            openVoiceModal, closeVoiceModal, startVoiceRecording, stopVoiceRecording, cancelVoiceRecording,
            cancelAutoConfirm, applyVoiceTransaction, editInFormFromVoice
        };
    }
}).mount('#app');

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}
