"""
Test API - Simple REST API for swarm testing
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="Test API", version="1.0.0")

# In-memory storage
todos = [
    {"id": 1, "title": "Test deployment", "done": False},
    {"id": 2, "title": "Verify monitoring", "done": False},
]

class Todo(BaseModel):
    id: int
    title: str
    done: bool = False

class TodoCreate(BaseModel):
    title: str

@app.get("/")
def root():
    return {"message": "Test API is running", "version": "1.0.0"}

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
