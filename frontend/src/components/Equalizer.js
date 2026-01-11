import React from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';

// 15-band graphic equalizer - ISO 1/3 octave center frequencies
const EQ_BANDS = [
    { id: 'band_25hz', label: '25', unit: '' },
    { id: 'band_40hz', label: '40', unit: '' },
    { id: 'band_63hz', label: '63', unit: '' },
    { id: 'band_100hz', label: '100', unit: '' },
    { id: 'band_160hz', label: '160', unit: '' },
    { id: 'band_250hz', label: '250', unit: '' },
    { id: 'band_400hz', label: '400', unit: '' },
    { id: 'band_630hz', label: '630', unit: '' },
    { id: 'band_1000hz', label: '1k', unit: '' },
    { id: 'band_1600hz', label: '1.6k', unit: '' },
    { id: 'band_2500hz', label: '2.5k', unit: '' },
    { id: 'band_4000hz', label: '4k', unit: '' },
    { id: 'band_6300hz', label: '6.3k', unit: '' },
    { id: 'band_10000hz', label: '10k', unit: '' },
    { id: 'band_16000hz', label: '16k', unit: '' },
];

const Equalizer = () => {
    const { eqSettings, updateEQ } = useAudioEngine();

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
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    15-Band Equalizer
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

            {/* EQ Sliders Container */}
            <div className="relative">
                {/* dB scale markers on left */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-muted-foreground py-1">
                    <span>+12</span>
                    <span className="text-center">0</span>
                    <span>-12</span>
                </div>

                {/* Sliders */}
                <div className="ml-10 grid grid-cols-15 gap-1 items-end h-44">
                    {EQ_BANDS.map((band) => {
                        const value = eqSettings[band.id] || 0;
                        const isBoost = value > 0;
                        const isCut = value < 0;
                        // Calculate visual position (0 = center, positive = up, negative = down)
                        const percentage = ((value + 12) / 24) * 100;

                        return (
                            <div
                                key={band.id}
                                className="flex flex-col items-center gap-1 group"
                                data-testid={`eq-band-${band.id}`}
                            >
                                {/* Value tooltip on hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono text-center min-w-[32px]">
                                    <span className={isBoost ? 'text-primary' : isCut ? 'text-destructive' : 'text-muted-foreground'}>
                                        {value > 0 ? '+' : ''}{value.toFixed(0)}
                                    </span>
                                </div>

                                {/* Vertical slider container */}
                                <div className="relative h-28 w-full flex items-center justify-center">
                                    {/* Background track */}
                                    <div className="absolute inset-x-1/2 -translate-x-1/2 w-1 h-full bg-muted/50 rounded-full" />
                                    
                                    {/* Center line */}
                                    <div className="absolute w-3 h-px bg-border top-1/2" />
                                    
                                    {/* Value indicator bar */}
                                    <div 
                                        className={`absolute inset-x-1/2 -translate-x-1/2 w-1.5 rounded-full transition-all ${
                                            isBoost ? 'bg-primary' : isCut ? 'bg-destructive' : 'bg-muted'
                                        }`}
                                        style={{
                                            top: isBoost ? `${50 - (value / 24) * 50}%` : '50%',
                                            bottom: isCut ? `${50 + (value / 24) * 50}%` : '50%',
                                            height: `${Math.abs(value / 24) * 50}%`
                                        }}
                                    />
                                    
                                    {/* Slider input */}
                                    <input
                                        type="range"
                                        min={-12}
                                        max={12}
                                        step={0.5}
                                        value={value}
                                        onChange={(e) => handleBandChange(band.id, [parseFloat(e.target.value)])}
                                        className="eq-slider-15"
                                        data-testid={`eq-slider-${band.id}`}
                                    />
                                </div>

                                {/* Frequency label */}
                                <div className="text-center">
                                    <span className="text-[10px] font-medium text-muted-foreground">{band.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Frequency range labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-2 ml-10 px-1">
                <span>Sub</span>
                <span>Bass</span>
                <span>Low Mid</span>
                <span>Mid</span>
                <span>High Mid</span>
                <span>Treble</span>
            </div>
        </div>
    );
};

export default Equalizer;
