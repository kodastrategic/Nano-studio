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

async function saveDemand(demand) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(demand);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function deleteDemand(id) {
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

export async function initPipeline() {
    const demands = await getAllDemands();
    
    // Organizar por status
    const data = {
        'backlog': demands.filter(d => d.status === 'backlog'),
        'todo': demands.filter(d => d.status === 'todo'),
        'in-progress': demands.filter(d => d.status === 'in-progress'),
        'done': demands.filter(d => d.status === 'done')
    };

    // Se estiver vazio na primeira vez, pode adicionar exemplos ou começar limpo
    if (demands.length === 0) {
        const defaults = [
            { id: '1', title: 'gravar video de apresentação DCREX', tag: 'Vídeo', status: 'todo' },
            { id: '2', title: 'Iniciar meu Curso', tag: 'Educação', status: 'in-progress' }
        ];
        for (const d of defaults) await saveDemand(d);
        renderPipeline({
            'backlog': [],
            'todo': [defaults[0]],
            'in-progress': [defaults[1]],
            'done': []
        });
    } else {
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
            <span class="card-tag">${card.tag || 'Geral'}</span>
            <div class="card-actions">
                <button class="card-btn edit-btn" title="Editar">✏️</button>
                <button class="card-btn del-btn del" title="Excluir">🗑️</button>
            </div>
        `;

        div.querySelector('.edit-btn').onclick = async (e) => {
            e.stopPropagation();
            const newTitle = prompt('Novo título:', card.title);
            if (newTitle) {
                card.title = newTitle;
                div.querySelector('.card-title').textContent = newTitle;
                await saveDemand(card);
            }
        };

        div.querySelector('.del-btn').onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Excluir demanda?')) {
                const status = div.closest('.pipeline-column').dataset.status;
                await deleteDemand(card.id);
                div.remove();
                updateCount(status);
            }
        };

        return div;
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
                const newStatus = card.closest('.pipeline-column').dataset.status;
                const id = card.dataset.id;
                const title = card.querySelector('.card-title').textContent;
                const tag = card.querySelector('.card-tag').textContent;
                
                // Salvar novo status no IndexedDB
                await saveDemand({ id, title, tag, status: newStatus });
                
                containers.forEach(c => updateCount(c.parentElement.dataset.status));
            });
        });

        containers.forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
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
        const demand = { id, title, tag: 'Geral', status };
        await saveDemand(demand);
        
        const columnEl = document.querySelector(`[data-status="${status}"] .column-cards`);
        columnEl.appendChild(createCard(demand));
        updateCount(status);
        setupDragAndDrop();
    };
}
