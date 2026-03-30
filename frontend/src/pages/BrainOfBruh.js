import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calculator, FileText, Clock, CheckSquare, Calendar as CalendarIcon, Plus, X, Check, Trash2, Play, Pause, RotateCcw, Gamepad2, Brain, Shuffle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isEditingTimer, setIsEditingTimer] = useState(false);
  const [timerInputValue, setTimerInputValue] = useState(25);
  
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

  // Games
  const [activeGame, setActiveGame] = useState(null);
  const [triviaQuestions, setTriviaQuestions] = useState([]);
  const [triviaIndex, setTriviaIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaAnswered, setTriviaAnswered] = useState(false);
  const [triviaLoading, setTriviaLoading] = useState(false);
  const [mathProblem, setMathProblem] = useState(null);
  const [mathAnswer, setMathAnswer] = useState("");
  const [mathScore, setMathScore] = useState(0);
  const [mathStreak, setMathStreak] = useState(0);
  const [mathFeedback, setMathFeedback] = useState("");
  const [scrambleWord, setScrambleWord] = useState("");
  const [scrambleOriginal, setScrambleOriginal] = useState("");
  const [scrambleGuess, setScrambleGuess] = useState("");
  const [scrambleScore, setScrambleScore] = useState(0);
  const [scrambleFeedback, setScrambleFeedback] = useState("");
  const [memoryCards, setMemoryCards] = useState([]);
  const [memoryFlipped, setMemoryFlipped] = useState([]);
  const [memoryMatched, setMemoryMatched] = useState([]);
  const [memoryMoves, setMemoryMoves] = useState(0);

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
          playAlarm();
          alert("⏰ Timer finished!");
        }
      }, 1000);
      setTimerInterval(interval);
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
    }
  }, [isTimerRunning, timerMinutes, timerSeconds]);

  const playAlarm = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.3);
    }, 400);
    
    setTimeout(() => {
      const osc3 = audioContext.createOscillator();
      const gain3 = audioContext.createGain();
      osc3.connect(gain3);
      gain3.connect(audioContext.destination);
      osc3.frequency.value = 1200;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0.3, audioContext.currentTime);
      osc3.start(audioContext.currentTime);
      osc3.stop(audioContext.currentTime + 0.5);
    }, 800);
  };

  const setCustomTimer = () => {
    const minutes = parseInt(timerInputValue) || 25;
    setTimerMinutes(minutes);
    setTimerSeconds(0);
    setIsEditingTimer(false);
  };

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

  // Game functions
  const generateMathProblem = useCallback(() => {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b;
    if (op === '*') {
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
    } else {
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 30) + 5;
    }
    let answer;
    if (op === '+') answer = a + b;
    else if (op === '-') answer = a - b;
    else answer = a * b;
    setMathProblem({ a, b, op, answer });
    setMathAnswer("");
    setMathFeedback("");
  }, []);

  const checkMathAnswer = () => {
    if (parseInt(mathAnswer) === mathProblem.answer) {
      setMathScore(s => s + 1);
      setMathStreak(s => s + 1);
      setMathFeedback("correct");
      setTimeout(() => generateMathProblem(), 800);
    } else {
      setMathStreak(0);
      setMathFeedback("wrong");
    }
  };

  const wordList = ["JAVASCRIPT", "PYTHON", "ALGORITHM", "DATABASE", "FUNCTION", "VARIABLE", "COMPUTER", "KEYBOARD", "INTERNET", "PROGRAM", "BRUHBOT", "SCIENCE", "GALAXY", "DINOSAUR", "VOLCANO", "ELEPHANT", "RAINBOW", "MYSTERY", "GRAVITY", "CRYSTAL"];

  const generateScramble = useCallback(() => {
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    const scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
    setScrambleOriginal(word);
    setScrambleWord(scrambled);
    setScrambleGuess("");
    setScrambleFeedback("");
  }, []);

  const checkScramble = () => {
    if (scrambleGuess.toUpperCase() === scrambleOriginal) {
      setScrambleScore(s => s + 1);
      setScrambleFeedback("correct");
      setTimeout(() => generateScramble(), 800);
    } else {
      setScrambleFeedback("wrong");
    }
  };

  const emojiSets = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const emojisMap = { a: '🔴', b: '🔵', c: '🟢', d: '🟡', e: '🟣', f: '🟠', g: '⬛', h: '⬜' };
  
  const initMemoryGame = useCallback(() => {
    const pairs = emojiSets.slice(0, 6);
    const deck = [...pairs, ...pairs].sort(() => Math.random() - 0.5);
    setMemoryCards(deck);
    setMemoryFlipped([]);
    setMemoryMatched([]);
    setMemoryMoves(0);
  }, []);

  const flipMemoryCard = (index) => {
    if (memoryFlipped.length >= 2 || memoryFlipped.includes(index) || memoryMatched.includes(index)) return;
    
    const newFlipped = [...memoryFlipped, index];
    setMemoryFlipped(newFlipped);
    
    if (newFlipped.length === 2) {
      setMemoryMoves(m => m + 1);
      const [first, second] = newFlipped;
      if (memoryCards[first] === memoryCards[second]) {
        setMemoryMatched(prev => [...prev, first, second]);
        setMemoryFlipped([]);
      } else {
        setTimeout(() => setMemoryFlipped([]), 800);
      }
    }
  };

  const loadTrivia = async (category = "general knowledge") => {
    setTriviaLoading(true);
    setTriviaIndex(0);
    setTriviaScore(0);
    setTriviaAnswered(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/games/trivia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, difficulty: "medium" })
      });
      if (res.ok) {
        const data = await res.json();
        setTriviaQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Failed to load trivia:', error);
    } finally {
      setTriviaLoading(false);
    }
  };

  const modules = [
    { id: 'calculator', name: 'Calculator', icon: Calculator, color: '#FDFFB6' },
    { id: 'notes', name: 'Notes', icon: FileText, color: '#A0C4FF' },
    { id: 'timer', name: 'Study Timer', icon: Clock, color: '#CAFFBF' },
    { id: 'tasks', name: 'Tasks', icon: CheckSquare, color: '#FFADAD' },
    { id: 'calendar', name: 'Calendar', icon: CalendarIcon, color: '#FFD6A5' },
    { id: 'games', name: 'Game Zone', icon: Gamepad2, color: '#E8DAEF' }
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)' }}>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-3 rounded-full border-2 shadow-[2px_2px_0px_0px] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px] transition-all"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-4xl font-black" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--text-primary)' }}>
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
                
                {isEditingTimer ? (
                  <div className="mb-8">
                    <input
                      type="number"
                      value={timerInputValue}
                      onChange={(e) => setTimerInputValue(e.target.value)}
                      className="text-6xl font-black text-center border-2 border-black rounded-xl p-4 w-64"
                      placeholder="Minutes"
                      data-testid="timer-input"
                    />
                    <p className="text-sm mt-2 opacity-70">Enter minutes (1-999)</p>
                    <div className="flex justify-center gap-4 mt-4">
                      <button
                        onClick={setCustomTimer}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-[#CAFFBF] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold"
                      >
                        Set Timer
                      </button>
                      <button
                        onClick={() => setIsEditingTimer(false)}
                        className="px-6 py-3 rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="text-8xl font-black mb-8 cursor-pointer hover:scale-105 transition-transform" 
                      style={{ fontFamily: 'Outfit, sans-serif', color: '#1A1A1A' }} 
                      data-testid="timer-display"
                      onClick={() => !isTimerRunning && setIsEditingTimer(true)}
                    >
                      {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                    </div>
                    <p className="text-sm mb-6 opacity-70">
                      {!isTimerRunning && "Click time to edit"}
                    </p>
                  </>
                )}
                
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
                      setTimerMinutes(timerInputValue || 25);
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

            {/* Game Zone */}
            {activeModule === 'games' && (
              <div className="border-2 rounded-2xl p-8 shadow-[6px_6px_0px_0px]" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} data-testid="games-module">
                <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Game Zone</h2>
                
                {!activeGame && (
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setActiveGame('trivia'); loadTrivia(); }}
                      className="p-6 rounded-2xl border-2 text-left shadow-[4px_4px_0px_0px] hover:shadow-[6px_6px_0px_0px] transition-all"
                      style={{ borderColor: 'var(--border-color)', backgroundColor: '#FDFFB6' }}
                      data-testid="game-trivia-btn"
                    >
                      <Brain className="w-10 h-10 mb-3" />
                      <p className="font-black text-lg" style={{ fontFamily: 'Outfit' }}>AI Trivia Quiz</p>
                      <p className="text-sm opacity-70 mt-1">AI-generated questions</p>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setActiveGame('math'); generateMathProblem(); }}
                      className="p-6 rounded-2xl border-2 text-left shadow-[4px_4px_0px_0px] hover:shadow-[6px_6px_0px_0px] transition-all"
                      style={{ borderColor: 'var(--border-color)', backgroundColor: '#CAFFBF' }}
                      data-testid="game-math-btn"
                    >
                      <Zap className="w-10 h-10 mb-3" />
                      <p className="font-black text-lg" style={{ fontFamily: 'Outfit' }}>Quick Math</p>
                      <p className="text-sm opacity-70 mt-1">Test your speed</p>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setActiveGame('scramble'); generateScramble(); }}
                      className="p-6 rounded-2xl border-2 text-left shadow-[4px_4px_0px_0px] hover:shadow-[6px_6px_0px_0px] transition-all"
                      style={{ borderColor: 'var(--border-color)', backgroundColor: '#A0C4FF' }}
                      data-testid="game-scramble-btn"
                    >
                      <Shuffle className="w-10 h-10 mb-3" />
                      <p className="font-black text-lg" style={{ fontFamily: 'Outfit' }}>Word Scramble</p>
                      <p className="text-sm opacity-70 mt-1">Unscramble the word</p>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setActiveGame('memory'); initMemoryGame(); }}
                      className="p-6 rounded-2xl border-2 text-left shadow-[4px_4px_0px_0px] hover:shadow-[6px_6px_0px_0px] transition-all"
                      style={{ borderColor: 'var(--border-color)', backgroundColor: '#FFB6E1' }}
                      data-testid="game-memory-btn"
                    >
                      <Gamepad2 className="w-10 h-10 mb-3" />
                      <p className="font-black text-lg" style={{ fontFamily: 'Outfit' }}>Memory Cards</p>
                      <p className="text-sm opacity-70 mt-1">Match the pairs</p>
                    </motion.button>
                  </div>
                )}

                {/* Trivia Game */}
                {activeGame === 'trivia' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setActiveGame(null)} className="px-4 py-2 rounded-xl border-2 font-bold text-sm hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)' }} data-testid="back-to-games-btn">
                        <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                      </button>
                      <span className="font-bold text-lg px-4 py-2 rounded-full border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#FDFFB6' }}>Score: {triviaScore}/{triviaQuestions.length}</span>
                    </div>
                    
                    {triviaLoading ? (
                      <div className="text-center py-16">
                        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--border-color)', borderTopColor: 'transparent' }} />
                        <p className="font-bold">AI is generating questions...</p>
                      </div>
                    ) : triviaQuestions.length > 0 && triviaIndex < triviaQuestions.length ? (
                      <motion.div key={triviaIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <p className="text-sm opacity-50">Question {triviaIndex + 1} of {triviaQuestions.length}</p>
                        <p className="text-xl font-bold" style={{ fontFamily: 'Outfit' }}>{triviaQuestions[triviaIndex].question}</p>
                        <div className="grid grid-cols-1 gap-3">
                          {(triviaQuestions[triviaIndex].options || []).map((opt, oidx) => (
                            <motion.button
                              key={oidx}
                              whileHover={!triviaAnswered ? { scale: 1.02 } : {}}
                              whileTap={!triviaAnswered ? { scale: 0.98 } : {}}
                              onClick={() => {
                                if (triviaAnswered) return;
                                setTriviaAnswered(true);
                                if (oidx === triviaQuestions[triviaIndex].correct) {
                                  setTriviaScore(s => s + 1);
                                }
                              }}
                              disabled={triviaAnswered}
                              className={`p-4 rounded-xl border-2 text-left font-medium transition-all ${
                                triviaAnswered
                                  ? oidx === triviaQuestions[triviaIndex].correct
                                    ? 'bg-green-200 border-green-600'
                                    : 'opacity-50'
                                  : 'hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px]'
                              }`}
                              style={{ borderColor: 'var(--border-color)', backgroundColor: triviaAnswered && oidx === triviaQuestions[triviaIndex].correct ? '#CAFFBF' : 'var(--bg-primary)' }}
                              data-testid={`trivia-option-${oidx}`}
                            >
                              <span className="font-bold mr-2">{String.fromCharCode(65 + oidx)}.</span> {opt}
                            </motion.button>
                          ))}
                        </div>
                        {triviaAnswered && (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                            <p className="text-sm p-3 rounded-xl border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#FDFFB6' }}>
                              {triviaQuestions[triviaIndex].explanation}
                            </p>
                            <button
                              onClick={() => { setTriviaIndex(i => i + 1); setTriviaAnswered(false); }}
                              className="mt-3 px-6 py-3 rounded-xl border-2 font-bold shadow-[3px_3px_0px_0px] hover:-translate-y-0.5 transition-all"
                              style={{ borderColor: 'var(--border-color)', backgroundColor: '#A0C4FF' }}
                              data-testid="next-trivia-btn"
                            >
                              {triviaIndex < triviaQuestions.length - 1 ? 'Next Question' : 'See Results'}
                            </button>
                          </motion.div>
                        )}
                      </motion.div>
                    ) : triviaQuestions.length > 0 ? (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                        <p className="text-6xl font-black mb-4" style={{ fontFamily: 'Outfit' }}>{triviaScore}/{triviaQuestions.length}</p>
                        <p className="text-xl font-bold mb-6">{triviaScore === triviaQuestions.length ? 'Perfect Score!' : triviaScore > 2 ? 'Great Job!' : 'Keep Practicing!'}</p>
                        <button onClick={() => loadTrivia()} className="px-6 py-3 rounded-xl border-2 font-bold shadow-[3px_3px_0px_0px] hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)', backgroundColor: '#CAFFBF' }} data-testid="play-again-trivia-btn">
                          Play Again
                        </button>
                      </motion.div>
                    ) : (
                      <p className="text-center py-12 opacity-50">No questions loaded. Try again!</p>
                    )}
                  </div>
                )}

                {/* Quick Math Game */}
                {activeGame === 'math' && mathProblem && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setActiveGame(null)} className="px-4 py-2 rounded-xl border-2 font-bold text-sm hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)' }} data-testid="back-to-games-math">
                        <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                      </button>
                      <div className="flex gap-3">
                        <span className="font-bold px-3 py-1 rounded-full border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#CAFFBF' }}>Score: {mathScore}</span>
                        <span className="font-bold px-3 py-1 rounded-full border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#FDFFB6' }}>Streak: {mathStreak}</span>
                      </div>
                    </div>
                    <motion.div key={`${mathProblem.a}${mathProblem.op}${mathProblem.b}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                      <p className="text-6xl font-black mb-8" style={{ fontFamily: 'Outfit' }}>{mathProblem.a} {mathProblem.op === '*' ? '×' : mathProblem.op} {mathProblem.b} = ?</p>
                      <div className="flex items-center justify-center gap-4 max-w-xs mx-auto">
                        <input
                          type="number"
                          value={mathAnswer}
                          onChange={(e) => setMathAnswer(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && checkMathAnswer()}
                          className="w-32 text-center text-2xl font-bold p-3 rounded-xl border-2"
                          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                          placeholder="?"
                          autoFocus
                          data-testid="math-answer-input"
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={checkMathAnswer}
                          className="px-6 py-3 rounded-xl border-2 font-bold shadow-[3px_3px_0px_0px] hover:-translate-y-0.5 transition-all"
                          style={{ borderColor: 'var(--border-color)', backgroundColor: '#CAFFBF' }}
                          data-testid="math-check-btn"
                        >
                          Check
                        </motion.button>
                      </div>
                      <AnimatePresence>
                        {mathFeedback && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`mt-4 text-2xl font-black ${mathFeedback === 'correct' ? 'text-green-600' : 'text-red-500'}`}
                          >
                            {mathFeedback === 'correct' ? 'Correct!' : `Wrong! Answer: ${mathProblem.answer}`}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )}

                {/* Word Scramble Game */}
                {activeGame === 'scramble' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setActiveGame(null)} className="px-4 py-2 rounded-xl border-2 font-bold text-sm hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)' }} data-testid="back-to-games-scramble">
                        <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                      </button>
                      <span className="font-bold px-3 py-1 rounded-full border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#A0C4FF' }}>Score: {scrambleScore}</span>
                    </div>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                      <p className="text-sm opacity-50 mb-2">Unscramble this word:</p>
                      <div className="flex justify-center gap-2 mb-8">
                        {scrambleWord.split('').map((letter, li) => (
                          <motion.span
                            key={li}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: li * 0.05 }}
                            className="w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-black"
                            style={{ borderColor: 'var(--border-color)', backgroundColor: '#A0C4FF' }}
                          >
                            {letter}
                          </motion.span>
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-4 max-w-sm mx-auto">
                        <input
                          type="text"
                          value={scrambleGuess}
                          onChange={(e) => setScrambleGuess(e.target.value.toUpperCase())}
                          onKeyPress={(e) => e.key === 'Enter' && checkScramble()}
                          className="flex-1 text-center text-xl font-bold p-3 rounded-xl border-2 uppercase tracking-wider"
                          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                          placeholder="Your answer..."
                          data-testid="scramble-input"
                        />
                        <button onClick={checkScramble} className="px-6 py-3 rounded-xl border-2 font-bold shadow-[3px_3px_0px_0px] hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)', backgroundColor: '#CAFFBF' }} data-testid="scramble-check-btn">
                          Check
                        </button>
                      </div>
                      <button onClick={generateScramble} className="mt-4 text-sm underline opacity-50 hover:opacity-100" data-testid="scramble-skip-btn">Skip word</button>
                      <AnimatePresence>
                        {scrambleFeedback && (
                          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-4 text-2xl font-black ${scrambleFeedback === 'correct' ? 'text-green-600' : 'text-red-500'}`}>
                            {scrambleFeedback === 'correct' ? 'Correct!' : `Nope! The word was: ${scrambleOriginal}`}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                )}

                {/* Memory Card Game */}
                {activeGame === 'memory' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setActiveGame(null)} className="px-4 py-2 rounded-xl border-2 font-bold text-sm hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)' }} data-testid="back-to-games-memory">
                        <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                      </button>
                      <div className="flex gap-3">
                        <span className="font-bold px-3 py-1 rounded-full border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#FFB6E1' }}>Moves: {memoryMoves}</span>
                        <span className="font-bold px-3 py-1 rounded-full border-2" style={{ borderColor: 'var(--border-color)', backgroundColor: '#CAFFBF' }}>Matched: {memoryMatched.length / 2}/6</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
                      {memoryCards.map((card, ci) => (
                        <motion.button
                          key={ci}
                          whileHover={!memoryFlipped.includes(ci) && !memoryMatched.includes(ci) ? { scale: 1.05 } : {}}
                          whileTap={!memoryFlipped.includes(ci) && !memoryMatched.includes(ci) ? { scale: 0.95 } : {}}
                          onClick={() => flipMemoryCard(ci)}
                          className="w-full aspect-square rounded-xl border-2 text-2xl font-bold flex items-center justify-center transition-all"
                          style={{
                            borderColor: 'var(--border-color)',
                            backgroundColor: memoryMatched.includes(ci) ? '#CAFFBF' : memoryFlipped.includes(ci) ? '#FDFFB6' : 'var(--bg-primary)',
                            boxShadow: memoryFlipped.includes(ci) || memoryMatched.includes(ci) ? 'none' : '3px 3px 0px 0px var(--border-color)'
                          }}
                          data-testid={`memory-card-${ci}`}
                        >
                          {memoryFlipped.includes(ci) || memoryMatched.includes(ci) ? emojisMap[card] : '?'}
                        </motion.button>
                      ))}
                    </div>
                    {memoryMatched.length === memoryCards.length && memoryCards.length > 0 && (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mt-8">
                        <p className="text-3xl font-black mb-2" style={{ fontFamily: 'Outfit' }}>You Won!</p>
                        <p className="text-lg mb-4">Completed in {memoryMoves} moves</p>
                        <button onClick={initMemoryGame} className="px-6 py-3 rounded-xl border-2 font-bold shadow-[3px_3px_0px_0px] hover:-translate-y-0.5 transition-all" style={{ borderColor: 'var(--border-color)', backgroundColor: '#FFB6E1' }} data-testid="play-again-memory-btn">
                          Play Again
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
