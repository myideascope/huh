import React, { useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AudioEngineProvider } from './contexts/AudioContext';
import { AuthProvider } from './contexts/AuthContext';
import Dashboard from './components/Dashboard';
import AuthCallback from './components/AuthCallback';

// Detect system theme preference
const getSystemTheme = () => {
    if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
};

// Apply theme to document
const applyTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
};

// Router component that handles auth callback detection
const AppRouter = () => {
    const location = useLocation();
    
    // Check URL fragment for session_id SYNCHRONOUSLY during render
    // This prevents race conditions with auth callback
    if (location.hash?.includes('session_id=')) {
        return <AuthCallback />;
    }
    
    return (
        <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
    );
};

function App() {
    useEffect(() => {
        // Apply initial theme
        const theme = getSystemTheme();
        applyTheme(theme);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            applyTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return (
        <AuthProvider>
            <AudioEngineProvider>
                <BrowserRouter>
                    <AppRouter />
                </BrowserRouter>
            </AudioEngineProvider>
        </AuthProvider>
    );
}

export default App;
