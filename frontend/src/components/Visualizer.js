import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Activity, BarChart3 } from 'lucide-react';

const Visualizer = () => {
    const { isListening, getAnalyserData } = useAudioEngine();
    const waveformCanvasRef = useRef(null);
    const spectrumCanvasRef = useRef(null);
    const animationRef = useRef(null);
    const [activeTab, setActiveTab] = useState('both');

    const drawWaveform = useCallback((canvas, data) => {
        if (!canvas || !data) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw center line
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#22c55e';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.beginPath();

        const sliceWidth = width / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }, []);

    const drawSpectrum = useCallback((canvas, data) => {
        if (!canvas || !data) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw frequency bars
        const barCount = 64;
        const barWidth = width / barCount - 2;
        const step = Math.floor(data.length / barCount);

        for (let i = 0; i < barCount; i++) {
            const value = data[i * step];
            const barHeight = (value / 255) * height * 0.9;
            const x = i * (barWidth + 2);
            const y = height - barHeight;

            // Color gradient based on frequency
            const hue = 120 + (i / barCount) * 60; // Green to yellow
            const saturation = 70 + (value / 255) * 30;
            const lightness = 40 + (value / 255) * 20;

            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.shadowColor = `hsl(${hue}, 80%, 50%)`;
            ctx.shadowBlur = value > 200 ? 15 : 5;

            // Draw rounded bar
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 2);
            ctx.fill();
        }

        ctx.shadowBlur = 0;

        // Draw frequency labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px JetBrains Mono';
        const labels = ['20Hz', '200Hz', '2kHz', '20kHz'];
        labels.forEach((label, i) => {
            const x = (width / (labels.length - 1)) * i;
            ctx.fillText(label, i === labels.length - 1 ? x - 30 : x, height - 5);
        });
    }, []);

    useEffect(() => {
        const animate = () => {
            if (isListening) {
                const { waveform, frequency } = getAnalyserData();

                if (activeTab === 'waveform' || activeTab === 'both') {
                    drawWaveform(waveformCanvasRef.current, waveform);
                }
                if (activeTab === 'spectrum' || activeTab === 'both') {
                    drawSpectrum(spectrumCanvasRef.current, frequency);
                }
            } else {
                // Draw idle state
                if (waveformCanvasRef.current) {
                    const ctx = waveformCanvasRef.current.getContext('2d');
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                    ctx.fillRect(0, 0, waveformCanvasRef.current.width, waveformCanvasRef.current.height);
                    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(0, waveformCanvasRef.current.height / 2);
                    ctx.lineTo(waveformCanvasRef.current.width, waveformCanvasRef.current.height / 2);
                    ctx.stroke();
                }
                if (spectrumCanvasRef.current) {
                    const ctx = spectrumCanvasRef.current.getContext('2d');
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                    ctx.fillRect(0, 0, spectrumCanvasRef.current.width, spectrumCanvasRef.current.height);
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isListening, activeTab, getAnalyserData, drawWaveform, drawSpectrum]);

    // Handle canvas resize
    useEffect(() => {
        const resizeCanvases = () => {
            [waveformCanvasRef, spectrumCanvasRef].forEach(ref => {
                if (ref.current) {
                    const canvas = ref.current;
                    const container = canvas.parentElement;
                    if (container) {
                        canvas.width = container.clientWidth;
                        canvas.height = container.clientHeight;
                    }
                }
            });
        };

        resizeCanvases();
        window.addEventListener('resize', resizeCanvases);
        return () => window.removeEventListener('resize', resizeCanvases);
    }, [activeTab]);

    return (
        <div className="control-card p-0 overflow-hidden" data-testid="visualizer-panel">
            {/* Tab header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Audio Visualization
                </h3>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-muted/30">
                        <TabsTrigger
                            value="waveform"
                            className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                            data-testid="tab-waveform"
                        >
                            <Activity className="w-3 h-3 mr-1" />
                            Wave
                        </TabsTrigger>
                        <TabsTrigger
                            value="spectrum"
                            className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                            data-testid="tab-spectrum"
                        >
                            <BarChart3 className="w-3 h-3 mr-1" />
                            Spectrum
                        </TabsTrigger>
                        <TabsTrigger
                            value="both"
                            className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                            data-testid="tab-both"
                        >
                            Both
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Visualization area */}
            <div className={`${activeTab === 'both' ? 'grid grid-cols-1 lg:grid-cols-2 gap-1' : ''} bg-black`}>
                {(activeTab === 'waveform' || activeTab === 'both') && (
                    <div
                        className={`relative ${activeTab === 'both' ? 'h-48' : 'h-64'} bg-black`}
                        data-testid="waveform-container"
                    >
                        <canvas
                            ref={waveformCanvasRef}
                            className="waveform-canvas absolute inset-0 w-full h-full"
                            data-testid="waveform-canvas"
                        />
                        {activeTab === 'both' && (
                            <div className="absolute top-2 left-2 text-xs font-mono text-primary/60">
                                WAVEFORM
                            </div>
                        )}
                        {!isListening && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-muted-foreground text-sm">
                                    Start listening to see waveform
                                </span>
                            </div>
                        )}
                    </div>
                )}
                {(activeTab === 'spectrum' || activeTab === 'both') && (
                    <div
                        className={`relative ${activeTab === 'both' ? 'h-48' : 'h-64'} bg-black`}
                        data-testid="spectrum-container"
                    >
                        <canvas
                            ref={spectrumCanvasRef}
                            className="spectrum-canvas absolute inset-0 w-full h-full"
                            data-testid="spectrum-canvas"
                        />
                        {activeTab === 'both' && (
                            <div className="absolute top-2 left-2 text-xs font-mono text-secondary/60">
                                SPECTRUM
                            </div>
                        )}
                        {!isListening && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-muted-foreground text-sm">
                                    Start listening to see spectrum
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Visualizer;
