// pipeline.js
const DB_NAME = 'NanoStudioDemandsDB';
const STORE_DEMANDS = 'demands';
const STORE_CLIENTS = 'clients';
const STORE_JOBS = 'jobs';
const DB_VERSION = 2;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_DEMANDS)) db.createObjectStore(STORE_DEMANDS, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_CLIENTS)) db.createObjectStore(STORE_CLIENTS, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_JOBS)) db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function dbPut(store, data) {
    const db = await openDB();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(data);
    return new Promise(r => tx.oncomplete = () => r());
}

async function dbDelete(store, id) {
    const db = await openDB();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    return new Promise(r => tx.oncomplete = () => r());
}

async function dbGetAll(store) {
    const db = await openDB();
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    return new Promise(r => req.onsuccess = () => r(req.result));
}

let currentEditingDemand = null;
let allDemandsCache = [];

export async function initPipeline() {
    console.log("Pipeline Initializing...");
    await refreshConfigLists();
    await refreshDemands();
    setupMainEvents();
}

function setupMainEvents() {
    // 1. CONFIGURAÇÕES (Engrenagem e Painel Lateral)
    const configPanel = document.getElementById('pipeline-config-panel');
    const menuBtn = document.getElementById('pipeline-menu-btn');
    const closeConfigBtn = document.getElementById('close-pipeline-config');

    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            console.log("Config button clicked");
            configPanel.classList.add('active');
        });
    }
    if (closeConfigBtn) {
        closeConfigBtn.addEventListener('click', () => configPanel.classList.remove('active'));
    }

    // 2. MODAIS DE CADASTRO (Clientes e Jobs)
    const openClients = document.getElementById('open-clients-modal');
    const openJobs = document.getElementById('open-jobs-modal');

    if (openClients) {
        openClients.addEventListener('click', () => {
            document.getElementById('clients-config-modal').style.display = 'flex';
        });
    }
    if (openJobs) {
        openJobs.addEventListener('click', () => {
            document.getElementById('jobs-config-modal').style.display = 'flex';
        });
    }

    // 3. FECHAMENTO DE MODAIS (Genérico)
    const closeButtons = [
        'close-clients-modal', 'close-clients-bottom',
        'close-jobs-modal', 'close-jobs-bottom',
        'close-demand-modal', 'cancel-demand-btn'
    ];
    closeButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        }
    });

    // 4. SALVAR DEMANDA (O que não estava funcionando)
    const saveDemandBtn = document.getElementById('save-demand-btn');
    if (saveDemandBtn) {
        saveDemandBtn.addEventListener('click', async (e) => {
            console.log("Save demand clicked", currentEditingDemand);
            if (!currentEditingDemand) return;
            
            const clientVal = document.getElementById('demand-client-select').value;
            const jobVal = document.getElementById('demand-job-select').value;
            const titleVal = document.getElementById('demand-title-input').value;
            const descVal = document.getElementById('demand-desc-input').value;

            currentEditingDemand.client = clientVal;
            currentEditingDemand.jobType = jobVal;
            currentEditingDemand.title = titleVal;
            currentEditingDemand.desc = descVal;

            await dbPut(STORE_DEMANDS, currentEditingDemand);
            document.getElementById('demand-modal').style.display = 'none';
            await refreshDemands();
        });
    }

    // 5. CADASTRO DE NOVOS ITENS
    document.getElementById('add-client-btn-main').addEventListener('click', async () => {
        const name = prompt('Nome do novo cliente:');
        if (name) {
            await dbPut(STORE_CLIENTS, { id: Date.now().toString(), name });
            await refreshConfigLists();
        }
    });

    document.getElementById('add-job-btn-main').addEventListener('click', async () => {
        const name = prompt('Nome do novo tipo de job:');
        if (name) {
            await dbPut(STORE_JOBS, { id: Date.now().toString(), name });
            await refreshConfigLists();
        }
    });

    // 6. FILTROS
    document.getElementById('filter-client').addEventListener('change', applyFilters);
    document.getElementById('filter-job').addEventListener('change', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('filter-client').value = '';
        document.getElementById('filter-job').value = '';
        applyFilters();
    });
}

async function refreshDemands() {
    allDemandsCache = await dbGetAll(STORE_DEMANDS);
    applyFilters();
}

function applyFilters() {
    const cf = document.getElementById('filter-client').value;
    const jf = document.getElementById('filter-job').value;
    const filtered = allDemandsCache.filter(d => (!cf || d.client === cf) && (!jf || d.jobType === jf));
    
    const data = {
        'backlog': filtered.filter(d => d.status === 'backlog'),
        'todo': filtered.filter(d => d.status === 'todo'),
        'in-progress': filtered.filter(d => d.status === 'in-progress'),
        'done': filtered.filter(d => d.status === 'done')
    };
    renderPipeline(data);
}

function renderPipeline(data) {
    Object.keys(data).forEach(status => {
        const col = document.querySelector(`[data-status="${status}"] .column-cards`);
        if (!col) return;
        col.innerHTML = '';
        data[status].forEach(card => col.appendChild(createCard(card)));
        updateCount(status);
    });
    setupDragAndDrop();
}

function createCard(card) {
    const div = document.createElement('div');
    div.className = 'pipeline-card';
    div.draggable = true;
    div.dataset.id = card.id;
    div.innerHTML = `
        <span class="card-title">${card.title || '(Sem Título)'}</span>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">
            <span class="card-tag" style="background:rgba(52,152,219,0.2); color:#3498db;">${card.client || 'Sem Cliente'}</span>
            <span class="card-tag" style="background:rgba(155,89,182,0.2); color:#9b59b6;">${card.jobType || 'Geral'}</span>
        </div>
        <div class="card-actions"><button class="del-btn" style="background:transparent; border:none; cursor:pointer;">🗑️</button></div>
    `;

    div.addEventListener('click', (e) => {
        if (e.target.closest('.del-btn')) return;
        openDemandModal(card);
    });

    div.querySelector('.del-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Excluir demanda?')) {
            await dbDelete(STORE_DEMANDS, card.id);
            await refreshDemands();
        }
    });

    return div;
}

function openDemandModal(card) {
    currentEditingDemand = card;
    document.getElementById('demand-client-select').value = card.client || '';
    document.getElementById('demand-job-select').value = card.jobType || '';
    document.getElementById('demand-title-input').value = card.title || '';
    document.getElementById('demand-desc-input').value = card.desc || '';
    document.getElementById('demand-modal').style.display = 'flex';
}

async function refreshConfigLists() {
    const clients = await dbGetAll(STORE_CLIENTS);
    const jobs = await dbGetAll(STORE_JOBS);

    const upSelect = (ids, items, def) => {
        ids.forEach(id => {
            const s = document.getElementById(id);
            if (!s) return;
            const val = s.value;
            s.innerHTML = `<option value="">${def}</option>`;
            items.forEach(i => {
                const o = document.createElement('option');
                o.value = i.name; o.textContent = i.name; s.appendChild(o);
            });
            s.value = val;
        });
    };

    upSelect(['filter-client', 'demand-client-select'], clients, '👤 Selecionar Cliente');
    upSelect(['filter-job', 'demand-job-select'], jobs, '📋 Selecionar Job');

    const renderList = (id, items, store) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-item-row';
            row.innerHTML = `
                <span>${item.name}</span>
                <div style="display:flex; gap:10px;">
                    <button class="edit-item-btn" style="background:transparent; border:none; cursor:pointer; color:var(--accent-blue)">✏️</button>
                    <button class="del-item-btn" style="background:transparent; border:none; cursor:pointer; color:#ff4d4d">🗑️</button>
                </div>
            `;
            row.querySelector('.edit-item-btn').addEventListener('click', async () => {
                const n = prompt('Novo nome:', item.name);
                if(n) { item.name = n; await dbPut(store, item); await refreshConfigLists(); await refreshDemands(); }
            });
            row.querySelector('.del-item-btn').addEventListener('click', async () => {
                if(confirm('Excluir item?')) { await dbDelete(store, item.id); await refreshConfigLists(); }
            });
            el.appendChild(row);
        });
    };

    renderList('clients-list-full', clients, STORE_CLIENTS);
    renderList('jobs-list-full', jobs, STORE_JOBS);
}

function updateCount(s) {
    const c = document.querySelector(`[data-status="${s}"]`);
    if(c) c.querySelector('.column-count').textContent = c.querySelectorAll('.pipeline-card').length;
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.pipeline-card');
    const conts = document.querySelectorAll('.column-cards');
    
    cards.forEach(card => {
        card.ondragstart = () => card.classList.add('dragging');
        card.ondragend = async () => {
            card.classList.remove('dragging');
            const col = card.closest('.pipeline-column');
            if(col) {
                const d = allDemandsCache.find(x => x.id === card.dataset.id);
                if(d) { d.status = col.dataset.status; await dbPut(STORE_DEMANDS, d); }
                conts.forEach(c => updateCount(c.parentElement.dataset.status));
            }
        };
    });

    conts.forEach(container => {
        container.ondragover = (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            const after = [...container.querySelectorAll('.pipeline-card:not(.dragging)')].reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
            if (after == null) container.appendChild(dragging); else container.insertBefore(dragging, after);
        };
    });
}

window.addNewPipelineCard = function(status) {
    const newDemand = { id: Date.now().toString(), title: '', client: '', jobType: '', desc: '', status };
    openDemandModal(newDemand);
};
