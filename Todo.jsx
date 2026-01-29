import React, { useState, useEffect } from 'react';

export default function App() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filteredTodos, setFilteredTodos] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [totalCount, setTotalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isInputValid, setIsInputValid] = useState(true);
  const [inputError, setInputError] = useState('');
  const [inputBorder, setInputBorder] = useState('border-gray-300');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');
  const [lastAction, setLastAction] = useState('App loaded');
  const [statusColor, setStatusColor] = useState('text-gray-500');
  const [showClearCompleted, setShowClearCompleted] = useState(false);
  const [progressWidth, setProgressWidth] = useState('0%');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = currentTime.getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, [currentTime]);

  useEffect(() => {
    setTotalCount(todos.length);
  }, [todos]);

  useEffect(() => {
    const completed = todos.filter(t => t.completed).length;
    setCompletedCount(completed);
  }, [todos]);

  useEffect(() => {
    const pending = todos.filter(t => !t.completed).length;
    setPendingCount(pending);
  }, [todos]);

  useEffect(() => {
    if (completedCount > 0) {
      setShowClearCompleted(true);
    } else {
      setShowClearCompleted(false);
    }
  }, [completedCount]);

  useEffect(() => {
    if (totalCount === 0) {
      setProgressWidth('0%');
    } else {
      const percentage = Math.round((completedCount / totalCount) * 100);
      setProgressWidth(`${percentage}%`);
    }
  }, [totalCount, completedCount]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    let result = [...todos];

    if (isSearching) {
      result = result.filter(t => 
        t.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterType === 'active') {
      result = result.filter(t => !t.completed);
    } else if (filterType === 'completed') {
      result = result.filter(t => t.completed);
    }

    setFilteredTodos(result);
  }, [todos, filterType, searchQuery, isSearching]);

  useEffect(() => {
    if (inputValue.length > 0 && inputValue.length < 3) {
      setIsInputValid(false);
      setInputError('Must be at least 3 chars');
    } else {
      setIsInputValid(true);
      setInputError('');
    }
  }, [inputValue]);

  useEffect(() => {
    if (!isInputValid) {
      setInputBorder('border-red-500');
    } else {
      setInputBorder('border-gray-300');
    }
  }, [isInputValid]);

  useEffect(() => {
    if (editId !== null) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [editId]);

  useEffect(() => {
    if (lastAction.includes('Deleted')) {
      setStatusColor('text-red-500');
    } else if (lastAction.includes('Added')) {
      setStatusColor('text-green-500');
    } else if (lastAction.includes('Updated')) {
      setStatusColor('text-blue-500');
    } else {
      setStatusColor('text-gray-500');
    }
    
    const timeout = setTimeout(() => {
      setStatusColor('text-gray-500');
    }, 2000);
    return () => clearTimeout(timeout);
  }, [lastAction]);

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (isInputValid && inputValue.trim() !== '') {
      const newTodo = {
        id: Date.now(),
        text: inputValue,
        completed: false,
        createdAt: new Date().toISOString()
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
      setLastAction(`Added "${newTodo.text}"`);
    }
  };

  const toggleTodo = (id) => {
    const updatedTodos = todos.map(todo => {
      if (todo.id === id) {
        return { ...todo, completed: !todo.completed };
      }
      return todo;
    });
    setTodos(updatedTodos);
    setLastAction('Updated status');
  };

  const deleteTodo = (id) => {
    const todoToRemove = todos.find(t => t.id === id);
    const updatedTodos = todos.filter(todo => todo.id !== id);
    setTodos(updatedTodos);
    setLastAction(`Deleted "${todoToRemove?.text}"`);
  };

  const startEdit = (todo) => {
    setEditId(todo.id);
    setEditValue(todo.text);
  };

  const saveEdit = () => {
    const updatedTodos = todos.map(todo => {
      if (todo.id === editId) {
        return { ...todo, text: editValue };
      }
      return todo;
    });
    setTodos(updatedTodos);
    setEditId(null);
    setEditValue('');
    setLastAction('Updated content');
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditValue('');
  };

  const clearCompleted = () => {
    const activeTodos = todos.filter(t => !t.completed);
    setTodos(activeTodos);
    setLastAction('Cleared completed');
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
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
              style={{ width: progressWidth }}
            ></div>
          </div>
          <div className="flex justify-between text-xs opacity-75">
            <span>Progress</span>
            <span>{Math.round((completedCount / (totalCount || 1)) * 100)}%</span>
          </div>
        </div>

        <div className="p-6 border-b border-gray-100">
          <form onSubmit={handleAddTodo} className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="What needs to be done?"
                className={`flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${inputBorder}`}
              />
              <button 
                type="submit"
                disabled={!isInputValid || inputValue.length === 0}
                className={`px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium transition-colors ${(!isInputValid || inputValue.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
              >
                Add
              </button>
            </div>
            {inputError && (
              <p className="absolute -bottom-5 left-1 text-xs text-red-500">{inputError}</p>
            )}
          </form>
        </div>

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
            <button 
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-full transition-colors ${filterType === 'all' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilterType('active')}
              className={`px-3 py-1.5 rounded-full transition-colors ${filterType === 'active' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setFilterType('completed')}
              className={`px-3 py-1.5 rounded-full transition-colors ${filterType === 'completed' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-200'}`}
            >
              Completed
            </button>
          </div>
        </div>

        <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {filteredTodos.length === 0 ? (
            <li className="p-8 text-center text-gray-400">
              No tasks found
            </li>
          ) : (
            filteredTodos.map((todo) => (
              <li key={todo.id} className="p-4 hover:bg-gray-50 transition-colors group">
                {editId === todo.id ? (
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
                    <button onClick={cancelEdit} className="text-red-600 p-1 hover:bg-red-50 rounded">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleTodo(todo.id)}
                      className={`flex-shrink-0 w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-500'}`}
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
                      <button 
                        onClick={() => startEdit(todo)}
                        className="text-gray-400 hover:text-indigo-600 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button 
                        onClick={() => deleteTodo(todo.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span className={`font-medium transition-colors duration-300 ${statusColor}`}>
            Status: {lastAction}
          </span>
          {showClearCompleted && (
            <button 
              onClick={clearCompleted}
              className="hover:underline hover:text-red-600"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

