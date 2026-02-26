// Seletores Studio
const feedGrid = document.getElementById('feed-grid');
const previewModal = document.getElementById('preview-modal');
const expandedImg = document.getElementById('expanded-img');
const promptInput = document.getElementById('prompt-input');
const apiKeyInput = document.getElementById('api-key-input');
const statusMsg = document.getElementById('status-msg');
const savedPromptsSelect = document.getElementById('saved-prompts-select');

// Seletores Hero
const heroFeedGrid = document.getElementById('hero-feed-grid');
const heroStatusMsg = document.getElementById('hero-status-msg');
const heroRefCarousel = document.getElementById('hero-ref-carousel');

// Seletores Referências
const refCarousel = document.getElementById('ref-carousel');
const refFileInput = document.getElementById('ref-file-input');
const refModal = document.getElementById('ref-modal');
const refExpandedImg = document.getElementById('ref-expanded-img');

let attachedRefs = []; // Referências do Studio
let heroRefs = [];     // Referências do Hero
let objRefs = [];      // Referências de Objetos
let currentRefMode = 'studio'; 
let currentRefIndex = -1;

// --- CONFIG & SETTINGS ---
document.getElementById('toggle-settings').onclick = () => document.getElementById('settings-panel').classList.add('active');
document.getElementById('close-settings').onclick = () => document.getElementById('settings-panel').classList.remove('active');
document.getElementById('close-preview').onclick = () => previewModal.style.display = 'none';
document.getElementById('close-ref-modal').onclick = () => refModal.style.display = 'none';

// --- WEB READY: Carregamento Automático da Chave ---
function loadApiKey() {
    const savedKey = localStorage.getItem('banana_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        console.log("🔑 Chave API carregada do navegador.");
    }
}
loadApiKey();

document.getElementById('save-key-btn').onclick = () => {
    const key = apiKeyInput.value.trim();
    localStorage.setItem('banana_api_key', key);
    alert("✅ Chave salva no navegador!");
};

// --- WEB READY: Presets via localStorage ---
function getLocalPrompts() {
    const p = localStorage.getItem('banana_prompts');
    return p ? JSON.parse(p) : {};
}

function refreshPromptList() {
    const prompts = getLocalPrompts();
    savedPromptsSelect.innerHTML = '<option value="">✍️ Digitar Novo</option>';
    Object.keys(prompts).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        savedPromptsSelect.appendChild(opt);
    });
    if (typeof updateKodaSelect === 'function') updateKodaSelect('saved-prompts-select');
}
refreshPromptList();

savedPromptsSelect.onchange = () => {
    const name = savedPromptsSelect.value;
    if (!name) { promptInput.value = ""; return; }
    const prompts = getLocalPrompts();
    if (prompts[name]) promptInput.value = prompts[name];
};

// Modal Save Prompt
document.getElementById('open-save-modal').onclick = () => document.getElementById('save-modal').style.display='flex';
document.getElementById('confirm-save').onclick = () => {
    const name = document.getElementById('prompt-name-input').value.trim();
    const content = promptInput.value.trim();
    if (!name || !content) return;
    
    const prompts = getLocalPrompts();
    prompts[name] = content;
    localStorage.setItem('banana_prompts', JSON.stringify(prompts));
    
    alert("✅ Preset salvo!");
    document.getElementById('save-modal').style.display='none';
    refreshPromptList();
};

// --- REFERENCE LOGIC ---
document.getElementById('ref-upload-btn').onclick = () => { currentRefMode = 'studio'; refFileInput.click(); };
if(document.getElementById('hero-upload-btn')) document.getElementById('hero-upload-btn').onclick = () => { currentRefMode = 'hero'; refFileInput.click(); };
if(document.getElementById('obj-upload-btn')) document.getElementById('obj-upload-btn').onclick = () => { currentRefMode = 'obj'; refFileInput.click(); };

document.getElementById('ref-clear-btn').onclick = () => { attachedRefs = []; renderRefs('studio'); };
if(document.getElementById('hero-clear-btn')) document.getElementById('hero-clear-btn').onclick = () => { heroRefs = []; renderRefs('hero'); };
if(document.getElementById('obj-clear-btn')) document.getElementById('obj-clear-btn').onclick = () => { objRefs = []; renderRefs('obj'); };

refFileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (currentRefMode === 'studio') attachedRefs.push(ev.target.result);
            else if (currentRefMode === 'hero') heroRefs.push(ev.target.result);
            else if (currentRefMode === 'obj') objRefs.push(ev.target.result);
            renderRefs(currentRefMode);
        };
        reader.readAsDataURL(file);
    });
    refFileInput.value = "";
};

function renderRefs(mode) {
    let container, list;
    if (mode === 'studio') { container = refCarousel; list = attachedRefs; }
    else if (mode === 'hero') { container = heroRefCarousel; list = heroRefs; }
    else if (mode === 'obj') { container = document.getElementById('obj-ref-carousel'); list = objRefs; }
    
    if(!container) return;
    container.innerHTML = "";
    list.forEach((src, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'ref-thumb';
        thumb.innerHTML = `<img src="${src}">`;
        thumb.onclick = () => { currentRefMode = mode; currentRefIndex = idx; refExpandedImg.src = src; refModal.style.display = 'flex'; };
        container.appendChild(thumb);
    });
    for (let i = list.length; i < 4; i++) {
        const empty = document.createElement('div');
        empty.className = 'ref-thumb empty';
        empty.innerHTML = '<span>+</span>';
        empty.onclick = () => { currentRefMode = mode; refFileInput.click(); };
        container.appendChild(empty);
    }
}
renderRefs('studio');
renderRefs('hero');
renderRefs('obj');

document.getElementById('ref-delete-btn').onclick = () => {
    let list;
    if (currentRefMode === 'studio') list = attachedRefs;
    else if (currentRefMode === 'hero') list = heroRefs;
    else list = objRefs;
    list.splice(currentRefIndex, 1);
    renderRefs(currentRefMode);
    refModal.style.display = 'none';
};

// --- API CORE ---
async function callGeminiAPI(key, prompt, refs, aspect, quality) {
    let parts = [{ text: prompt }];
    refs.forEach((ref) => {
        try {
            const base64Data = ref.split(',')[1];
            const mimeType = ref.split(';')[0].split(':')[1] || "image/png";
            parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        } catch (e) { console.error("Erro ref:", e); }
    });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { 
                    response_modalities: ["IMAGE"], 
                    imageConfig: { aspect_ratio: aspect, image_size: quality } 
                }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(`${data.error.code}: ${data.error.message}`);
        if (!data.candidates || !data.candidates[0].content) {
            if (data.candidates && data.candidates[0].finishReason === "SAFETY") throw new Error("BLOQUEIO DE SEGURANÇA: API recusou o conteúdo.");
            throw new Error("A API não retornou imagem.");
        }
        const imagePart = data.candidates[0].content.parts.find(p => p.inlineData || p.data);
        return imagePart.inlineData ? imagePart.inlineData.data : imagePart.data;
    } catch (err) { throw err; }
}

function createFeedItem(grid) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
        <div class="spinner-container" style="display:flex; flex-direction:column; align-items:center; gap:15px;">
            <div class="spinner"><div></div><div></div><div></div><div></div><div></div><div></div></div>
            <span style="font-size:10px; color:var(--accent-blue); font-weight:bold; letter-spacing:1px;">PROCESSANDO...</span>
        </div>
    `;
    grid.prepend(item);
    return item;
}

function finishFeedItem(item, src) {
    item.innerHTML = `<img src="${src}">`;
    item.onclick = () => { expandedImg.src = src; previewModal.style.display = 'flex'; };
}

// --- BOTÕES DE GERAÇÃO ---
document.getElementById('gen-btn').onclick = async () => {
    const prompt = promptInput.value.trim();
    const key = apiKeyInput.value.trim();
    const aspect = document.getElementById('aspect-select').value;
    const quality = document.getElementById('quality-select').value;
    
    if (!prompt || !key) { alert("Configure a chave API."); return; }
    const item = createFeedItem(feedGrid);
    statusMsg.innerText = "⏳ Gerando...";
    try {
        const response = await callGeminiAPI(key, prompt, attachedRefs, aspect, quality);
        finishFeedItem(item, `data:image/png;base64,${response}`);
        statusMsg.innerText = "✨ Pronto!";
    } catch (e) { 
        statusMsg.innerText = "❌ ERRO: " + e.message; 
        item.remove();
    }
};

const heroGenBtn = document.getElementById('hero-gen-btn');
if(heroGenBtn) heroGenBtn.onclick = async () => {
    const key = apiKeyInput.value.trim();
    if (!key) { alert("Chave API não configurada."); return; }
    const item = createFeedItem(heroFeedGrid);
    heroStatusMsg.innerText = "⏳ Construindo...";
    try {
        const templateResp = await fetch('hero_templates/hero_v1.json');
        const template = await templateResp.json();
        const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value : null;
        const isChecked = (id) => document.getElementById(id) ? document.getElementById(id).checked : false;

        const interfaceValues = {
            "PROFISSAO": isChecked('hero-profissao-toggle') ? (getVal('hero-profissao') || "Profissional") : "Pessoa",
            "CONTEXTO_DO_AMBIENTE": getVal('hero-ambiente') || "Ambiente moderno",
            "GENERO": getVal('hero-genero'),
            "ESTILO_VISUAL_DA_PESSOA": getVal('hero-estilo'),
            "ANGULO_DE_CAMERA": isChecked('hero-angulo-toggle') ? getVal('hero-angulo') : "eye level frontal",
            "PLANO": getVal('hero-plano'),
            "POSE": getVal('hero-pose'),
            "EXPRESSAO": getVal('hero-expressao'),
            "ROUPA_PRINCIPAL": getVal('hero-roupa') || "traje profissional alinhado",
            "LADO_DO_PERSONAGEM": getVal('hero-lado'),
            "LADO_DO_ESPACO_NEGATIVO": getVal('hero-lado') === 'direita' ? 'esquerda' : 'direita',
            "COR_ATMOSFERA": getVal('hero-luzv-cor') || "#000000",
            "COLOR_GRADING": getVal('hero-preset') || "cinematográfico moderno",
            "OBJETO_CENA": isChecked('hero-objeto-toggle') ? getVal('hero-objeto-desc') : "nenhum",
            "DETALHES_EXTRA": isChecked('hero-detalhes-toggle') ? getVal('hero-detalhes-desc') : "conforme referência"
        };

        template.PARAMETROS_EDITAVEIS = interfaceValues;
        let finalPromptText = JSON.stringify(template);
        for (const [k, v] of Object.entries(interfaceValues)) {
            finalPromptText = finalPromptText.split(`@${k}`).join(v);
        }

        const aspect = getVal('hero-aspect-select') || "16:9";
        const quality = getVal('hero-quality-select') || "4K";
        const response = await callGeminiAPI(key, finalPromptText, [...heroRefs, ...objRefs], aspect, quality);
        finishFeedItem(item, `data:image/png;base64,${response}`);
        heroStatusMsg.innerText = "✨ Hero Pro Gerado!";
    } catch (e) { 
        heroStatusMsg.innerText = "❌ Erro: " + e.message; 
        item.remove(); 
    }
};

// Funções de Toggle (Mantidas para UI)
function toggleAnguloField() { const c = document.getElementById('controls-angulo'); c.style.display = document.getElementById('hero-angulo-toggle').checked ? 'block' : 'none'; if(c.style.display === 'block') updateKodaSelect('hero-angulo'); }
function toggleObjetoField() { document.getElementById('controls-objeto').style.display = document.getElementById('hero-objeto-toggle').checked ? 'block' : 'none'; }
function toggleDetailsField() { document.getElementById('controls-detalhes').style.display = document.getElementById('hero-detalhes-toggle').checked ? 'block' : 'none'; }
function toggleProfissaoField() { document.getElementById('controls-profissao').style.display = document.getElementById('hero-profissao-toggle').checked ? 'block' : 'none'; }
function toggleEffectControls(id) { const c = document.getElementById(`controls-${id}`); c.style.display = document.getElementById(`hero-${id}`).checked ? 'flex' : 'none'; }

document.getElementById('modal-download-btn').onclick = () => {
    const link = document.createElement('a');
    link.download = `art_${Date.now()}.jpg`;
    link.href = expandedImg.src;
    link.click();
};

// --- KODA SELECT COMPONENT ---
function initKodaSelect(id) {
    const real = document.getElementById(id);
    if (!real || real.previousElementSibling?.classList.contains('koda-select-container')) return;
    const container = document.createElement('div');
    container.className = 'koda-select-container';
    const selected = document.createElement('div');
    selected.className = 'koda-select-selected';
    selected.innerHTML = `<span>${real.options[real.selectedIndex].text}</span><svg class="koda-select-arrow" viewBox="0 0 512 512"><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"/></svg>`;
    const list = document.createElement('div');
    list.className = 'koda-select-options';
    Array.from(real.options).forEach((opt, idx) => {
        const o = document.createElement('div');
        o.className = 'koda-select-option';
        o.innerText = opt.text;
        o.onclick = () => { real.selectedIndex = idx; selected.querySelector('span').innerText = opt.text; container.classList.remove('active'); real.dispatchEvent(new Event('change')); };
        list.appendChild(o);
    });
    container.appendChild(selected); container.appendChild(list);
    real.style.display = 'none'; real.parentNode.insertBefore(container, real);
    selected.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.koda-select-container').forEach(c => { if (c !== container) c.classList.remove('active'); }); container.classList.toggle('active'); };
}

function updateKodaSelect(id) {
    const real = document.getElementById(id);
    if (!real) return;
    const container = real.previousElementSibling;
    if (container?.classList.contains('koda-select-container')) {
        const list = container.querySelector('.koda-select-options');
        const span = container.querySelector('.koda-select-selected span');
        list.innerHTML = "";
        Array.from(real.options).forEach((opt, idx) => {
            const o = document.createElement('div');
            o.className = 'koda-select-option';
            o.innerText = opt.text;
            o.onclick = () => { real.selectedIndex = idx; span.innerText = opt.text; container.classList.remove('active'); real.dispatchEvent(new Event('change')); };
            list.appendChild(o);
        });
        span.innerText = real.options[real.selectedIndex].text;
    } else { initKodaSelect(id); }
}

document.addEventListener('click', () => { document.querySelectorAll('.koda-select-container').forEach(c => c.classList.remove('active')); });

document.addEventListener('DOMContentLoaded', () => {
    ['aspect-select', 'quality-select', 'saved-prompts-select', 'hero-estilo', 'hero-pose', 'hero-expressao', 'hero-preset', 'hero-genero', 'hero-lado', 'hero-plano', 'hero-aspect-select', 'hero-quality-select'].forEach(initKodaSelect);
});

// Desativa o botão shutdown na web
const shutdownBtn = document.getElementById('shutdown-btn');
if(shutdownBtn) {
    shutdownBtn.style.opacity = '0.3';
    shutdownBtn.onclick = () => alert("Botão desativado na versão Web.");
}
