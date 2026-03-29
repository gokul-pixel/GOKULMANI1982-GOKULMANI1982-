import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Sparkles, Sprout, ChefHat, Settings, LogOut, Send, Mic, Camera, Upload, Brain, Image as ImageIcon, MoreVertical, Maximize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);
  const [currentBot, setCurrentBot] = useState("normal");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-5.1");
  const [selectedMode, setSelectedMode] = useState("normal");
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (location.state?.user) return;
    
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
  }, [location.state, navigate]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadChatHistory();
      loadConversations();
    }
  }, [currentBot, isAuthenticated, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/history?bot_type=${currentBot}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chat/conversations`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = {
      role: "user",
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: inputMessage,
          bot_type: currentBot,
          ai_model: selectedModel,
          mode: selectedMode
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setInputMessage(prev => prev + ` [Uploaded: ${file.name}]`);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleVoiceRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Placeholder for voice recording
      setTimeout(() => {
        setIsRecording(false);
      }, 3000);
    } else {
      setIsRecording(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const botConfigs = {
    normal: {
      name: "BRUH",
      icon: MessageCircle,
      color: "#E0E0E0",
      description: "Your friendly AI companion"
    },
    student: {
      name: "Student Partner",
      icon: Sparkles,
      color: "#A0C4FF",
      description: "Your study buddy and tutor",
      avatar: "https://static.prod-images.emergentagent.com/jobs/e65b5c7d-6f8a-446a-b7fd-669077ab5cbc/images/296c5885d2a45d3a0a1a897f1d43de3c1674ff0b0a601decaf9f3ca1156b06e5.png"
    },
    crop: {
      name: "Crop Assistant",
      icon: Sprout,
      color: "#CAFFBF",
      description: "Your farming companion",
      avatar: "https://static.prod-images.emergentagent.com/jobs/e65b5c7d-6f8a-446a-b7fd-669077ab5cbc/images/7364b45832c3e6ac865999cd84c190160bf95701b86ca8d8e4da1d871bd2691a.png"
    },
    cook: {
      name: "Cook Bot",
      icon: ChefHat,
      color: "#FFADAD",
      description: "Your culinary expert",
      avatar: "https://static.prod-images.emergentagent.com/jobs/e65b5c7d-6f8a-446a-b7fd-669077ab5cbc/images/30068d8fa3d7067a7042458785c1456f8421a08bb7971bc1dad138e3796754c7.png"
    }
  };

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

  const currentBotConfig = botConfigs[currentBot];
  const BotIcon = currentBotConfig.icon;

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#FFFDF9', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Sidebar */}
      <div className="w-80 border-r-2 border-black flex flex-col" style={{ backgroundColor: '#FFFDF9' }}>
        {/* Header */}
        <div className="p-8 border-b-2 border-black">
          <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'Outfit, sans-serif', color: '#1A1A1A' }}>
            BRUH
          </h1>
          <div className="flex items-center gap-3">
            {user?.picture && (
              <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border-2 border-black" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>{user?.name}</p>
              <p className="text-xs truncate opacity-70">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Bot Selection */}
        <div className="p-6 border-b-2 border-black">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Select Bot</p>
          <div className="space-y-3">
            {Object.entries(botConfigs).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setCurrentBot(key)}
                  className={`w-full p-3 rounded-xl border-2 border-black font-bold text-left flex items-center gap-3 transition-all ${
                    currentBot === key
                      ? 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5'
                      : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5'
                  }`}
                  style={{ 
                    backgroundColor: currentBot === key ? config.color : '#FFFFFF',
                    fontFamily: 'Outfit, sans-serif'
                  }}
                  data-testid={`bot-${key}-btn`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                  <span className="text-sm">{config.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Chat History</p>
          {conversations.length > 0 ? (
            <div className="space-y-3">
              {conversations.map((conv, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white border-2 border-black rounded-xl text-xs font-medium cursor-pointer hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                  onClick={() => setCurrentBot(conv._id)}
                  data-testid={`history-item-${idx}`}
                >
                  <p className="font-bold mb-1">{botConfigs[conv._id]?.name}</p>
                  <p className="opacity-70 truncate">{conv.count} messages</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-70">No chat history yet</p>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-6 border-t-2 border-black space-y-3">
          <button
            onClick={() => navigate('/brain')}
            className="w-full p-3 rounded-xl border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all bg-white"
            style={{ fontFamily: 'Outfit, sans-serif' }}
            data-testid="brain-tools-btn"
          >
            <Brain className="w-5 h-5 inline-block mr-2" strokeWidth={2.5} />
            Brain Tools
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full p-3 rounded-xl border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all bg-white"
            style={{ fontFamily: 'Outfit, sans-serif' }}
            data-testid="settings-btn"
          >
            <Settings className="w-5 h-5 inline-block mr-2" strokeWidth={2.5} />
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-3 rounded-xl border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
            style={{ backgroundColor: '#FF5A5F', color: 'white', fontFamily: 'Outfit, sans-serif' }}
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 inline-block mr-2" strokeWidth={2.5} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-8 border-b-2 border-black" style={{ backgroundColor: currentBotConfig.color }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {currentBotConfig.avatar ? (
                <img src={currentBotConfig.avatar} alt={currentBotConfig.name} className="w-16 h-16 rounded-full border-2 border-black" />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-black bg-white flex items-center justify-center">
                  <BotIcon className="w-8 h-8" strokeWidth={2.5} />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>{currentBotConfig.name}</h2>
                <p className="text-sm opacity-80">{currentBotConfig.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {currentBot === "student" && (
                <>
                  <button
                    onClick={() => setSelectedMode(selectedMode === "elaborate" ? "normal" : "elaborate")}
                    className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                      selectedMode === "elaborate" ? 'bg-black text-white' : 'bg-white'
                    }`}
                    data-testid="mode-elaborate-btn"
                  >
                    Elaborate
                  </button>
                  <button
                    onClick={() => setSelectedMode(selectedMode === "short" ? "normal" : "short")}
                    className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                      selectedMode === "short" ? 'bg-black text-white' : 'bg-white'
                    }`}
                    data-testid="mode-short-btn"
                  >
                    Short
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6" data-testid="messages-container">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <BotIcon className="w-24 h-24 mx-auto mb-6 opacity-20" strokeWidth={2} />
                <p className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Start chatting with {currentBotConfig.name}
                </p>
                <p className="opacity-70">
                  {currentBotConfig.description}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
                data-testid={`message-${idx}`}
              >
                {msg.role === "assistant" ? (
                  <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-[85%]">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black text-white rounded-2xl rounded-tr-none p-6 max-w-[85%]">
                    <p className="text-base leading-relaxed">{msg.content}</p>
                  </div>
                )}
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-black rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 bg-white border-t-2 border-black">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={`Chat with ${currentBotConfig.name}...`}
                className="w-full rounded-full border-2 border-black p-4 pr-32 text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
                data-testid="chat-input"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-3">
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-3 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  data-testid="camera-btn"
                >
                  <Camera className="w-5 h-5" strokeWidth={2.5} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  data-testid="upload-btn"
                >
                  <Upload className="w-5 h-5" strokeWidth={2.5} />
                </button>
                <button
                  onClick={handleVoiceRecord}
                  className={`p-3 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
                    isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white'
                  }`}
                  data-testid="mic-btn"
                >
                  <Mic className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-8 py-5 font-bold rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: '#FF5A5F', fontFamily: 'Outfit, sans-serif' }}
              data-testid="send-btn"
            >
              <Send className="w-6 h-6" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border-2 border-black rounded-2xl p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
              data-testid="settings-modal"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-full border-2 border-black hover:bg-gray-100"
                  data-testid="close-settings-btn"
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>AI Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-3 border-2 border-black rounded-xl font-medium focus:outline-none"
                    data-testid="model-select"
                  >
                    <option value="gpt-5.1">GPT-5.1</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                    <option value="gemini-3-flash">Gemini 3 Flash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Theme</label>
                  <p className="text-sm opacity-70">Neo-Brutalist (Active)</p>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Account</label>
                  <p className="text-sm opacity-70">Logged in with Google</p>
                  <p className="text-xs opacity-50 mt-1">{user?.email}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
