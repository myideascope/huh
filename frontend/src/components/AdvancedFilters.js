import React from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Volume2, Waves, Filter, ArrowUp, ArrowDown } from 'lucide-react';

const AdvancedFilters = () => {
    const { advancedSettings, updateAdvanced } = useAudioEngine();

    const gainPercentage = Math.round((advancedSettings.gain - 0.1) / (5 - 0.1) * 100);
    const isHighGain = advancedSettings.gain > 2;
    const isVeryHighGain = advancedSettings.gain > 3.5;

    return (
        <div className="control-card space-y-6" data-testid="advanced-filters-panel">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Advanced Filters
            </h3>

            {/* Gain Control */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <Volume2 className="w-3 h-3" />
                        Master Gain
                    </Label>
                    <span
                        className={`text-sm font-mono ${
                            isVeryHighGain ? 'text-destructive' : isHighGain ? 'text-accent' : 'text-foreground'
                        }`}
                        data-testid="gain-value"
                    >
                        {advancedSettings.gain.toFixed(1)}x
                    </span>
                </div>
                <input
                    type="range"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={advancedSettings.gain}
                    onChange={(e) => updateAdvanced('gain', parseFloat(e.target.value))}
                    className="gain-slider w-full"
                    data-testid="gain-slider"
                />
                {isVeryHighGain && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                        <span className="animate-pulse">⚠</span> High gain may cause distortion
                    </p>
                )}
            </div>

            {/* Noise Reduction - Visual placeholder */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <Waves className="w-3 h-3" />
                        Noise Reduction
                    </Label>
                    <span className="text-sm font-mono text-foreground" data-testid="noise-reduction-value">
                        {advancedSettings.noise_reduction}%
                    </span>
                </div>
                <Slider
                    value={[advancedSettings.noise_reduction]}
                    onValueChange={(value) => updateAdvanced('noise_reduction', value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="noise-reduction-slider"
                />
                <p className="text-xs text-muted-foreground">
                    Reduces background noise (simulated)
                </p>
            </div>

            {/* Voice Isolation - Visual placeholder */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <Waves className="w-3 h-3" />
                        Voice Isolation
                    </Label>
                    <span className="text-sm font-mono text-foreground" data-testid="voice-isolation-value">
                        {advancedSettings.voice_isolation}%
                    </span>
                </div>
                <Slider
                    value={[advancedSettings.voice_isolation]}
                    onValueChange={(value) => updateAdvanced('voice_isolation', value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="voice-isolation-slider"
                />
                <p className="text-xs text-muted-foreground">
                    Enhances voice frequencies (simulated)
                </p>
            </div>

            {/* Highpass Filter */}
            <div className="space-y-3 pt-4 border-t border-border/30">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <ArrowUp className="w-3 h-3" />
                        Highpass Filter
                    </Label>
                    <Switch
                        checked={advancedSettings.highpass_enabled}
                        onCheckedChange={(checked) => updateAdvanced('highpass_enabled', checked)}
                        className={advancedSettings.highpass_enabled ? 'filter-toggle-active' : ''}
                        data-testid="highpass-toggle"
                    />
                </div>
                {advancedSettings.highpass_enabled && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Cutoff Frequency</span>
                            <span className="text-xs font-mono" data-testid="highpass-freq-value">
                                {advancedSettings.highpass_frequency} Hz
                            </span>
                        </div>
                        <Slider
                            value={[advancedSettings.highpass_frequency]}
                            onValueChange={(value) => updateAdvanced('highpass_frequency', value[0])}
                            min={20}
                            max={500}
                            step={10}
                            className="w-full"
                            data-testid="highpass-freq-slider"
                        />
                        <p className="text-xs text-muted-foreground">
                            Removes low rumble and bass frequencies
                        </p>
                    </div>
                )}
            </div>

            {/* Lowpass Filter */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <ArrowDown className="w-3 h-3" />
                        Lowpass Filter
                    </Label>
                    <Switch
                        checked={advancedSettings.lowpass_enabled}
                        onCheckedChange={(checked) => updateAdvanced('lowpass_enabled', checked)}
                        className={advancedSettings.lowpass_enabled ? 'filter-toggle-active' : ''}
                        data-testid="lowpass-toggle"
                    />
                </div>
                {advancedSettings.lowpass_enabled && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Cutoff Frequency</span>
                            <span className="text-xs font-mono" data-testid="lowpass-freq-value">
                                {(advancedSettings.lowpass_frequency / 1000).toFixed(1)} kHz
                            </span>
                        </div>
                        <Slider
                            value={[advancedSettings.lowpass_frequency]}
                            onValueChange={(value) => updateAdvanced('lowpass_frequency', value[0])}
                            min={1000}
                            max={20000}
                            step={500}
                            className="w-full"
                            data-testid="lowpass-freq-slider"
                        />
                        <p className="text-xs text-muted-foreground">
                            Removes high-frequency hiss and noise
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvancedFilters;
