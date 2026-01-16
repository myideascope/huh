import React, { useEffect, useState } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import DeviceSelector from './DeviceSelector';
import Equalizer from './Equalizer';
import AdvancedFilters from './AdvancedFilters';
import Visualizer from './Visualizer';
import RecordingControls from './RecordingControls';
import PresetsPanel from './PresetsPanel';
import LogsPanel from './LogsPanel';
import UserMenu from './UserMenu';
import { Button } from './ui/button';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import {
    Play,
    Square,
    Headphones,
    AlertTriangle,
    Settings,
    RotateCcw,
    Volume2,
} from 'lucide-react';

const Dashboard = () => {
    const {
        isInitialized,
        isListening,
        initializeAudio,
        startListening,
        stopListening,
        resetSettings,
        addLog,
    } = useAudioEngine();

    const [showHeadphoneWarning, setShowHeadphoneWarning] = useState(true);

    useEffect(() => {
        // Initialize audio engine on mount
        initializeAudio();
    }, [initializeAudio]);

    const handleToggleListening = async () => {
        if (isListening) {
            stopListening();
            toast.info('Audio monitoring stopped');
        } else {
            const success = await startListening();
            if (success) {
                toast.success('Audio monitoring started');
                setShowHeadphoneWarning(true);
            } else {
                toast.error('Failed to start audio monitoring');
            }
        }
    };

    const handleReset = () => {
        resetSettings();
        toast.info('Settings reset to defaults');
    };

    return (
        <div className="min-h-screen bg-background" data-testid="dashboard">
            <Toaster position="top-right" richColors />

            {/* Header */}
            <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                    <Volume2 className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight" data-testid="app-title">
                                        AudioForge
                                    </h1>
                                    <p className="text-xs text-muted-foreground">
                                        Real-time Audio Enhancement
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* User Menu / Sign In */}
                            <UserMenu />

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleReset}
                                className="text-muted-foreground"
                                data-testid="reset-all-btn"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reset
                            </Button>

                            <Button
                                onClick={handleToggleListening}
                                className={isListening ? 'btn-destructive' : 'btn-primary'}
                                size="lg"
                                data-testid="toggle-listening-btn"
                            >
                                {isListening ? (
                                    <>
                                        <Square className="w-4 h-4 mr-2 fill-current" />
                                        Stop
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 mr-2 fill-current" />
                                        Start Listening
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Headphone Warning Banner */}
            {showHeadphoneWarning && (
                <div className="headphone-warning" data-testid="headphone-warning">
                    <div className="container mx-auto px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Headphones className="w-5 h-5 text-accent" />
                            <span className="text-sm text-accent">
                                <strong>Headphones Required:</strong> Use headphones to prevent audio feedback loops
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHeadphoneWarning(false)}
                            className="text-accent hover:text-accent/80"
                            data-testid="dismiss-warning-btn"
                        >
                            Dismiss
                        </Button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column - Device & Presets */}
                    <div className="lg:col-span-3 space-y-6">
                        <DeviceSelector />
                        <PresetsPanel />
                    </div>

                    {/* Center Column - Visualizer & EQ */}
                    <div className="lg:col-span-6 space-y-6">
                        <Visualizer />
                        <Equalizer />
                        {/* Recording Controls - Below EQ */}
                        <RecordingControls />
                    </div>

                    {/* Right Column - Advanced Filters */}
                    <div className="lg:col-span-3 space-y-6">
                        <AdvancedFilters />
                    </div>

                    {/* Bottom - Logs (Full Width) */}
                    <div className="lg:col-span-12">
                        <LogsPanel />
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-border/40 py-4 mt-8">
                <div className="container mx-auto px-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>AudioForge v1.0.0</span>
                        <span>Use responsibly and respect privacy</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Dashboard;
