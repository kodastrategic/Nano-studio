import { PoseDB } from './poseDB.js';

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

// Seletores Carrossel de Poses
const poseTrack = document.getElementById('pose-carousel-track');
const posePrevBtn = document.getElementById('pose-prev-btn');
const poseNextBtn = document.getElementById('pose-next-btn');
let currentPoseIdx = 0;
let allPosesData = [];

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

// --- WEB READY: Gerenciar Prompts ---
let editingPromptName = "";

document.getElementById('open-manage-modal').onclick = () => {
    const prompts = getLocalPrompts();
    const listContainer = document.getElementById('manage-prompts-list');
    listContainer.innerHTML = "";
    
    if (Object.keys(prompts).length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; opacity:0.5; font-size:12px;'>Nenhum prompt salvo.</p>";
    }

    Object.keys(prompts).forEach(name => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px;";
        item.innerHTML = `
            <span style="font-size:13px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${name}</span>
            <div style="display:flex; gap:8px;">
                <button class="btn-edit-item" style="padding:6px 12px; font-size:11px; cursor:pointer; background:var(--accent-blue); color:white; border:none; border-radius:4px;">EDITAR</button>
                <button class="btn-delete-item" style="padding:6px 12px; font-size:11px; cursor:pointer; background:var(--danger-red); color:white; border:none; border-radius:4px;">EXCLUIR</button>
            </div>
        `;

        // Botão Editar
        item.querySelector('.btn-edit-item').onclick = () => {
            editingPromptName = name;
            document.getElementById('edit-prompt-title').innerText = `Editar: ${name}`;
            document.getElementById('edit-prompt-textarea').value = prompts[name];
            document.getElementById('edit-prompt-modal').style.display = 'flex';
        };

        // Botão Excluir
        item.querySelector('.btn-delete-item').onclick = () => {
            if(confirm(`Excluir o prompt "${name}"?`)) {
                const p = getLocalPrompts();
                delete p[name];
                localStorage.setItem('banana_prompts', JSON.stringify(p));
                document.getElementById('open-manage-modal').click(); // Refresh modal
                refreshPromptList();
            }
        };
        listContainer.appendChild(item);
    });
    document.getElementById('manage-modal').style.display = 'flex';
};

// Salvar Edição
document.getElementById('confirm-edit-save').onclick = () => {
    const newContent = document.getElementById('edit-prompt-textarea').value.trim();
    if (!newContent) return;
    
    const prompts = getLocalPrompts();
    prompts[editingPromptName] = newContent;
    localStorage.setItem('banana_prompts', JSON.stringify(prompts));
    
    alert("✅ Alteração salva!");
    document.getElementById('edit-prompt-modal').style.display = 'none';
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

const handlePaste = async (mode) => {
    currentRefMode = mode;
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            for (const type of item.types) {
                if (type.startsWith("image/")) {
                    const blob = await item.getType(type);
                    const reader = new FileReader();
                    reader.onload = (e) => { 
                        if (mode === 'studio') attachedRefs.push(e.target.result);
                        else if (mode === 'hero') heroRefs.push(e.target.result);
                        else if (mode === 'obj') objRefs.push(e.target.result);
                        renderRefs(mode); 
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    } catch (e) { alert("Use Upload ou verifique se há uma imagem copiada."); }
};

document.getElementById('ref-paste-btn').onclick = () => handlePaste('studio');
if(document.getElementById('hero-paste-btn')) document.getElementById('hero-paste-btn').onclick = () => handlePaste('hero');

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
async function callGeminiAPI(key, prompt, refs, aspect, quality, modelId = "gemini-3.1-flash-image-preview") {
    let parts = [{ text: prompt }];
    refs.forEach((ref) => {
        try {
            const base64Data = ref.split(',')[1];
            const mimeType = ref.split(';')[0].split(':')[1] || "image/png";
            parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        } catch (e) { console.error("Erro ref:", e); }
    });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`, {
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
    const model = document.getElementById('model-select').value;
    
    if (!prompt || !key) { alert("Configure a chave API."); return; }
    const item = createFeedItem(feedGrid);
    statusMsg.innerText = "⏳ Gerando...";
    try {
        const response = await callGeminiAPI(key, prompt, attachedRefs, aspect, quality, model);
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
            "POSE": isChecked('hero-pose-custom-toggle') ? (getVal('hero-pose-custom') || "pose natural") : getVal('hero-pose'),
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
        const model = getVal('hero-model-select') || "imagen-3-pro";
        const response = await callGeminiAPI(key, finalPromptText, [...heroRefs, ...objRefs], aspect, quality, model);
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
function togglePoseMode() {
    const isCustom = document.getElementById('hero-pose-custom-toggle').checked;
    const selectCont = document.getElementById('hero-pose-select-container');
    const customCont = document.getElementById('hero-pose-custom-container');
    const saveBtn = document.getElementById('save-pose-btn');
    
    if (isCustom) {
        selectCont.style.display = 'none';
        customCont.style.display = 'block';
        saveBtn.style.display = 'block';
    } else {
        selectCont.style.display = 'block';
        customCont.style.display = 'none';
        saveBtn.style.display = 'none';
        updateKodaSelect('hero-pose');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ['aspect-select', 'quality-select', 'model-select', 'saved-prompts-select', 'hero-model-select', 'hero-estilo', 'hero-pose', 'hero-expressao', 'hero-preset', 'hero-genero', 'hero-lado', 'hero-plano', 'hero-aspect-select', 'hero-quality-select', 'hero-angulo'].forEach(initKodaSelect);
    refreshPoseList();
});

// Salvar Pose
document.getElementById('save-pose-btn').onclick = () => document.getElementById('save-pose-modal').style.display='flex';
document.getElementById('confirm-save-pose').onclick = () => {
    const name = document.getElementById('pose-name-input').value.trim();
    const content = document.getElementById('hero-pose-custom').value.trim();
    if (!name || !content) return;
    
    const poses = getLocalPoses();
    poses[name] = content;
    localStorage.setItem('banana_poses', JSON.stringify(poses));
    
    alert("✅ Pose salva!");
    document.getElementById('save-pose-modal').style.display='none';
    refreshPoseList();
};

// Gerenciar Poses
let editingPoseName = "";

document.getElementById('manage-poses-btn').onclick = () => {
    const poses = getLocalPoses();
    const listContainer = document.getElementById('manage-poses-list');
    listContainer.innerHTML = "";
    
    if (Object.keys(poses).length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; opacity:0.5; font-size:12px;'>Nenhuma pose customizada salva.</p>";
    }

    Object.keys(poses).forEach(name => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px;";
        item.innerHTML = `
            <span style="font-size:13px; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${name}</span>
            <div style="display:flex; gap:8px;">
                <button class="btn-edit-pose" style="padding:6px 12px; font-size:11px; cursor:pointer; background:var(--accent-blue); color:white; border:none; border-radius:4px;">EDITAR</button>
                <button class="btn-delete-pose" style="padding:6px 12px; font-size:11px; cursor:pointer; background:var(--danger-red); color:white; border:none; border-radius:4px;">EXCLUIR</button>
            </div>
        `;

        // Botão Editar Pose
        item.querySelector('.btn-edit-pose').onclick = () => {
            editingPoseName = name;
            document.getElementById('edit-pose-title').innerText = `Editar Pose: ${name}`;
            document.getElementById('edit-pose-textarea').value = poses[name];
            document.getElementById('edit-pose-modal').style.display = 'flex';
        };

        // Botão Excluir Pose
        item.querySelector('.btn-delete-pose').onclick = () => {
            if(confirm(`Excluir a pose "${name}"?`)) {
                const p = getLocalPoses();
                delete p[name];
                localStorage.setItem('banana_poses', JSON.stringify(p));
                document.getElementById('manage-poses-btn').click(); // Refresh
                refreshPoseList();
            }
        };
        listContainer.appendChild(item);
    });
    document.getElementById('manage-poses-modal').style.display = 'flex';
};

// Salvar Edição de Pose
document.getElementById('confirm-edit-pose-save').onclick = () => {
    const newContent = document.getElementById('edit-pose-textarea').value.trim();
    if (!newContent) return;
    
    const poses = getLocalPoses();
    poses[editingPoseName] = newContent;
    localStorage.setItem('banana_poses', JSON.stringify(poses));
    
    alert("✅ Alteração de pose salva!");
    document.getElementById('edit-pose-modal').style.display = 'none';
    refreshPoseList();
};
function toggleEffectControls(id) { const c = document.getElementById(`controls-${id}`); c.style.display = document.getElementById(`hero-${id}`).checked ? 'flex' : 'none'; }

// --- LOGICA DE POSES SALVAS ---
function getLocalPoses() {
    const p = localStorage.getItem('banana_poses');
    return p ? JSON.parse(p) : {};
}

function refreshPoseList() {
    renderPoseCarousel();
}

async function renderPoseCarousel() {
    if (!poseTrack) return;
    
    // Lista de Poses Iniciais (Hardcoded)
    const presetPoses = [
        { id: 'p1', name: 'Braços Cruzados', text: 'braços cruzados', thumb: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80' },
        { id: 'p2', name: 'Mãos nos Bolsos', text: 'mãos nos bolsos da calça', thumb: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80' },
        { id: 'p3', name: 'Mão no Queixo', text: 'mão no queixo pensativo', thumb: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80' },
        { id: 'p4', name: 'Mão na Cintura', text: 'mão na cintura atitude', thumb: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80' },
        { id: 'p5', name: 'Caminhando', text: 'caminhando em direção à câmera', thumb: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&q=80' }
    ];

    // Buscar poses do IndexedDB
    const customPoses = await PoseDB.getAllPoses();
    allPosesData = [...presetPoses, ...customPoses];

    poseTrack.innerHTML = "";
    allPosesData.forEach((pose, idx) => {
        const card = document.createElement('div');
        card.className = `pose-card ${idx === currentPoseIdx ? 'active' : ''}`;
        card.innerHTML = `
            <div class="pose-card-label">${pose.name}</div>
            <img src="${pose.thumb}" alt="${pose.name}" onerror="this.src='https://placehold.co/160x200/000/fff?text=POSE'">
        `;
        card.onclick = () => selectPose(idx);
        poseTrack.appendChild(card);
    });

    updateCarouselPosition();
}

function selectPose(idx) {
    currentPoseIdx = idx;
    const cards = poseTrack.querySelectorAll('.pose-card');
    cards.forEach((c, i) => c.classList.toggle('active', i === idx));
    updateCarouselPosition();
}

function updateCarouselPosition() {
    const cardWidth = 160 + 15; // width + gap
    const offset = -(currentPoseIdx * cardWidth);
    poseTrack.style.transform = `translateX(${offset}px)`;
}

if (posePrevBtn) posePrevBtn.onclick = () => { if (currentPoseIdx > 0) selectPose(currentPoseIdx - 1); };
if (poseNextBtn) poseNextBtn.onclick = () => { if (currentPoseIdx < allPosesData.length - 1) selectPose(currentPoseIdx + 1); };

// Lógica de Thumbnail no Modal
const poseThumbInput = document.getElementById('pose-thumb-input');
const poseThumbPreview = document.getElementById('pose-thumb-preview');
let currentPoseThumb = "";

if (poseThumbInput) {
    poseThumbInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentPoseThumb = ev.target.result;
            poseThumbPreview.querySelector('img').src = currentPoseThumb;
            poseThumbPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    };
}

// Sobrescrever Salvar Pose para incluir Imagem e usar IndexedDB
document.getElementById('confirm-save-pose').onclick = async () => {
    const name = document.getElementById('pose-name-input').value.trim();
    const content = document.getElementById('hero-pose-custom').value.trim();
    
    if (!name || !content) return;
    
    const newPose = {
        id: 'custom_' + Date.now(),
        name: name,
        text: content,
        thumb: currentPoseThumb || 'https://placehold.co/160x200/111/fff?text=Pose'
    };

    await PoseDB.savePose(newPose);
    
    alert("✅ Pose Salva com Sucesso no Banco de Dados!");
    document.getElementById('save-pose-modal').style.display='none';
    
    // Reset inputs
    document.getElementById('pose-name-input').value = "";
    currentPoseThumb = "";
    poseThumbPreview.style.display = 'none';
    
    renderPoseCarousel();
};

// Sobrescrever Lógica de Geração do Hero para pegar a pose do Carrossel
const originalHeroGen = heroGenBtn.onclick;
heroGenBtn.onclick = async () => {
    const key = apiKeyInput.value.trim();
    if (!key) { alert("Chave API não configurada."); return; }
    
    // Se o modo custom (DIGITE POSE) estiver ativo, usa o textarea.
    // Se não, usa o dado da pose selecionada no carrossel.
    const isCustomMode = document.getElementById('hero-pose-custom-toggle').checked;
    let poseText = "";
    
    if (isCustomMode) {
        poseText = document.getElementById('hero-pose-custom').value.trim() || "pose natural";
    } else {
        const selectedPose = allPosesData[currentPoseIdx];
        poseText = selectedPose ? selectedPose.text : "pose natural";
    }

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
            "POSE": poseText,
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
        const model = getVal('hero-model-select') || "gemini-3.1-flash-image-preview";
        const response = await callGeminiAPI(key, finalPromptText, [...heroRefs, ...objRefs], aspect, quality, model);
        finishFeedItem(item, `data:image/png;base64,${response}`);
        heroStatusMsg.innerText = "✨ Hero Pro Gerado!";
    } catch (e) { 
        heroStatusMsg.innerText = "❌ Erro: " + e.message; 
        item.remove(); 
    }
};

// Gerenciar Poses (Atualizado para IndexedDB)
document.getElementById('manage-poses-btn').onclick = async () => {
    const poses = await PoseDB.getAllPoses();
    const listContainer = document.getElementById('manage-poses-list');
    listContainer.innerHTML = "";
    
    if (poses.length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; opacity:0.5; font-size:12px;'>Nenhuma pose personalizada no banco de dados.</p>";
    }

    poses.forEach(pose => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px;";
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${pose.thumb}" style="width:30px; height:40px; object-fit:cover; border-radius:4px;">
                <span style="font-size:13px; font-weight:bold;">${pose.name}</span>
            </div>
            <button class="btn-delete-pose" style="padding:6px 12px; font-size:11px; cursor:pointer; background:var(--danger-red); color:white; border:none; border-radius:4px;">EXCLUIR</button>
        `;

        item.querySelector('.btn-delete-pose').onclick = async () => {
            if(confirm(`Excluir a pose "${pose.name}" permanentemente?`)) {
                await PoseDB.deletePose(pose.id);
                document.getElementById('manage-poses-btn').click(); // Refresh modal
                renderPoseCarousel();
            }
        };
        listContainer.appendChild(item);
    });
    document.getElementById('manage-poses-modal').style.display = 'flex';
};

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
    ['aspect-select', 'quality-select', 'model-select', 'saved-prompts-select', 'hero-model-select', 'hero-estilo', 'hero-pose', 'hero-expressao', 'hero-preset', 'hero-genero', 'hero-lado', 'hero-plano', 'hero-aspect-select', 'hero-quality-select'].forEach(initKodaSelect);
});

// Desativa o botão shutdown na web
const shutdownBtn = document.getElementById('shutdown-btn');
if(shutdownBtn) {
    shutdownBtn.style.opacity = '0.3';
    shutdownBtn.onclick = () => alert("Botão desativado na versão Web.");
}
