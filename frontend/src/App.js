import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import BrainOfBruh from "@/pages/BrainOfBruh";
import BruhVoiceAgent from "@/components/BruhVoiceAgent";
import "@/App.css";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/brain" element={<BrainOfBruh />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <BruhVoiceAgent />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
