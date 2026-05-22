// Test API Frontend with Knowledge Graph Canvas
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : window.location.origin;

class App {
    constructor() {
        this.root = document.getElementById('root');
        this.todos = [];
        this.graphData = null;
        this.currentView = 'dashboard';
        this.init();
    }

    async init() {
        this.renderNav();
        await this.checkHealth();
        await this.loadTodos();
        this.render();
    }

    async checkHealth() {
        try {
            const res = await fetch(`${API_URL}/health`);
            const data = await res.json();
            this.status = { healthy: true, ...data };
        } catch (e) {
            this.status = { healthy: false, error: e.message };
        }
    }

    async loadTodos() {
        try {
            const res = await fetch(`${API_URL}/todos`);
            this.todos = await res.json();
        } catch (e) {
            this.todos = [];
        }
    }

    async loadGraph() {
        try {
            const res = await fetch(`${API_URL}/graph?limit=300`);
            this.graphData = await res.json();
            return true;
        } catch (e) {
            console.error('Failed to load graph:', e);
            return false;
        }
    }

    setView(view) {
        this.currentView = view;
        this.render();
        if (view === 'graph') {
            this.initGraphCanvas();
        }
    }

    renderNav() {
        const nav = document.createElement('nav');
        nav.className = 'nav';
        nav.innerHTML = `
            <div class="nav-brand">🚀 Test API</div>
            <div class="nav-links">
                <button class="nav-btn ${this.currentView === 'dashboard' ? 'active' : ''}" onclick="app.setView('dashboard')">Dashboard</button>
                <button class="nav-btn ${this.currentView === 'graph' ? 'active' : ''}" onclick="app.setView('graph')">Knowledge Graph</button>
                <a href="${API_URL}/graph-full" target="_blank" class="nav-btn">Full Graph</a>
            </div>
        `;
        this.root.appendChild(nav);
    }

    render() {
        // Clear content but keep nav
        const oldContent = this.root.querySelector('.content');
        if (oldContent) oldContent.remove();

        const content = document.createElement('div');
        content.className = 'content';

        if (this.currentView === 'dashboard') {
            content.innerHTML = this.renderDashboard();
        } else if (this.currentView === 'graph') {
            content.innerHTML = this.renderGraphView();
        }

        this.root.appendChild(content);
    }

    renderDashboard() {
        const statusClass = this.status?.healthy ? 'healthy' : 'error';
        const statusText = this.status?.healthy ? '✓ API Connected' : '✗ API Offline';

        return `
            <div class="container">
                <h1>Dashboard</h1>
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

    renderGraphView() {
        return `
            <div class="graph-container">
                <div class="graph-header">
                    <h1>🕸️ Knowledge Graph</h1>
                    <div class="graph-stats" id="graph-stats">Loading...</div>
                </div>
                <div class="canvas-wrapper">
                    <canvas id="graph-canvas"></canvas>
                    <div class="graph-tooltip" id="graph-tooltip"></div>
                </div>
                <div class="graph-controls">
                    <button onclick="app.resetGraph()">Reset View</button>
                    <button onclick="app.zoomIn()">Zoom In</button>
                    <button onclick="app.zoomOut()">Zoom Out</button>
                </div>
            </div>
        `;
    }

    async initGraphCanvas() {
        if (!this.graphData) {
            const loaded = await this.loadGraph();
            if (!loaded) {
                document.getElementById('graph-stats').textContent = 'Failed to load graph data';
                return;
            }
        }

        const { nodes, links, total_nodes, shown_nodes, shown_links } = this.graphData;
        
        document.getElementById('graph-stats').innerHTML = `
            Showing ${shown_nodes} of ${total_nodes} nodes | ${shown_links} edges
        `;

        const canvas = document.getElementById('graph-canvas');
        const ctx = canvas.getContext('2d');
        const wrapper = canvas.parentElement;
        
        // Set canvas size
        const rect = wrapper.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height || 600;

        // Color map for communities
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#D7BDE2', '#AED6F1',
        ];

        // Layout nodes
        const nodeMap = {};
        const width = canvas.width;
        const height = canvas.height;
        
        // Group by community
        const communities = {};
        nodes.forEach(node => {
            const comm = node.community || 0;
            if (!communities[comm]) communities[comm] = [];
            communities[comm].push(node);
        });

        // Position in clusters
        const commList = Object.keys(communities);
        const centerX = width / 2;
        const centerY = height / 2;
        
        nodes.forEach(node => {
            const commIdx = commList.indexOf(String(node.community || 0));
            const angle = (2 * Math.PI * commIdx) / Math.max(commList.length, 1);
            const clusterRadius = Math.min(width, height) * 0.3;
            const cx = centerX + Math.cos(angle) * clusterRadius;
            const cy = centerY + Math.sin(angle) * clusterRadius;
            
            const nodeAngle = Math.random() * 2 * Math.PI;
            const nodeRadius = 30 + Math.random() * 50;
            
            nodeMap[node.id] = {
                ...node,
                x: cx + Math.cos(nodeAngle) * nodeRadius,
                y: cy + Math.sin(nodeAngle) * nodeRadius,
                vx: 0,
                vy: 0,
                color: colors[commIdx % colors.length],
            };
        });

        // Simple force simulation
        const iterations = 100;
        for (let i = 0; i < iterations; i++) {
            // Repulsion
            Object.values(nodeMap).forEach((a, idx, arr) => {
                Object.values(nodeMap).forEach((b, jdx) => {
                    if (idx >= jdx) return;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = 500 / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    a.vx -= fx;
                    a.vy -= fy;
                    b.vx += fx;
                    b.vy += fy;
                });
            });

            // Attraction along edges
            links.forEach(link => {
                const source = nodeMap[link.source];
                const target = nodeMap[link.target];
                if (!source || !target) return;
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = dist * 0.001;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                source.vx += fx;
                source.vy += fy;
                target.vx -= fx;
                target.vy -= fy;
            });

            // Center gravity
            Object.values(nodeMap).forEach(node => {
                node.vx += (centerX - node.x) * 0.001;
                node.vy += (centerY - node.y) * 0.001;
            });

            // Apply velocity
            Object.values(nodeMap).forEach(node => {
                node.x += node.vx * 0.1;
                node.y += node.vy * 0.1;
                node.vx *= 0.9;
                node.vy *= 0.9;

                // Bounds
                node.x = Math.max(20, Math.min(width - 20, node.x));
                node.y = Math.max(20, Math.min(height - 20, node.y));
            });
        }

        // Rendering state
        let transform = { x: 0, y: 0, scale: 1 };
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let hoveredNode = null;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.scale, transform.scale);

            // Draw edges
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.3)';
            ctx.lineWidth = 0.5;
            links.forEach(link => {
                const source = nodeMap[link.source];
                const target = nodeMap[link.target];
                if (!source || !target) return;
                ctx.beginPath();
                ctx.moveTo(source.x, source.y);
                ctx.lineTo(target.x, target.y);
                ctx.stroke();
            });

            // Draw nodes
            Object.values(nodeMap).forEach(node => {
                const isHovered = hoveredNode === node;
                const radius = isHovered ? 8 : 5;
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = node.color;
                ctx.fill();
                
                if (isHovered) {
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                // Label for larger nodes or hovered
                if (isHovered || node._degree > 5) {
                    ctx.fillStyle = '#333';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(node.label?.substring(0, 15) || node.id, node.x, node.y - radius - 2);
                }
            });

            ctx.restore();
        };

        // Mouse interaction
        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left - transform.x) / transform.scale,
                y: (e.clientY - rect.top - transform.y) / transform.scale,
            };
        };

        const findNodeAt = (pos) => {
            let closest = null;
            let closestDist = Infinity;
            Object.values(nodeMap).forEach(node => {
                const dx = node.x - pos.x;
                const dy = node.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 10 && dist < closestDist) {
                    closest = node;
                    closestDist = dist;
                }
            });
            return closest;
        };

        canvas.addEventListener('mousemove', (e) => {
            const pos = getMousePos(e);
            if (isDragging) {
                transform.x = e.clientX - dragStart.x;
                transform.y = e.clientY - dragStart.y;
                draw();
                return;
            }
            
            const node = findNodeAt(pos);
            if (node !== hoveredNode) {
                hoveredNode = node;
                draw();
                
                const tooltip = document.getElementById('graph-tooltip');
                if (node) {
                    tooltip.innerHTML = `
                        <strong>${node.label || node.id}</strong><br>
                        Type: ${node.file_type || 'unknown'}<br>
                        Community: ${node.community || 0}<br>
                        Source: ${(node.source_file || '').substring(0, 40)}
                    `;
                    tooltip.style.left = e.clientX + 10 + 'px';
                    tooltip.style.top = e.clientY + 10 + 'px';
                    tooltip.style.display = 'block';
                } else {
                    tooltip.style.display = 'none';
                }
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStart.x = e.clientX - transform.x;
            dragStart.y = e.clientY - transform.y;
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            transform.x = mouseX - (mouseX - transform.x) * zoomFactor;
            transform.y = mouseY - (mouseY - transform.y) * zoomFactor;
            transform.scale *= zoomFactor;
            
            draw();
        });

        // Expose controls
        this.resetGraph = () => {
            transform = { x: 0, y: 0, scale: 1 };
            draw();
        };
        this.zoomIn = () => {
            transform.scale *= 1.2;
            draw();
        };
        this.zoomOut = () => {
            transform.scale *= 0.8;
            draw();
        };

        // Initial draw
        draw();
    }
}

// Start app
const app = new App();
