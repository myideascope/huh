import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check if user is already logged in
    const checkAuth = useCallback(async () => {
        try {
            const response = await axios.get(`${API}/auth/me`, {
                withCredentials: true
            });
            setUser(response.data);
            setIsAuthenticated(true);
        } catch (error) {
            // Not authenticated - that's fine, guest mode
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Login with Google via Emergent Auth
    const login = useCallback(() => {
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        const redirectUrl = window.location.origin + '/auth/callback';
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }, []);

    // Process session_id from Emergent Auth callback
    const processAuthCallback = useCallback(async (sessionId) => {
        try {
            const response = await axios.post(
                `${API}/auth/session`,
                { session_id: sessionId },
                { withCredentials: true }
            );
            setUser(response.data);
            setIsAuthenticated(true);
            return true;
        } catch (error) {
            console.error('Auth callback error:', error);
            return false;
        }
    }, []);

    // Logout
    const logout = useCallback(async () => {
        try {
            await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setIsAuthenticated(false);
        }
    }, []);

    const value = {
        user,
        isLoading,
        isAuthenticated,
        login,
        logout,
        processAuthCallback,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
