import React, { useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AudioEngineProvider } from './contexts/AudioContext';
import Dashboard from './components/Dashboard';

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
        <AudioEngineProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                </Routes>
            </BrowserRouter>
        </AudioEngineProvider>
    );
}

export default App;
