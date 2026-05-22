"""
Test API - Simple REST API for swarm testing with Knowledge Graph
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
import json
import uvicorn

# TODO: Add Sentry monitoring
# import sentry_sdk
# sentry_sdk.init(
#     dsn="https://db480c357852bccab74c9ff2eb4a680a@o4511432864563200.ingest.de.sentry.io/4511433692807249",
#     traces_sample_rate=1.0,
# )

app = FastAPI(title="Test API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
todos = [
    {"id": 1, "title": "Test deployment", "done": False},
    {"id": 2, "title": "Verify monitoring", "done": False},
    {"id": 3, "title": "View knowledge graph", "done": False},
]

# Graphify data path
GRAPH_PATH = Path("/Users/mrrobot1/vaults/master-vault/graphify-out/graph.json")

class Todo(BaseModel):
    id: int
    title: str
    done: bool = False

class TodoCreate(BaseModel):
    title: str

@app.get("/")
def root():
    return {
        "message": "Test API is running",
        "version": "1.0.0",
        "features": ["todos", "health", "graph"]
    }

@app.get("/health")
def health():
    return {"status": "healthy", "todos_count": len(todos)}

@app.get("/todos", response_model=List[Todo])
def list_todos():
    return todos

@app.post("/todos", response_model=Todo)
def create_todo(todo: TodoCreate):
    new_todo = {
        "id": len(todos) + 1,
        "title": todo.title,
        "done": False,
    }
    todos.append(new_todo)
    return new_todo

@app.get("/todos/{todo_id}")
def get_todo(todo_id: int):
    for todo in todos:
        if todo["id"] == todo_id:
            return todo
    raise HTTPException(status_code=404, detail="Todo not found")

@app.get("/graph")
def get_graph(limit: int = 200):
    """Serve knowledge graph data from graphify."""
    if not GRAPH_PATH.exists():
        raise HTTPException(status_code=404, detail="Graph data not found")
    
    try:
        with open(GRAPH_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        nodes = data.get("nodes", [])
        links = data.get("links", [])
        
        # Compute degrees
        degree = {n["id"]: 0 for n in nodes}
        for link in links:
            s = link.get("source")
            t = link.get("target")
            if s in degree:
                degree[s] += 1
            if t in degree:
                degree[t] += 1
        
        # Top N by degree
        nodes_sorted = sorted(nodes, key=lambda n: degree.get(n["id"], 0), reverse=True)
        top_nodes = nodes_sorted[:limit]
        top_ids = {n["id"] for n in top_nodes}
        
        # Filter links
        top_links = [l for l in links if l.get("source") in top_ids and l.get("target") in top_ids]
        
        return {
            "nodes": top_nodes,
            "links": top_links,
            "total_nodes": len(nodes),
            "total_links": len(links),
            "shown_nodes": len(top_nodes),
            "shown_links": len(top_links),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph-full")
def get_graph_full():
    """Serve the full graphify HTML visualization."""
    html_path = Path("/Users/mrrobot1/vaults/master-vault/graphify-out/graph.html")
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="Graph HTML not found")
    return FileResponse(html_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
