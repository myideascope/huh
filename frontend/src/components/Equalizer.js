import React from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';

const EQ_BANDS = [
    { id: 'band_60hz', label: '60', unit: 'Hz' },
    { id: 'band_230hz', label: '230', unit: 'Hz' },
    { id: 'band_910hz', label: '910', unit: 'Hz' },
    { id: 'band_3600hz', label: '3.6', unit: 'kHz' },
    { id: 'band_14000hz', label: '14', unit: 'kHz' },
];

const Equalizer = () => {
    const { eqSettings, updateEQ, resetSettings } = useAudioEngine();

    const handleBandChange = (band, value) => {
        updateEQ(band, value[0]);
    };

    const resetEQ = () => {
        EQ_BANDS.forEach(band => {
            updateEQ(band.id, 0);
        });
    };

    return (
        <div className="control-card" data-testid="equalizer-panel">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Equalizer
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetEQ}
                    className="h-8 px-3 text-xs"
                    data-testid="reset-eq-btn"
                >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                </Button>
            </div>

            <div className="grid grid-cols-5 gap-4 items-end h-52">
                {EQ_BANDS.map((band) => {
                    const value = eqSettings[band.id] || 0;
                    const isBoost = value > 0;
                    const isCut = value < 0;

                    return (
                        <div
                            key={band.id}
                            className="flex flex-col items-center gap-2"
                            data-testid={`eq-band-${band.id}`}
                        >
                            {/* Value display */}
                            <span
                                className={`text-xs font-mono ${
                                    isBoost ? 'text-primary' : isCut ? 'text-destructive' : 'text-muted-foreground'
                                }`}
                                data-testid={`eq-value-${band.id}`}
                            >
                                {value > 0 ? '+' : ''}{value.toFixed(0)}
                            </span>

                            {/* Vertical slider container */}
                            <div className="relative h-36 flex items-center justify-center">
                                {/* Center line indicator */}
                                <div className="absolute w-full h-px bg-border/50 top-1/2" />
                                
                                {/* Custom vertical slider */}
                                <input
                                    type="range"
                                    min={-12}
                                    max={12}
                                    step={0.5}
                                    value={value}
                                    onChange={(e) => handleBandChange(band.id, [parseFloat(e.target.value)])}
                                    className="eq-slider"
                                    data-testid={`eq-slider-${band.id}`}
                                />
                            </div>

                            {/* Frequency label */}
                            <div className="text-center">
                                <span className="text-xs font-bold text-foreground">{band.label}</span>
                                <span className="text-xs text-muted-foreground ml-0.5">{band.unit}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* dB scale reference */}
            <div className="flex justify-between text-xs text-muted-foreground mt-4 px-2">
                <span>-12 dB</span>
                <span>0 dB</span>
                <span>+12 dB</span>
            </div>
        </div>
    );
};

export default Equalizer;
