import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        const hashParams = new URLSearchParams(location.hash.substring(1));
        const sessionId = hashParams.get('session_id');

        if (!sessionId) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
          method: 'POST',
          headers: {
            'X-Session-ID': sessionId,
          },
          credentials: 'include'
        });

        if (!response.ok) throw new Error('Session creation failed');

        const data = await response.json();
        
        document.cookie = `session_token=${data.session_token}; path=/; secure; samesite=none; max-age=${7*24*60*60}`;
        
        navigate('/dashboard', { replace: true, state: { user: data.user } });
      } catch (error) {
        console.error('Auth error:', error);
        navigate('/login');
      }
    };

    processSession();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FFFDF9' }}>
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>Setting up your account...</p>
      </div>
    </div>
  );
}