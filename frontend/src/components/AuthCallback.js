import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
    const { processAuthCallback } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const hasProcessed = useRef(false);

    useEffect(() => {
        // Prevent double processing in StrictMode
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const processAuth = async () => {
            // Extract session_id from URL hash fragment
            const hash = location.hash;
            const params = new URLSearchParams(hash.replace('#', ''));
            const sessionId = params.get('session_id');

            if (sessionId) {
                const success = await processAuthCallback(sessionId);
                if (success) {
                    // Redirect to main app
                    navigate('/', { replace: true });
                } else {
                    // Auth failed, go to home
                    navigate('/', { replace: true });
                }
            } else {
                // No session_id, go to home
                navigate('/', { replace: true });
            }
        };

        processAuth();
    }, [location.hash, processAuthCallback, navigate]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Signing you in...</p>
            </div>
        </div>
    );
};

export default AuthCallback;
