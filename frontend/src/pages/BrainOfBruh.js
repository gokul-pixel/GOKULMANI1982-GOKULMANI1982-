import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calculator, FileText, Clock, CheckSquare, Calendar as CalendarIcon, Plus, X, Check, Trash2, Play, Pause, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function BrainOfBruh() {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  
  // Calculator
  const [calcDisplay, setCalcDisplay] = useState("0");
  const [calcPrevValue, setCalcPrevValue] = useState(null);
  const [calcOperation, setCalcOperation] = useState(null);
  
  // Notes
  const [notes, setNotes] = useState([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  
  // Timer
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInterval, setTimerInterval] = useState(null);
  
  // Tasks
  const [tasks, setTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAlarm, setTaskAlarm] = useState("");
  
  // Calendar
  const [events, setEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Not authenticated');
        const userData = await response.json();
        setIsAuthenticated(true);
        setUser(userData);
      } catch (error) {
        setIsAuthenticated(false);
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadNotes();
      loadTasks();
      loadEvents();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isTimerRunning) {
      const interval = setInterval(() => {
        if (timerSeconds > 0) {
          setTimerSeconds(timerSeconds - 1);
        } else if (timerMinutes > 0) {
          setTimerMinutes(timerMinutes - 1);
          setTimerSeconds(59);
        } else {
          setIsTimerRunning(false);
          alert("Timer finished!");
        }
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
    }
  }, [isTimerRunning, timerMinutes, timerSeconds]);

  const loadNotes = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notes`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/events`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const handleCalcButton = (value) => {
    if (value === 'C') {
      setCalcDisplay("0");
      setCalcPrevValue(null);
      setCalcOperation(null);
    } else if (value === '=') {
      if (calcPrevValue !== null && calcOperation) {
        const current = parseFloat(calcDisplay);
        const prev = parseFloat(calcPrevValue);
        let result = 0;
        switch (calcOperation) {
          case '+': result = prev + current; break;
          case '-': result = prev - current; break;
          case '×': result = prev * current; break;
          case '÷': result = prev / current; break;
          default: result = current;
        }
        setCalcDisplay(result.toString());
        setCalcPrevValue(null);
        setCalcOperation(null);
      }
    } else if (['+', '-', '×', '÷'].includes(value)) {
      setCalcPrevValue(calcDisplay);
      setCalcOperation(value);
      setCalcDisplay("0");
    } else {
      setCalcDisplay(calcDisplay === "0" ? value : calcDisplay + value);
    }
  };

  const saveNote = async () => {
    try {
      const method = editingNote ? 'PATCH' : 'POST';
      const url = editingNote 
        ? `${BACKEND_URL}/api/notes/${editingNote.note_id}`
        : `${BACKEND_URL}/api/notes`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: noteTitle, content: noteContent })
      });

      if (response.ok) {
        loadNotes();
        setShowNoteForm(false);
        setNoteTitle("");
        setNoteContent("");
        setEditingNote(null);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await fetch(`${BACKEND_URL}/api/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const saveTask = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: taskTitle, alarm_time: taskAlarm })
      });

      if (response.ok) {
        loadTasks();
        setShowTaskForm(false);
        setTaskTitle("");
        setTaskAlarm("");
      }
    } catch (error) {
      console.error('Failed to save task:', error);
    }
  };

  const toggleTask = async (task) => {
    try {
      await fetch(`${BACKEND_URL}/api/tasks/${task.task_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed: !task.completed })
      });
      loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const saveEvent = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: eventTitle,
          date: eventDate,
          time: eventTime,
          description: eventDescription
        })
      });

      if (response.ok) {
        loadEvents();
        setShowEventForm(false);
        setEventTitle("");
        setEventDate("");
        setEventTime("");
        setEventDescription("");
      }
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await fetch(`${BACKEND_URL}/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      loadEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const modules = [
    { id: 'calculator', name: 'Calculator', icon: Calculator, color: '#FDFFB6' },
    { id: 'notes', name: 'Notes', icon: FileText, color: '#A0C4FF' },
    { id: 'timer', name: 'Study Timer', icon: Clock, color: '#CAFFBF' },
    { id: 'tasks', name: 'Tasks', icon: CheckSquare, color: '#FFADAD' },
    { id: 'calendar', name: 'Calendar', icon: CalendarIcon, color: '#FFD6A5' }
  ];

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFFDF9' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFDF9', fontFamily: 'DM Sans, sans-serif' }}>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-3 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-4xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: '#1A1A1A' }}>
              Brain of BRUH
            </h1>
            <p className="opacity-70">Your productivity toolkit</p>
          </div>
        </div>

        {!activeModule ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <motion.button
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className="p-8 bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all text-left"
                  whileHover={{ scale: 1.02 }}
                  data-testid={`module-${module.id}-btn`}
                >
                  <div 
                    className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center mb-4"
                    style={{ backgroundColor: module.color }}
                  >
                    <Icon className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {module.name}
                  </h3>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setActiveModule(null)}
              className="mb-6 px-6 py-3 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all font-bold"
              style={{ fontFamily: 'Outfit, sans-serif' }}
              data-testid="back-to-modules-btn"
            >
              ← Back to Modules
            </button>

            {/* Calculator */}
            {activeModule === 'calculator' && (
              <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" data-testid="calculator-module">
                <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Calculator</h2>
                <div className="bg-black text-white p-6 rounded-xl text-right text-4xl font-bold mb-4 min-h-[80px] flex items-center justify-end" data-testid="calc-display">
                  {calcDisplay}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', 'C', '0', '=', '+'].map((btn) => (
                    <button
                      key={btn}
                      onClick={() => handleCalcButton(btn)}
                      className={`p-6 rounded-xl border-2 border-black font-bold text-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all ${
                        ['+', '-', '×', '÷', '='].includes(btn) ? 'bg-[#FF5A5F] text-white' : btn === 'C' ? 'bg-gray-200' : 'bg-white'
                      }`}
                      data-testid={`calc-btn-${btn}`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {activeModule === 'notes' && (
              <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" data-testid="notes-module">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Notes</h2>
                  <button
                    onClick={() => setShowNoteForm(true)}
                    className="px-6 py-3 rounded-xl border-2 border-black bg-[#A0C4FF] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2"
                    data-testid="add-note-btn"
                  >
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                    New Note
                  </button>
                </div>

                {showNoteForm && (
                  <div className="mb-6 p-6 border-2 border-black rounded-xl bg-gray-50" data-testid="note-form">
                    <input
                      type="text"
                      placeholder="Note title..."
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3 font-bold"
                      data-testid="note-title-input"
                    />
                    <textarea
                      placeholder="Note content..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3 min-h-[150px]"
                      data-testid="note-content-input"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveNote}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-[#CAFFBF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold"
                        data-testid="save-note-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowNoteForm(false);
                          setNoteTitle("");
                          setNoteContent("");
                          setEditingNote(null);
                        }}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold"
                        data-testid="cancel-note-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.note_id} className="p-4 border-2 border-black rounded-xl bg-white" data-testid={`note-${note.note_id}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>{note.title}</h3>
                        <button
                          onClick={() => deleteNote(note.note_id)}
                          className="p-2 rounded-full hover:bg-red-100"
                          data-testid={`delete-note-${note.note_id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" strokeWidth={2.5} />
                        </button>
                      </div>
                      <p className="text-sm opacity-70">{note.content}</p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-center opacity-50 py-12">No notes yet. Create your first note!</p>
                  )}
                </div>
              </div>
            )}

            {/* Timer */}
            {activeModule === 'timer' && (
              <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center" data-testid="timer-module">
                <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Study Timer</h2>
                <div className="text-8xl font-black mb-8" style={{ fontFamily: 'Outfit, sans-serif', color: '#1A1A1A' }} data-testid="timer-display">
                  {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                </div>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className="px-8 py-4 rounded-xl border-2 border-black bg-[#CAFFBF] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2"
                    data-testid="timer-toggle-btn"
                  >
                    {isTimerRunning ? <Pause className="w-5 h-5" strokeWidth={2.5} /> : <Play className="w-5 h-5" strokeWidth={2.5} />}
                    {isTimerRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerMinutes(25);
                      setTimerSeconds(0);
                    }}
                    className="px-8 py-4 rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2"
                    data-testid="timer-reset-btn"
                  >
                    <RotateCcw className="w-5 h-5" strokeWidth={2.5} />
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Tasks */}
            {activeModule === 'tasks' && (
              <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" data-testid="tasks-module">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Tasks</h2>
                  <button
                    onClick={() => setShowTaskForm(true)}
                    className="px-6 py-3 rounded-xl border-2 border-black bg-[#FFADAD] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2"
                    data-testid="add-task-btn"
                  >
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                    New Task
                  </button>
                </div>

                {showTaskForm && (
                  <div className="mb-6 p-6 border-2 border-black rounded-xl bg-gray-50" data-testid="task-form">
                    <input
                      type="text"
                      placeholder="Task title..."
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3 font-medium"
                      data-testid="task-title-input"
                    />
                    <input
                      type="datetime-local"
                      value={taskAlarm}
                      onChange={(e) => setTaskAlarm(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3"
                      data-testid="task-alarm-input"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveTask}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-[#CAFFBF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold"
                        data-testid="save-task-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowTaskForm(false);
                          setTaskTitle("");
                          setTaskAlarm("");
                        }}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold"
                        data-testid="cancel-task-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.task_id} className="p-4 border-2 border-black rounded-xl bg-white flex items-center justify-between" data-testid={`task-${task.task_id}`}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleTask(task)}
                          className={`w-6 h-6 rounded border-2 border-black flex items-center justify-center ${
                            task.completed ? 'bg-[#CAFFBF]' : 'bg-white'
                          }`}
                          data-testid={`toggle-task-${task.task_id}`}
                        >
                          {task.completed && <Check className="w-4 h-4" strokeWidth={3} />}
                        </button>
                        <span className={`font-medium ${task.completed ? 'line-through opacity-50' : ''}`}>
                          {task.title}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteTask(task.task_id)}
                        className="p-2 rounded-full hover:bg-red-100"
                        data-testid={`delete-task-${task.task_id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  {tasks.length === 0 && (
                    <p className="text-center opacity-50 py-12">No tasks yet. Add your first task!</p>
                  )}
                </div>
              </div>
            )}

            {/* Calendar */}
            {activeModule === 'calendar' && (
              <div className="bg-white border-2 border-black rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" data-testid="calendar-module">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Calendar</h2>
                  <button
                    onClick={() => setShowEventForm(true)}
                    className="px-6 py-3 rounded-xl border-2 border-black bg-[#FFD6A5] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold flex items-center gap-2"
                    data-testid="add-event-btn"
                  >
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                    New Event
                  </button>
                </div>

                {showEventForm && (
                  <div className="mb-6 p-6 border-2 border-black rounded-xl bg-gray-50" data-testid="event-form">
                    <input
                      type="text"
                      placeholder="Event title..."
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3 font-medium"
                      data-testid="event-title-input"
                    />
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3"
                      data-testid="event-date-input"
                    />
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3"
                      data-testid="event-time-input"
                    />
                    <textarea
                      placeholder="Event description..."
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl mb-3"
                      data-testid="event-description-input"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEvent}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-[#CAFFBF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold"
                        data-testid="save-event-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowEventForm(false);
                          setEventTitle("");
                          setEventDate("");
                          setEventTime("");
                          setEventDescription("");
                        }}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold"
                        data-testid="cancel-event-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.event_id} className="p-4 border-2 border-black rounded-xl bg-white" data-testid={`event-${event.event_id}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>{event.title}</h3>
                          <p className="text-sm opacity-70">{event.date} {event.time && `at ${event.time}`}</p>
                        </div>
                        <button
                          onClick={() => deleteEvent(event.event_id)}
                          className="p-2 rounded-full hover:bg-red-100"
                          data-testid={`delete-event-${event.event_id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" strokeWidth={2.5} />
                        </button>
                      </div>
                      {event.description && <p className="text-sm">{event.description}</p>}
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-center opacity-50 py-12">No events yet. Add your first event!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
