// pipeline.js
export function initPipeline() {
    const columns = document.querySelectorAll('.column-cards');
    
    // Dados iniciais (mock)
    const initialData = {
        'todo': [
            { id: 1, title: 'gravar video de apresentação DCREX', tag: 'Vídeo' },
            { id: 2, title: 'Aula, introdução do figma', tag: 'Design' }
        ],
        'in-progress': [
            { id: 3, title: 'Iniciar meu Curso', tag: 'Educação' }
        ],
        'done': [
            { id: 4, title: 'ID Becker Smart', tag: 'Branding' }
        ]
    };

    renderPipeline(initialData);

    function renderPipeline(data) {
        Object.keys(data).forEach(columnId => {
            const columnEl = document.querySelector(`[data-status="${columnId}"] .column-cards`);
            if (!columnEl) return;
            
            columnEl.innerHTML = '';
            data[columnId].forEach(card => {
                const cardEl = createCard(card);
                columnEl.appendChild(cardEl);
            });
            updateCount(columnId);
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
            <span class="card-tag">${card.tag}</span>
        `;
        return div;
    }

    function updateCount(columnId) {
        const column = document.querySelector(`[data-status="${columnId}"]`);
        const countEl = column.querySelector('.column-count');
        const cards = column.querySelectorAll('.pipeline-card');
        countEl.textContent = cards.length;
    }

    function setupDragAndDrop() {
        const cards = document.querySelectorAll('.pipeline-card');
        const containers = document.querySelectorAll('.column-cards');

        cards.forEach(card => {
            card.addEventListener('dragstart', () => {
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                containers.forEach(c => updateCount(c.parentElement.dataset.status));
            });
        });

        containers.forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(container, e.clientY);
                const dragging = document.querySelector('.dragging');
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

    // Expor função para adicionar card via UI se necessário
    window.addNewPipelineCard = function(columnId) {
        const title = prompt('Título da demanda:');
        if (!title) return;
        const columnEl = document.querySelector(`[data-status="${columnId}"] .column-cards`);
        const newCard = createCard({ id: Date.now(), title, tag: 'Geral' });
        columnEl.appendChild(newCard);
        updateCount(columnId);
        setupDragAndDrop();
    };
}
