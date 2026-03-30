import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Volume2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function BruhVoiceAgent() {
  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [showAgent, setShowAgent] = useState(false);
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);

  const speakResponse = useCallback((text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => v.name.includes('Male') || v.name.includes('David'));
      if (maleVoice) utterance.voice = maleVoice;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const processCommand = useCallback(async (command) => {
    setIsProcessing(true);
    setTranscript(command);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: command,
          bot_type: 'normal',
          ai_model: 'gpt-5.1',
          mode: 'short'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResponse(data.message);
        speakResponse(data.message);
      } else {
        setResponse("Sorry, I couldn't process that. Try again!");
        speakResponse("Sorry, I couldn't process that.");
      }
    } catch (err) {
      setResponse("I'm having connection issues. Try again!");
      speakResponse("I'm having connection issues.");
    } finally {
      setIsProcessing(false);
    }
  }, [speakResponse]);

  const startActiveListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          setTranscript(event.results[i][0].transcript);
        }
      }
      if (finalTranscript) {
        processCommand(finalTranscript);
      }
    };

    recognition.onerror = () => {
      setIsAwake(false);
    };

    recognition.onend = () => {
      // Don't auto-restart active listening
    };

    recognition.start();
    return recognition;
  }, [processCommand]);

  const startWakeWordListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.toLowerCase().trim();
        if (t.includes('bruh') || t.includes('bro') || t.includes('hey bruh')) {
          recognition.stop();
          setIsAwake(true);
          setShowAgent(true);
          setResponse("Hey! I'm BRUH, your assistant. What do you need?");
          speakResponse("Hey! I'm BRUH. What can I do for you?");

          // Start active listening for the actual command
          setTimeout(() => {
            startActiveListening();
          }, 2000);

          // Auto-sleep after 30 seconds of inactivity
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setIsAwake(false);
            setShowAgent(false);
          }, 30000);
          return;
        }
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        setTimeout(() => {
          if (isListening && !isAwake) startWakeWordListening();
        }, 1000);
      }
    };

    recognition.onend = () => {
      if (isListening && !isAwake) {
        setTimeout(() => startWakeWordListening(), 500);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, isAwake, speakResponse, startActiveListening]);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      setIsAwake(false);
      setShowAgent(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } else {
      setIsListening(true);
    }
  };

  useEffect(() => {
    if (isListening && !isAwake) {
      startWakeWordListening();
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening, isAwake, startWakeWordListening]);

  const askAgain = () => {
    setTranscript("");
    setResponse("");
    startActiveListening();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsAwake(false);
      setShowAgent(false);
    }, 30000);
  };

  const dismissAgent = () => {
    setIsAwake(false);
    setShowAgent(false);
    setTranscript("");
    setResponse("");
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  return (
    <>
      {/* Floating BRUH button - always visible */}
      <motion.button
        onClick={toggleListening}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full border-3 font-black text-sm flex items-center justify-center transition-all ${
          isListening
            ? isAwake
              ? 'bg-green-500 text-white border-white shadow-[0_0_20px_rgba(34,197,94,0.5)]'
              : 'bg-red-500 text-white border-white wake-pulse'
            : 'bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]'
        }`}
        style={{ fontFamily: 'Outfit, sans-serif', borderWidth: '3px' }}
        data-testid="bruh-wake-btn"
      >
        {isListening ? (
          isAwake ? <Volume2 className="w-7 h-7" /> : <Mic className="w-7 h-7" />
        ) : (
          <MicOff className="w-6 h-6" />
        )}
      </motion.button>

      {/* Label below button */}
      {isListening && !isAwake && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-1 right-4 z-50 text-xs font-bold text-center px-2 py-1 rounded-full"
          style={{ color: 'var(--text-primary)' }}
        >
          Say "BRUH"
        </motion.div>
      )}

      {/* Agent popup */}
      <AnimatePresence>
        {showAgent && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl border-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            data-testid="bruh-agent-popup"
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--accent-color)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center">
                  <span className="font-black text-sm" style={{ fontFamily: 'Outfit' }}>B</span>
                </div>
                <div>
                  <p className="font-bold text-white text-sm" style={{ fontFamily: 'Outfit' }}>BRUH Assistant</p>
                  <p className="text-white text-xs opacity-80">
                    {isProcessing ? 'Thinking...' : isAwake ? 'Listening...' : 'Ready'}
                  </p>
                </div>
              </div>
              <button onClick={dismissAgent} className="p-1 rounded-full hover:bg-white/20 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 max-h-60 overflow-y-auto">
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-3 p-3 rounded-xl rounded-tr-none text-sm"
                  style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                >
                  {transcript}
                </motion.div>
              )}

              {isProcessing && (
                <div className="flex gap-2 p-3">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-primary)', animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-primary)', animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-primary)', animationDelay: '300ms' }} />
                </div>
              )}

              {response && !isProcessing && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-xl rounded-tl-none border-2 text-sm"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                >
                  {response.length > 300 ? response.substring(0, 300) + '...' : response}
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="p-3 border-t-2 flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={askAgain}
                className="flex-1 py-2 rounded-xl border-2 font-bold text-sm hover:-translate-y-0.5 transition-all"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                data-testid="bruh-ask-again-btn"
              >
                <Mic className="w-4 h-4 inline mr-1" /> Ask Again
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={dismissAgent}
                className="flex-1 py-2 rounded-xl border-2 font-bold text-sm hover:-translate-y-0.5 transition-all text-white"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--accent-color)' }}
                data-testid="bruh-dismiss-btn"
              >
                Done
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
