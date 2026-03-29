import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Sparkles, Brain, Sprout, ChefHat, Music } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          credentials: 'include'
        });
        if (response.ok) {
          navigate('/dashboard');
        }
      } catch (error) {
        console.log('Not authenticated');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFDF9' }}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div>
              <h1 className="text-6xl font-black mb-4" style={{ fontFamily: 'Outfit, sans-serif', color: '#1A1A1A' }}>
                BRUH
              </h1>
              <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Outfit, sans-serif', color: '#FF5A5F' }}>
                Your AI Assistant
              </h2>
              <p className="text-lg font-medium leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif', color: '#1A1A1A' }}>
                Meet BRUH - your ultimate AI companion for learning, cooking, farming, and everything in between.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="feature-student">
                <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center mb-3" style={{ backgroundColor: '#A0C4FF' }}>
                  <Sparkles className="w-6 h-6" strokeWidth={3} />
                </div>
                <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Student Partner</h3>
                <p className="text-xs" style={{ fontFamily: 'DM Sans, sans-serif' }}>Study plans & tutoring</p>
              </div>
              
              <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="feature-music">
                <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center mb-3" style={{ backgroundColor: '#FFB6E1' }}>
                  <Music className="w-6 h-6" strokeWidth={3} />
                </div>
                <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Music Companion</h3>
                <p className="text-xs" style={{ fontFamily: 'DM Sans, sans-serif' }}>Emotion-based music</p>
              </div>
              
              <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="feature-crop">
                <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center mb-3" style={{ backgroundColor: '#CAFFBF' }}>
                  <Sprout className="w-6 h-6" strokeWidth={3} />
                </div>
                <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Crop Assistant</h3>
                <p className="text-xs" style={{ fontFamily: 'DM Sans, sans-serif' }}>Plant care & disease detection</p>
              </div>
              
              <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="feature-cook">
                <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center mb-3" style={{ backgroundColor: '#FFADAD' }}>
                  <ChefHat className="w-6 h-6" strokeWidth={3} />
                </div>
                <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>Cook Bot</h3>
                <p className="text-xs" style={{ fontFamily: 'DM Sans, sans-serif' }}>Recipes & cooking tips</p>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full px-8 py-4 font-bold rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all text-white text-lg"
              style={{ backgroundColor: '#FF5A5F', fontFamily: 'Outfit, sans-serif' }}
              data-testid="google-login-btn"
            >
              Continue with Google
            </button>
          </div>
          
          <div className="hidden md:flex items-center justify-center">
            <div className="bg-white border-2 border-black rounded-3xl p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md">
              <MessageCircle className="w-32 h-32 mx-auto mb-6" strokeWidth={2.5} />
              <p className="text-center font-bold text-xl" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Chat with AI, analyze images, get study plans, and much more!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}