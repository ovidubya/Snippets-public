import React, { useState, useEffect } from 'react';

export default function App() {
  // 1. Essential State Only
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'active', 'completed'
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastAction, setLastAction] = useState({ text: 'App loaded', type: 'neutral' });

  // 2. One Effect for the Timer (Side Effect)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Derived State (Calculated on every render)
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  
  const isInputValid = inputValue.length === 0 || inputValue.length >= 3;
  const inputError = !isInputValid ? 'Must be at least 3 chars' : '';

  // Filter Logic
  const filteredTodos = todos.filter((t) => {
    const matchesSearch = t.text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filterType === 'all' ? true :
      filterType === 'completed' ? t.completed :
      !t.completed;
    return matchesSearch && matchesFilter;
  });

  // Stats
  const totalCount = todos.length;
  const completedCount = todos.filter(t => t.completed).length;
  const pendingCount = totalCount - completedCount;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // 4. Handlers
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !isInputValid) return;

    const newTodo = {
      id: Date.now(),
      text: inputValue,
      completed: false,
    };
    
    setTodos([...todos, newTodo]);
    setInputValue('');
    setLastAction({ text: `Added "${newTodo.text}"`, type: 'success' });
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    setLastAction({ text: 'Updated status', type: 'info' });
  };

  const deleteTodo = (id) => {
    const todo = todos.find(t => t.id === id);
    setTodos(todos.filter(t => t.id !== id));
    setLastAction({ text: `Deleted "${todo?.text}"`, type: 'danger' });
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditValue(todo.text);
  };

  const saveEdit = () => {
    setTodos(todos.map(t => t.id === editingId ? { ...t, text: editValue } : t));
    setEditingId(null);
    setLastAction({ text: 'Updated content', type: 'info' });
  };

  const clearCompleted = () => {
    setTodos(todos.filter(t => !t.completed));
    setLastAction({ text: 'Cleared completed', type: 'danger' });
  };

  // Helper for status color
  const getStatusColor = () => {
    switch (lastAction.type) {
      case 'success': return 'text-green-500';
      case 'danger': return 'text-red-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="p-8 bg-indigo-600 text-white">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold">Todo Manager</h1>
              <p className="opacity-75 text-sm mt-1">{greeting} • {currentTime.toLocaleTimeString()}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-xs uppercase tracking-wide opacity-75">Tasks Left</div>
            </div>
          </div>
          
          <div className="w-full bg-indigo-800 rounded-full h-2 mb-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-500" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs opacity-75">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-b border-gray-100">
          <form onSubmit={handleAddTodo} className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="What needs to be done?"
                className={`flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${!isInputValid ? 'border-red-500' : 'border-gray-300'}`}
              />
              <button 
                type="submit"
                disabled={!inputValue || !isInputValid}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
            {inputError && (
              <p className="absolute -bottom-5 left-1 text-xs text-red-500">{inputError}</p>
            )}
          </form>
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-indigo-500 w-full"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex gap-2 text-sm">
            {['all', 'active', 'completed'].map((type) => (
              <button 
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full capitalize transition-colors ${
                  filterType === type 
                    ? 'bg-indigo-100 text-indigo-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {filteredTodos.length === 0 ? (
            <li className="p-8 text-center text-gray-400">No tasks found</li>
          ) : (
            filteredTodos.map((todo) => (
              <li key={todo.id} className="p-4 hover:bg-gray-50 transition-colors group">
                {editingId === todo.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 p-2 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="text-green-600 p-1 hover:bg-green-50 rounded">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-red-600 p-1 hover:bg-red-50 rounded">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleTodo(todo.id)}
                      className={`flex-shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${
                        todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-500'
                      }`}
                    >
                      {todo.completed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    
                    <span 
                      className={`flex-1 text-sm transition-all duration-300 ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                      onDoubleClick={() => startEdit(todo)}
                    >
                      {todo.text}
                    </span>
                    
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(todo)} className="text-gray-400 hover:text-indigo-600 p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => deleteTodo(todo.id)} className="text-gray-400 hover:text-red-600 p-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span className={`font-medium transition-colors duration-300 ${getStatusColor()}`}>
            Status: {lastAction.text}
          </span>
          {completedCount > 0 && (
            <button onClick={clearCompleted} className="hover:underline hover:text-red-600">
              Clear Completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


