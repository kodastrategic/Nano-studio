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
    await refreshConfigLists();
    await refreshDemands();
    setupMainEvents();
}

function setupMainEvents() {
    // Menu Principal (Engrenagem)
    document.getElementById('pipeline-menu-btn').onclick = () => {
        document.getElementById('pipeline-config-modal').style.display = 'flex';
    };
    document.getElementById('close-pipeline-config').onclick = () => {
        document.getElementById('pipeline-config-modal').style.display = 'none';
    };

    // Sub-modais de Config
    document.getElementById('open-clients-modal').onclick = () => {
        document.getElementById('clients-config-modal').style.display = 'flex';
    };
    document.getElementById('open-jobs-modal').onclick = () => {
        document.getElementById('jobs-config-modal').style.display = 'flex';
    };

    ['close-clients-modal', 'close-clients-bottom'].forEach(id => {
        document.getElementById(id).onclick = () => document.getElementById('clients-config-modal').style.display = 'none';
    });
    ['close-jobs-modal', 'close-jobs-bottom'].forEach(id => {
        document.getElementById(id).onclick = () => document.getElementById('jobs-config-modal').style.display = 'none';
    });

    // Filtros
    document.getElementById('filter-client').onchange = applyFilters;
    document.getElementById('filter-job').onchange = applyFilters;
    document.getElementById('clear-filters').onclick = () => {
        document.getElementById('filter-client').value = '';
        document.getElementById('filter-job').value = '';
        applyFilters();
    };

    // Cadastro de Itens (Botões Grandes)
    document.getElementById('add-client-btn-main').onclick = async () => {
        const name = prompt('Nome do novo cliente:');
        if (name) {
            await dbPut(STORE_CLIENTS, { id: Date.now().toString(), name });
            await refreshConfigLists();
        }
    };

    document.getElementById('add-job-btn-main').onclick = async () => {
        const name = prompt('Nome do novo tipo de job:');
        if (name) {
            await dbPut(STORE_JOBS, { id: Date.now().toString(), name });
            await refreshConfigLists();
        }
    };

    // Modal de Demanda (Save/Close)
    document.getElementById('close-demand-modal').onclick = () => document.getElementById('demand-modal').style.display = 'none';
    document.getElementById('cancel-demand-btn').onclick = () => document.getElementById('demand-modal').style.display = 'none';
    
    document.getElementById('save-demand-btn').onclick = async () => {
        if (!currentEditingDemand) return;
        currentEditingDemand.client = document.getElementById('demand-client-select').value;
        currentEditingDemand.jobType = document.getElementById('demand-job-select').value;
        currentEditingDemand.title = document.getElementById('demand-title-input').value;
        currentEditingDemand.desc = document.getElementById('demand-desc-input').value;
        await dbPut(STORE_DEMANDS, currentEditingDemand);
        document.getElementById('demand-modal').style.display = 'none';
        await refreshDemands();
    };
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
        <div class="card-actions"><button class="card-btn del-btn del">🗑️</button></div>
    `;
    div.onclick = () => {
        currentEditingDemand = card;
        document.getElementById('demand-client-select').value = card.client || '';
        document.getElementById('demand-job-select').value = card.jobType || '';
        document.getElementById('demand-title-input').value = card.title || '';
        document.getElementById('demand-desc-input').value = card.desc || '';
        document.getElementById('demand-modal').style.display = 'flex';
    };
    div.querySelector('.del-btn').onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Excluir demanda?')) {
            await dbDelete(STORE_DEMANDS, card.id);
            await refreshDemands();
        }
    };
    return div;
}

async function refreshConfigLists() {
    const clients = await dbGetAll(STORE_CLIENTS);
    const jobs = await dbGetAll(STORE_JOBS);

    const upSelect = (ids, items, def) => {
        ids.forEach(id => {
            const s = document.getElementById(id);
            const val = s.value;
            s.innerHTML = `<option value="">${def}</option>`;
            items.forEach(i => {
                const o = document.createElement('option');
                o.value = i.name; o.textContent = i.name; s.appendChild(o);
            });
            s.value = val;
        });
    };

    upSelect(['filter-client', 'demand-client-select'], clients, '👤 Todos Clientes');
    upSelect(['filter-job', 'demand-job-select'], jobs, '📋 Todos Jobs');

    const renderList = (id, items, store) => {
        const el = document.getElementById(id);
        el.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'list-item-row';
            row.innerHTML = `
                <span>${item.name}</span>
                <div style="display:flex; gap:10px;">
                    <button class="card-btn" style="color:var(--accent-blue)">✏️</button>
                    <button class="card-btn del" style="color:#ff4d4d">🗑️</button>
                </div>
            `;
            row.querySelectorAll('button')[0].onclick = async () => {
                const n = prompt('Novo nome:', item.name);
                if(n) { item.name = n; await dbPut(store, item); await refreshConfigLists(); await refreshDemands(); }
            };
            row.querySelectorAll('button')[1].onclick = async () => {
                if(confirm('Excluir item?')) { await dbDelete(store, item.id); await refreshConfigLists(); }
            };
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
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', async () => {
            card.classList.remove('dragging');
            const col = card.closest('.pipeline-column');
            if(col) {
                const d = allDemandsCache.find(x => x.id === card.dataset.id);
                if(d) { d.status = col.dataset.status; await dbPut(STORE_DEMANDS, d); }
                conts.forEach(c => updateCount(c.parentElement.dataset.status));
            }
        });
    });
    conts.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            const after = [...container.querySelectorAll('.pipeline-card:not(.dragging)')].reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
            if (after == null) container.appendChild(dragging); else container.insertBefore(dragging, after);
        });
    });
}

window.addNewPipelineCard = function(status) {
    currentEditingDemand = { id: Date.now().toString(), title: '', client: '', jobType: '', desc: '', status };
    document.getElementById('demand-client-select').value = '';
    document.getElementById('demand-job-select').value = '';
    document.getElementById('demand-title-input').value = '';
    document.getElementById('demand-desc-input').value = '';
    document.getElementById('demand-modal').style.display = 'flex';
};
