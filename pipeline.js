// pipeline.js
const DB_NAME = 'NanoStudioDemandsDB';
const STORE_NAME = 'demands';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveDemandDB(demand) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(demand);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function deleteDemandDB(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getAllDemands() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

let currentEditingDemand = null;

export async function initPipeline() {
    const demands = await getAllDemands();
    
    const data = {
        'backlog': demands.filter(d => d.status === 'backlog'),
        'todo': demands.filter(d => d.status === 'todo'),
        'in-progress': demands.filter(d => d.status === 'in-progress'),
        'done': demands.filter(d => d.status === 'done')
    };

    renderPipeline(data);
    setupModalEvents();

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
            <span class="card-tag">${card.client || 'Geral'}</span>
            <div class="card-actions">
                <button class="card-btn del-btn del" title="Excluir">🗑️</button>
            </div>
        `;

        // Abrir Modal ao clicar no card
        div.onclick = () => openDemandModal(card);

        div.querySelector('.del-btn').onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Excluir demanda?')) {
                const status = div.closest('.pipeline-column').dataset.status;
                await deleteDemandDB(card.id);
                div.remove();
                updateCount(status);
            }
        };

        return div;
    }

    function openDemandModal(card) {
        currentEditingDemand = card;
        document.getElementById('demand-client-input').value = card.client || '';
        document.getElementById('demand-title-input').value = card.title || '';
        document.getElementById('demand-desc-input').value = card.desc || '';
        document.getElementById('demand-modal').style.display = 'flex';
    }

    function setupModalEvents() {
        const modal = document.getElementById('demand-modal');
        const closeBtn = document.getElementById('close-demand-modal');
        const cancelBtn = document.getElementById('cancel-demand-btn');
        const saveBtn = document.getElementById('save-demand-btn');

        const close = () => modal.style.display = 'none';
        closeBtn.onclick = close;
        cancelBtn.onclick = close;

        saveBtn.onclick = async () => {
            if (!currentEditingDemand) return;
            
            const newClient = document.getElementById('demand-client-input').value;
            const newTitle = document.getElementById('demand-title-input').value;
            const newDesc = document.getElementById('demand-desc-input').value;

            currentEditingDemand.client = newClient;
            currentEditingDemand.title = newTitle;
            currentEditingDemand.desc = newDesc;

            await saveDemandDB(currentEditingDemand);
            
            // Atualizar o card visualmente
            const cardEl = document.querySelector(`.pipeline-card[data-id="${currentEditingDemand.id}"]`);
            if (cardEl) {
                cardEl.querySelector('.card-title').textContent = newTitle;
                cardEl.querySelector('.card-tag').textContent = newClient || 'Geral';
            }

            close();
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
                
                // Buscar dados atuais do banco para não perder client/desc
                const all = await getAllDemands();
                const demand = all.find(d => d.id === id);
                if (demand) {
                    demand.status = newStatus;
                    await saveDemandDB(demand);
                }
                
                containers.forEach(c => updateCount(c.parentElement.dataset.status));
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
        const title = prompt('Título da demanda:');
        if (!title) return;
        const id = Date.now().toString();
        const demand = { id, title, client: '', desc: '', status };
        await saveDemandDB(demand);
        
        const columnEl = document.querySelector(`[data-status="${status}"] .column-cards`);
        columnEl.appendChild(createCard(demand));
        updateCount(status);
        setupDragAndDrop();
    };
}
