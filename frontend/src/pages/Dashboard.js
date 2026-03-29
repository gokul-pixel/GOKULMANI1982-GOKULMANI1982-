import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Sparkles, Sprout, ChefHat, Settings, LogOut, Send, Mic, Camera, Upload, Brain, Image as ImageIcon, MoreVertical, Maximize2, X, Music, Copy, Edit2, Trash2, Volume2, VolumeX } from "lucide-react";
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
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [emotionDetected, setEmotionDetected] = useState(null);
  const [currentTheme, setCurrentTheme] = useState("light");
  const [teacherMode, setTeacherMode] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("gojo");
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const messagesEndRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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
    if ((!inputMessage.trim() && !uploadedImage) || isLoading) return;

    const userMsg = {
      role: "user",
      content: inputMessage || "Analyze this image",
      image_url: imagePreview,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    const messageToSend = inputMessage;
    setInputMessage("");
    const currentImage = uploadedImage;
    const currentPreview = imagePreview;
    setUploadedImage(null);
    setImagePreview(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: messageToSend || "Please analyze this image",
          bot_type: currentBot,
          ai_model: selectedModel,
          mode: selectedMode,
          image_data: currentImage
        })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      // Do NOT auto-speak - user controls when to speak
      
      // For cooking bot, get video if available
      if (currentBot === 'cook' && data.video_url) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message,
          video_url: data.video_url,
          timestamp: new Date().toISOString()
        }]);
      } else if (currentBot === 'music' && data.song_url) {
        // For music bot, play the song
        setCurrentSong(data.song_url);
        setIsPlaying(true);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message,
          song_url: data.song_url,
          timestamp: new Date().toISOString()
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
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
        
        if (currentBot === 'student' && teacherMode) {
          const text = await file.text();
          generateQuiz(text);
        } else {
          setInputMessage(prev => prev + ` [Uploaded: ${file.name}]`);
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };

  const generateQuiz = async (documentText) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ document_text: documentText })
      });

      if (response.ok) {
        const data = await response.json();
        setQuizQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setShowQuizResults(false);
        
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `📚 I've analyzed your document and created ${data.questions.length} questions to test your understanding. Let's begin!\n\n**Question 1:** ${data.questions[0].question}`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Quiz generation failed:', error);
    }
  };

  const handleQuizAnswer = async (userAnswer) => {
    if (currentQuestionIndex >= quizQuestions.length) return;

    const currentQ = quizQuestions[currentQuestionIndex];
    
    setMessages(prev => [...prev, 
      {
        role: "user",
        content: userAnswer,
        timestamp: new Date().toISOString()
      },
      {
        role: "assistant",
        content: `✓ **Correct Answer:** ${currentQ.answer}\n\n${currentQ.explanation || ''}`,
        timestamp: new Date().toISOString()
      }
    ]);

    if (currentQuestionIndex + 1 < quizQuestions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `**Question ${currentQuestionIndex + 2}:** ${quizQuestions[currentQuestionIndex + 1].question}`,
          timestamp: new Date().toISOString()
        }]);
      }, 1000);
    } else {
      setShowQuizResults(true);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `🎉 **Quiz Complete!** You've answered all questions. Great job! Would you like me to generate a study plan PDF?`,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const generateStudyPDF = async () => {
    try {
      const chatHistory = messages.map(m => m.content).join('\n\n');
      
      const response = await fetch(`${BACKEND_URL}/api/generate-study-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ document_text: chatHistory })
      });

      if (response.ok) {
        const data = await response.json();
        
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `📄 **Study Plan PDF Generated!**\n\n${data.study_plan}\n\n[Download PDF](${BACKEND_URL}${data.pdf_url})`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
    }
  };

  const handleVoiceRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      
      // Web Speech API for voice input
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInputMessage(transcript);
          setIsRecording(false);
        };
        
        recognition.onerror = () => {
          setIsRecording(false);
        };
        
        recognition.onend = () => {
          setIsRecording(false);
        };
        
        recognition.start();
      } else {
        alert('Speech recognition not supported in this browser');
        setIsRecording(false);
      }
    } else {
      setIsRecording(false);
    }
  };

  const speakText = (text, voice = selectedVoice) => {
    // Allow speaking if manually triggered OR if speaker is enabled
    const canSpeak = speakerEnabled || true; // Always allow manual speak button clicks
    if (!canSpeak) return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set language
      const langMap = {
        'en': 'en-US',
        'hi': 'hi-IN',
        'ta': 'ta-IN',
        'te': 'te-IN',
        'bn': 'bn-IN',
        'mr': 'mr-IN',
        'gu': 'gu-IN',
        'kn': 'kn-IN',
        'ml': 'ml-IN',
        'pa': 'pa-IN'
      };
      utterance.lang = langMap[selectedLanguage] || 'en-US';
      
      const voices = window.speechSynthesis.getVoices();
      if (voice === 'gojo') {
        const maleVoice = voices.find(v => v.name.includes('Male') || v.name.includes('David') || v.name.includes('Daniel'));
        if (maleVoice) utterance.voice = maleVoice;
        utterance.pitch = 0.9;
        utterance.rate = 1.1;
      } else if (voice === 'noelle') {
        const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Victoria'));
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.pitch = 1.2;
        utterance.rate = 1.0;
      }
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
    alert('Message copied to clipboard!');
  };

  const deleteConversation = async (botType) => {
    if (!confirm('Delete all messages for this bot?')) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/chat/delete/${botType}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (currentBot === botType) {
        setMessages([]);
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const saveEditedMessage = async (messageId) => {
    if (!editedContent.trim()) return;
    
    const updatedMessages = messages.map(msg => 
      msg.message_id === messageId ? { ...msg, content: editedContent } : msg
    );
    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditedContent("");
  };

  const startEmotionDetection = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        const detectEmotion = async () => {
          if (!isCameraActive || !videoRef.current || !canvasRef.current) return;
          
          const canvas = canvasRef.current;
          const video = videoRef.current;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          
          const imageData = canvas.toDataURL('image/jpeg');
          
          try {
            const response = await fetch(`${BACKEND_URL}/api/analyze-emotion`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ image_data: imageData })
            });
            
            if (response.ok) {
              const data = await response.json();
              setEmotionDetected(data.emotion);
              setInputMessage(`I'm feeling ${data.emotion}. Recommend me some music!`);
            }
          } catch (error) {
            console.error('Emotion detection error:', error);
          }
        };
        
        const interval = setInterval(detectEmotion, 3000);
        
        return () => {
          clearInterval(interval);
          stream.getTracks().forEach(track => track.stop());
        };
      }
    } catch (error) {
      console.error('Camera access error:', error);
      alert('Camera access denied. Please allow camera permissions.');
      setIsCameraActive(false);
    }
  };

  const stopEmotionDetection = () => {
    setIsCameraActive(false);
    setEmotionDetected(null);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleLogout = async () => {
    try {
      // Stop camera if active
      if (isCameraActive) {
        stopEmotionDetection();
      }
      
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const applyTheme = (theme) => {
    setCurrentTheme(theme);
    const root = document.documentElement;
    
    if (theme === "dark") {
      root.style.setProperty('--bg-primary', '#1A1A1A');
      root.style.setProperty('--bg-secondary', '#2A2A2A');
      root.style.setProperty('--text-primary', '#FFFFFF');
      root.style.setProperty('--text-secondary', '#E0E0E0');
      root.style.setProperty('--border-color', '#FFFFFF');
    } else if (theme === "cool-blue") {
      root.style.setProperty('--bg-primary', '#E3F2FD');
      root.style.setProperty('--bg-secondary', '#BBDEFB');
      root.style.setProperty('--text-primary', '#0D47A1');
      root.style.setProperty('--text-secondary', '#1565C0');
      root.style.setProperty('--border-color', '#0D47A1');
    } else {
      // Light theme (default)
      root.style.setProperty('--bg-primary', '#FFFDF9');
      root.style.setProperty('--bg-secondary', '#FFFFFF');
      root.style.setProperty('--text-primary', '#1A1A1A');
      root.style.setProperty('--text-secondary', '#1A1A1A');
      root.style.setProperty('--border-color', '#000000');
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
    },
    music: {
      name: "Music Companion",
      icon: Music,
      color: "#FFB6E1",
      description: "Emotion-based music recommendations"
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
        </div>

        {/* Bot Selection - Ultra Compact */}
        <div className="p-4 border-b-2 border-black">
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {Object.entries(botConfigs).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <motion.button
                  key={key}
                  onClick={() => setCurrentBot(key)}
                  title={config.name}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 border-black font-bold flex items-center justify-center transition-all ${
                    currentBot === key
                      ? 'shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5 scale-110'
                      : 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5'
                  }`}
                  style={{ 
                    backgroundColor: currentBot === key ? config.color : '#FFFFFF',
                  }}
                  data-testid={`bot-${key}-btn`}
                >
                  <motion.div
                    animate={currentBot === key ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                  </motion.div>
                </motion.button>
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
                  className="relative group"
                >
                  <div
                    className="p-3 bg-white border-2 border-black rounded-xl text-xs font-medium cursor-pointer hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    onClick={() => setCurrentBot(conv.bot_type || conv._id)}
                    data-testid={`history-item-${idx}`}
                  >
                    <p className="font-bold mb-1">{botConfigs[conv.bot_type || conv._id]?.name}</p>
                    <p className="opacity-70 truncate">{conv.count} messages</p>
                  </div>
                  <button
                    onClick={() => deleteConversation(conv.bot_type || conv._id)}
                    className="absolute top-2 right-2 p-1 rounded bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`delete-conv-${idx}`}
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={2.5} />
                  </button>
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
                {currentBot === "music" && emotionDetected && (
                  <p className="text-sm font-bold mt-1">Detected Emotion: {emotionDetected} 🎵</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {currentBot === "music" && (
                <button
                  onClick={isCameraActive ? stopEmotionDetection : startEmotionDetection}
                  className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                    isCameraActive ? 'bg-red-500 text-white' : 'bg-white'
                  }`}
                  data-testid="emotion-camera-btn"
                >
                  {isCameraActive ? 'Stop Camera' : 'Start Face Reading'}
                </button>
              )}
              
              {/* Voice Selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedVoice('gojo');
                    setSpeakerEnabled(true);
                  }}
                  className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                    selectedVoice === 'gojo' ? 'bg-blue-500 text-white' : 'bg-white'
                  }`}
                  data-testid="voice-gojo-btn"
                >
                  🗣️ Gojo (Male)
                </button>
                <button
                  onClick={() => {
                    setSelectedVoice('noelle');
                    setSpeakerEnabled(true);
                  }}
                  className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                    selectedVoice === 'noelle' ? 'bg-pink-500 text-white' : 'bg-white'
                  }`}
                  data-testid="voice-noelle-btn"
                >
                  🗣️ Noelle (Female)
                </button>
                <button
                  onClick={isSpeaking ? stopSpeaking : null}
                  className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                    isSpeaking ? 'bg-green-500 text-white animate-pulse' : 'bg-white'
                  }`}
                  data-testid="speaker-status-btn"
                >
                  {isSpeaking ? <VolumeX className="w-5 h-5 inline" /> : <Volume2 className="w-5 h-5 inline" />}
                  {speakerEnabled ? ' ON' : ' OFF'}
                </button>
              </div>
              
              {currentBot === "student" && (
                <>
                  <button
                    onClick={() => setTeacherMode(!teacherMode)}
                    className={`px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all ${
                      teacherMode ? 'bg-black text-white' : 'bg-white'
                    }`}
                    data-testid="teacher-mode-btn"
                  >
                    👨‍🏫 Teacher Mode
                  </button>
                  <button
                    onClick={generateStudyPDF}
                    className="px-4 py-2 rounded-full border-2 border-black text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all bg-white"
                    data-testid="generate-pdf-btn"
                  >
                    📄 Generate PDF
                  </button>
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
          
          {/* Camera preview for Music Companion */}
          {currentBot === "music" && isCameraActive && (
            <div className="mt-4 relative">
              <video 
                ref={videoRef}
                className="w-48 h-36 rounded-lg border-2 border-black object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
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
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
                data-testid={`message-${idx}`}
              >
                {msg.role === "assistant" ? (
                  <div className="bg-white border-2 border-black rounded-2xl rounded-tl-none p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-[85%] relative group">
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setEditingMessageId(msg.message_id);
                          setEditedContent(msg.content);
                        }}
                        className="p-1 rounded bg-yellow-200 hover:bg-yellow-300"
                        data-testid="edit-msg-btn"
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={2.5} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => copyMessage(msg.content)}
                        className="p-1 rounded bg-gray-200 hover:bg-gray-300"
                        data-testid="copy-msg-btn"
                      >
                        <Copy className="w-4 h-4" strokeWidth={2.5} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => speakText(msg.content)}
                        className="p-1 rounded bg-blue-200 hover:bg-blue-300"
                        data-testid="speak-msg-btn"
                      >
                        <Volume2 className="w-4 h-4" strokeWidth={2.5} />
                      </motion.button>
                    </div>
                    
                    {editingMessageId === msg.message_id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full p-3 border-2 border-black rounded-xl font-medium min-h-[100px]"
                          data-testid="edit-textarea"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEditedMessage(msg.message_id)}
                            className="px-4 py-2 rounded-xl border-2 border-black bg-green-200 hover:bg-green-300 font-bold text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditedContent("");
                            }}
                            className="px-4 py-2 rounded-xl border-2 border-black bg-gray-200 hover:bg-gray-300 font-bold text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    
                    {/* Video embed for cooking bot */}
                    {msg.video_url && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ delay: 0.3 }}
                        className="mt-4"
                      >
                        <iframe
                          width="100%"
                          height="315"
                          src={msg.video_url}
                          title="Recipe Video"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-lg border-2 border-black"
                        ></iframe>
                      </motion.div>
                    )}
                    
                    {/* Music player for music bot */}
                    {msg.song_url && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                        className="mt-4"
                      >
                        <iframe
                          width="100%"
                          height="80"
                          src={msg.song_url}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          className="rounded-lg border-2 border-black"
                        ></iframe>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="bg-black text-white rounded-2xl rounded-tr-none p-6 max-w-[85%]">
                    {msg.image_url && (
                      <motion.img 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        src={msg.image_url} 
                        alt="Uploaded" 
                        className="max-w-full rounded-lg mb-3 border-2 border-white"
                        style={{ maxHeight: '300px' }}
                      />
                    )}
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
          {imagePreview && (
            <div className="mb-4 relative inline-block">
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="max-h-32 rounded-lg border-2 border-black"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setUploadedImage(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full border-2 border-black flex items-center justify-center font-bold hover:bg-red-600"
              >
                ×
              </button>
            </div>
          )}
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
                <motion.button
                  onClick={() => cameraInputRef.current?.click()}
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-3 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  data-testid="camera-btn"
                >
                  <Camera className="w-5 h-5" strokeWidth={2.5} />
                </motion.button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                />
                <motion.button
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.1, y: -3 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-3 rounded-full border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                  data-testid="upload-btn"
                >
                  <Upload className="w-5 h-5" strokeWidth={2.5} />
                </motion.button>
                <motion.button
                  onClick={handleVoiceRecord}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={isRecording ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5, repeat: isRecording ? Infinity : 0 }}
                  className={`p-3 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
                    isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white'
                  }`}
                  data-testid="mic-btn"
                >
                  <Mic className="w-5 h-5" strokeWidth={2.5} />
                </motion.button>
              </div>
            </div>
            <motion.button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95, rotate: -2 }}
              className="px-8 py-5 font-bold rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: '#FF5A5F', fontFamily: 'Outfit, sans-serif' }}
              data-testid="send-btn"
            >
              <motion.div
                animate={isLoading ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
              >
                <Send className="w-6 h-6" strokeWidth={2.5} />
              </motion.div>
            </motion.button>
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
                  <label className="block text-sm font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Language</label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full p-3 border-2 border-black rounded-xl font-medium focus:outline-none"
                    data-testid="language-select"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                    <option value="mr">मराठी (Marathi)</option>
                    <option value="gu">ગુજરાતી (Gujarati)</option>
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    <option value="ml">മലയാളം (Malayalam)</option>
                    <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Speaker</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSpeakerEnabled(!speakerEnabled)}
                      className={`px-6 py-3 rounded-xl border-2 border-black font-bold transition-all ${
                        speakerEnabled 
                          ? 'bg-green-500 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' 
                          : 'bg-gray-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                      data-testid="speaker-toggle"
                    >
                      {speakerEnabled ? '🔊 ON' : '🔇 OFF'}
                    </button>
                    <span className="text-sm opacity-70">
                      {speakerEnabled ? 'Speaker enabled' : 'Speaker disabled'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => applyTheme('light')}
                      className={`p-3 rounded-xl border-2 border-black font-medium text-sm transition-all ${
                        currentTheme === 'light' 
                          ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' 
                          : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                      data-testid="theme-light-btn"
                    >
                      Light
                    </button>
                    <button
                      onClick={() => applyTheme('dark')}
                      className={`p-3 rounded-xl border-2 border-black font-medium text-sm transition-all ${
                        currentTheme === 'dark' 
                          ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' 
                          : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                      data-testid="theme-dark-btn"
                    >
                      Dark
                    </button>
                    <button
                      onClick={() => applyTheme('cool-blue')}
                      className={`p-3 rounded-xl border-2 border-black font-medium text-sm transition-all ${
                        currentTheme === 'cool-blue' 
                          ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' 
                          : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                      }`}
                      data-testid="theme-coolblue-btn"
                    >
                      Cool Blue
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>Alternative Login</label>
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email address"
                      className="w-full p-3 border-2 border-black rounded-xl font-medium focus:outline-none"
                      data-testid="email-input"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number"
                      className="w-full p-3 border-2 border-black rounded-xl font-medium focus:outline-none"
                      data-testid="phone-input"
                    />
                    <button
                      className="w-full px-6 py-3 rounded-xl border-2 border-black bg-blue-500 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] font-bold"
                      data-testid="login-submit-btn"
                    >
                      Login with Email/Phone
                    </button>
                    <p className="text-xs opacity-50 text-center">Coming soon - Currently using Google Auth</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
