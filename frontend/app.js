// Simple frontend for Test API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class App {
    constructor() {
        this.root = document.getElementById('root');
        this.todos = [];
        this.init();
    }

    async init() {
        this.render();
        await this.checkHealth();
        await this.loadTodos();
    }

    async checkHealth() {
        try {
            const res = await fetch(`${API_URL}/health`);
            const data = await res.json();
            this.status = { healthy: true, ...data };
        } catch (e) {
            this.status = { healthy: false, error: e.message };
        }
        this.render();
    }

    async loadTodos() {
        try {
            const res = await fetch(`${API_URL}/todos`);
            this.todos = await res.json();
        } catch (e) {
            this.todos = [];
        }
        this.render();
    }

    render() {
        const statusClass = this.status?.healthy ? 'healthy' : 'error';
        const statusText = this.status?.healthy ? '✓ API Connected' : '✗ API Offline';

        this.root.innerHTML = `
            <div class="container">
                <h1>🚀 Test API Dashboard</h1>
                <div class="status ${statusClass}">
                    <strong>${statusText}</strong>
                    ${this.status?.todos_count ? `<br>Todos: ${this.status.todos_count}` : ''}
                </div>
                <h2>Todo List</h2>
                <ul class="todo-list">
                    ${this.todos.map(todo => `
                        <li class="todo-item ${todo.done ? 'done' : ''}">
                            <input type="checkbox" ${todo.done ? 'checked' : ''} disabled>
                            ${todo.title}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
}

new App();
