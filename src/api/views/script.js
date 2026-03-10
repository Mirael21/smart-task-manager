// src/api/views/script.js
const socket = io();

// Глобальная функция для отладки
window.debug = {
    loadTasks: loadTasks,
    socket: socket
};

// Подключение к WebSocket
socket.on('connect', () => {
    console.log('🟢 Connected to WebSocket server');
    addEvent('🟢 Connected to server', 'success');
    socket.emit('subscribe', ['TaskCreated', 'TaskCompleted', 'TaskUpdated', 'TaskDeleted']);
});

socket.on('connect_error', (error) => {
    console.error('🔴 WebSocket connection error:', error);
    addEvent('🔴 WebSocket connection error', 'error');
});

socket.on('event', (data) => {
    console.log('📢 WebSocket event received:', data);
    addEvent(`📢 ${data.eventType || data.type}`, 'success');
    loadTasks(); // Перезагружаем задачи при событии
});

// Загрузка задач
async function loadTasks() {
    console.log('📊 Loading tasks...');
    
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Tasks loaded:', data);
        
        displayTasks(data.tasks);
        updateStats(data.total);
        
        return data;
    } catch (error) {
        console.error('❌ Error loading tasks:', error);
        addEvent('❌ Error loading tasks', 'error');
    }
}

// Отображение задач
function displayTasks(tasks) {
    console.log('🖥️ Displaying tasks:', tasks.length);
    
    const container = document.getElementById('tasks');
    if (!container) {
        console.error('❌ Tasks container not found!');
        return;
    }
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="no-tasks">Нет задач</div>';
        return;
    }
    
    let html = '';
    
    tasks.forEach(task => {
        const statusClass = `status-${task.status}`;
        const statusText = task.status === 'todo' ? 'К выполнению' : 
                          task.status === 'done' ? '✅ Выполнено' : 
                          task.status === 'deleted' ? '🗑️ Удалено' : task.status;
        
        const createdDate = new Date(task.created_at).toLocaleString('ru-RU');
        const completedDate = task.completed_at ? new Date(task.completed_at).toLocaleString('ru-RU') : null;
        
        html += `
            <div class="task-card" data-id="${task.id}">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-description">${escapeHtml(task.description || 'Нет описания')}</div>
                <div class="task-meta">
                    <span class="task-status ${statusClass}">${statusText}</span>
                    <span>🕒 ${createdDate}</span>
                    ${completedDate ? `<span>✅ ${completedDate}</span>` : ''}
                </div>
                <div class="task-actions">
                    ${task.status === 'todo' ? 
                        `<button onclick="completeTask('${task.id}')" class="btn-complete">✅ Завершить</button>` : 
                        task.status === 'done' ?
                        `<button onclick="reopenTask('${task.id}')" class="btn-reopen">🔄 Открыть</button>` : ''
                    }
                    ${task.status !== 'deleted' ? 
                        `<button onclick="deleteTask('${task.id}')" class="btn-delete">🗑️ Удалить</button>` : ''
                    }
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('✅ Tasks displayed');
}

// Обновление статистики
function updateStats(total) {
    const totalEl = document.getElementById('totalTasks');
    if (totalEl) {
        totalEl.textContent = total || 0;
    }
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Создание задачи
async function createTask() {
    console.log('📤 Creating task...');
    
    const titleInput = document.getElementById('taskTitle');
    const descriptionInput = document.getElementById('taskDescription');
    
    const title = titleInput?.value?.trim();
    const description = descriptionInput?.value?.trim();
    
    if (!title) {
        alert('Введите название задачи');
        return;
    }
    
    try {
        addEvent('📤 Creating task...', 'info');
        
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Task created:', result);
        
        addEvent(`✅ Task created: ${result.title}`, 'success');
        
        // Очищаем поля
        if (titleInput) titleInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Загружаем обновленный список
        await loadTasks();
        
    } catch (error) {
        console.error('❌ Error creating task:', error);
        addEvent('❌ Error creating task', 'error');
    }
}

// Завершение задачи
async function completeTask(id) {
    console.log('🔄 Completing task:', id);
    
    try {
        addEvent(`🔄 Completing task...`, 'info');
        
        const response = await fetch(`/api/tasks/${id}/complete`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Task completed:', result);
        
        addEvent(`✅ Task completed`, 'success');
        await loadTasks();
        
    } catch (error) {
        console.error('❌ Error completing task:', error);
        addEvent('❌ Error completing task', 'error');
    }
}

// Переоткрытие задачи
async function reopenTask(id) {
    console.log('🔄 Reopening task:', id);
    
    try {
        addEvent(`🔄 Reopening task...`, 'info');
        
        const response = await fetch(`/api/tasks/${id}/reopen`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔄 Task reopened:', result);
        
        addEvent(`🔄 Task reopened`, 'success');
        await loadTasks();
        
    } catch (error) {
        console.error('❌ Error reopening task:', error);
        addEvent('❌ Error reopening task', 'error');
    }
}

// Удаление задачи
async function deleteTask(id) {
    if (!confirm('Удалить задачу?')) return;
    
    console.log('🗑️ Deleting task:', id);
    
    try {
        addEvent(`🗑️ Deleting task...`, 'info');
        
        const response = await fetch(`/api/tasks/${id}`, { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Deleted from UI' })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('🗑️ Task deleted');
        addEvent(`🗑️ Task deleted`, 'success');
        await loadTasks();
        
    } catch (error) {
        console.error('❌ Error deleting task:', error);
        addEvent('❌ Error deleting task', 'error');
    }
}

// Добавление события в лог
function addEvent(message, type = 'info') {
    const log = document.getElementById('events');
    if (!log) {
        console.log('📝', message);
        return;
    }
    
    const eventEl = document.createElement('div');
    eventEl.className = `event-item ${type}`;
    
    const time = new Date().toLocaleTimeString('ru-RU');
    eventEl.textContent = `${time}: ${message}`;
    
    log.prepend(eventEl);
    
    if (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
    
    console.log(`[${type}] ${message}`);
}

// Загрузка статистики очереди
async function loadQueueStats() {
    try {
        const response = await fetch('/debug/queue');
        if (!response.ok) return;
        
        const data = await response.json();
        
        const queueSizeEl = document.getElementById('queueSize');
        if (queueSizeEl) queueSizeEl.textContent = data.size || 0;
        
        const wsClientsEl = document.getElementById('wsClients');
        if (wsClientsEl) wsClientsEl.textContent = data.clients || 0;
        
    } catch (error) {
        console.error('Error loading queue stats:', error);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 UI initialized');
    
    // Загружаем задачи
    loadTasks();
    
    // Загружаем статистику
    loadQueueStats();
    
    // Обновление статистики каждые 2 секунды
    setInterval(loadQueueStats, 2000);
    
    // Обработчик Enter
    const titleInput = document.getElementById('taskTitle');
    if (titleInput) {
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') createTask();
        });
    }
    
    // Делаем функции глобальными для доступа из HTML
    window.createTask = createTask;
    window.completeTask = completeTask;
    window.reopenTask = reopenTask;
    window.deleteTask = deleteTask;
    window.loadTasks = loadTasks;
});

// Экспорт в глобальную область
window.createTask = createTask;
window.completeTask = completeTask;
window.reopenTask = reopenTask;
window.deleteTask = deleteTask;
window.loadTasks = loadTasks;