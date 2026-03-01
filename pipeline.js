// pipeline.js
const DB_NAME = 'NanoStudioDemandsDB';
const STORE_DEMANDS = 'demands';
const STORE_CLIENTS = 'clients';
const STORE_JOBS = 'jobs';
const DB_VERSION = 2; // Incrementar versão para novos stores

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_DEMANDS)) {
                db.createObjectStore(STORE_DEMANDS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_CLIENTS)) {
                db.createObjectStore(STORE_CLIENTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_JOBS)) {
                db.createObjectStore(STORE_JOBS, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Funções Genéricas de DB
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
    setupModalEvents();
    setupConfigEvents();
    setupFilterEvents();

    // Menu Hamburger
    document.getElementById('pipeline-menu-btn').onclick = () => {
        document.getElementById('pipeline-config-modal').style.display = 'flex';
    };
    document.getElementById('close-pipeline-config').onclick = () => {
        document.getElementById('pipeline-config-modal').style.display = 'none';
    };
}

async function refreshDemands() {
    allDemandsCache = await dbGetAll(STORE_DEMANDS);
    applyFilters();
}

function applyFilters() {
    const clientFilter = document.getElementById('filter-client').value;
    const jobFilter = document.getElementById('filter-job').value;

    const filtered = allDemandsCache.filter(d => {
        const matchClient = !clientFilter || d.client === clientFilter;
        const matchJob = !jobFilter || d.jobType === jobFilter;
        return matchClient && matchJob;
    });

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
        const columnEl = document.querySelector(`[data-status="${status}"] .column-cards`);
        if (!columnEl) return;
        columnEl.innerHTML = '';
        data[status].forEach(card => {
            const cardEl = createCard(card);
            columnEl.appendChild(cardEl);
        });
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
        <span class="card-title">${card.title}</span>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">
            <span class="card-tag" style="background:rgba(52,152,219,0.2); color:#3498db;">${card.client || 'Sem Cliente'}</span>
            <span class="card-tag" style="background:rgba(155,89,182,0.2); color:#9b59b6;">${card.jobType || 'Geral'}</span>
        </div>
        <div class="card-actions">
            <button class="card-btn del-btn del" title="Excluir">🗑️</button>
        </div>
    `;

    div.onclick = () => openDemandModal(card);

    div.querySelector('.del-btn').onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Excluir demanda?')) {
            await dbDelete(STORE_DEMANDS, card.id);
            await refreshDemands();
        }
    };

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

function setupModalEvents() {
    const modal = document.getElementById('demand-modal');
    document.getElementById('close-demand-modal').onclick = () => modal.style.display = 'none';
    document.getElementById('cancel-demand-btn').onclick = () => modal.style.display = 'none';

    document.getElementById('save-demand-btn').onclick = async () => {
        if (!currentEditingDemand) return;
        
        currentEditingDemand.client = document.getElementById('demand-client-select').value;
        currentEditingDemand.jobType = document.getElementById('demand-job-select').value;
        currentEditingDemand.title = document.getElementById('demand-title-input').value;
        currentEditingDemand.desc = document.getElementById('demand-desc-input').value;

        await dbPut(STORE_DEMANDS, currentEditingDemand);
        modal.style.display = 'none';
        await refreshDemands();
    };
}

async function refreshConfigLists() {
    const clients = await dbGetAll(STORE_CLIENTS);
    const jobs = await dbGetAll(STORE_JOBS);

    // Atualizar Filtros
    const fClient = document.getElementById('filter-client');
    const fJob = document.getElementById('filter-job');
    const dClient = document.getElementById('demand-client-select');
    const dJob = document.getElementById('demand-job-select');

    const updateSelect = (select, items, defaultText) => {
        const val = select.value;
        select.innerHTML = `<option value="">${defaultText}</option>`;
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.name;
            opt.textContent = item.name;
            select.appendChild(opt);
        });
        select.value = val;
    };

    updateSelect(fClient, clients, '👤 Todos Clientes');
    updateSelect(fJob, jobs, '📋 Todos Jobs');
    updateSelect(dClient, clients, 'Selecione um cliente...');
    updateSelect(dJob, jobs, 'Selecione o tipo de tarefa...');

    // Atualizar Listas no Config Modal
    const cList = document.getElementById('clients-list');
    const jList = document.getElementById('jobs-list');

    const renderList = (el, items, store) => {
        el.innerHTML = '';
        items.forEach(item => {
            const span = document.createElement('span');
            span.className = 'card-tag';
            span.style.padding = '5px 10px';
            span.style.display = 'flex';
            span.style.alignItems = 'center';
            span.style.gap = '8px';
            span.innerHTML = `${item.name} <b style="cursor:pointer; color:#ff4d4d">×</b>`;
            span.querySelector('b').onclick = async () => {
                await dbDelete(store, item.id);
                await refreshConfigLists();
            };
            el.appendChild(span);
        });
    };

    renderList(cList, clients, STORE_CLIENTS);
    renderList(jList, jobs, STORE_JOBS);
}

function setupConfigEvents() {
    document.getElementById('add-client-btn').onclick = async () => {
        const name = document.getElementById('new-client-name').value.trim();
        if (name) {
            await dbPut(STORE_CLIENTS, { id: Date.now().toString(), name });
            document.getElementById('new-client-name').value = '';
            await refreshConfigLists();
        }
    };

    document.getElementById('add-job-btn').onclick = async () => {
        const name = document.getElementById('new-job-name').value.trim();
        if (name) {
            await dbPut(STORE_JOBS, { id: Date.now().toString(), name });
            document.getElementById('new-job-name').value = '';
            await refreshConfigLists();
        }
    };
}

function setupFilterEvents() {
    document.getElementById('filter-client').onchange = applyFilters;
    document.getElementById('filter-job').onchange = applyFilters;
    document.getElementById('clear-filters').onclick = () => {
        document.getElementById('filter-client').value = '';
        document.getElementById('filter-job').value = '';
        applyFilters();
    };
}

function updateCount(status) {
    const column = document.querySelector(`[data-status="${status}"]`);
    if (!column) return;
    column.querySelector('.column-count').textContent = column.querySelectorAll('.pipeline-card').length;
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.pipeline-card');
    const containers = document.querySelectorAll('.column-cards');

    cards.forEach(card => {
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', async () => {
            card.classList.remove('dragging');
            const column = card.closest('.pipeline-column');
            if (!column) return;
            
            const newStatus = column.dataset.status;
            const id = card.dataset.id;
            
            const demand = allDemandsCache.find(d => d.id === id);
            if (demand && demand.status !== newStatus) {
                demand.status = newStatus;
                await dbPut(STORE_DEMANDS, demand);
                // Não precisa de refresh total para manter performance no drag
                containers.forEach(c => updateCount(c.parentElement.dataset.status));
            }
        });
    });

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.pipeline-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

window.addNewPipelineCard = async function(status) {
    const id = Date.now().toString();
    const newDemand = { id, title: '', client: '', jobType: '', desc: '', status };
    
    // Abrir o modal com os campos vazios para preenchimento
    openDemandModal(newDemand);
    
    // Opcional: Adicionar um listener temporário ou flag para saber que é um novo item ao salvar
    // Mas a lógica de saveDemandDB já lida com .put (insere se não existir)
};
