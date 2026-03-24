import React from 'react';
import { useAudioEngine } from '../contexts/AudioContext';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { 
    Volume2, 
    Waves, 
    Filter, 
    ArrowUp, 
    ArrowDown, 
    RefreshCw, 
    CheckCircle, 
    Loader2,
    Brain,
    Zap,
    User,
    Mic,
    Sparkles,
    AudioLines,
    BellOff,
    Wind
} from 'lucide-react';

const AdvancedFilters = () => {
    const { 
        advancedSettings, 
        updateAdvanced, 
        workletsLoaded, 
        noiseProfileReady,
        mlNoiseReductionReady,
        vadProbability,
        humanVoiceReady,
        learnNoiseProfile,
        isListening 
    } = useAudioEngine();

    const gainPercentage = Math.round((advancedSettings.gain - 0.1) / (5 - 0.1) * 100);
    const isHighGain = advancedSettings.gain > 2;
    const isVeryHighGain = advancedSettings.gain > 3.5;

    const isNoiseReductionActive = advancedSettings.noise_reduction > 0 && isListening;
    const isUsingML = advancedSettings.noise_reduction_mode === 'ml';
    const isLearningNoise = isNoiseReductionActive && !isUsingML && !noiseProfileReady;

    return (
        <div className="control-card space-y-6" data-testid="advanced-filters-panel">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Advanced Filters
                {workletsLoaded && (
                    <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        DSP Active
                    </span>
                )}
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

            {/* Noise Reduction with Mode Selection */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <Waves className="w-3 h-3" />
                        Noise Reduction
                        {isNoiseReductionActive && (
                            isUsingML ? (
                                <Brain className="w-3 h-3 text-secondary" />
                            ) : isLearningNoise ? (
                                <Loader2 className="w-3 h-3 text-accent animate-spin" />
                            ) : (
                                <CheckCircle className="w-3 h-3 text-primary" />
                            )
                        )}
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
                
                {/* Mode Toggle: Basic vs ML */}
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                    <Button
                        variant={!isUsingML ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateAdvanced('noise_reduction_mode', 'basic')}
                        className={`flex-1 h-8 text-xs ${!isUsingML ? 'bg-primary text-primary-foreground' : ''}`}
                        data-testid="mode-basic-btn"
                    >
                        <Zap className="w-3 h-3 mr-1" />
                        Basic
                    </Button>
                    <Button
                        variant={isUsingML ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateAdvanced('noise_reduction_mode', 'ml')}
                        disabled={!mlNoiseReductionReady}
                        className={`flex-1 h-8 text-xs ${isUsingML ? 'bg-secondary text-secondary-foreground' : ''}`}
                        data-testid="mode-ml-btn"
                    >
                        <Brain className="w-3 h-3 mr-1" />
                        ML (RNNoise)
                    </Button>
                </div>
                
                <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                        {isUsingML ? (
                            mlNoiseReductionReady ? (
                                isNoiseReductionActive ? (
                                    <>Neural network active {vadProbability > 0 && <span className="text-primary">(VAD: {(vadProbability * 100).toFixed(0)}%)</span>}</>
                                ) : 'Deep learning noise suppression'
                            ) : 'Loading RNNoise model...'
                        ) : (
                            isNoiseReductionActive ? (
                                isLearningNoise ? 'Learning ambient noise...' : 'Spectral gating active'
                            ) : 'Spectral gating noise reduction'
                        )}
                    </p>
                    {!isUsingML && isNoiseReductionActive && noiseProfileReady && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={learnNoiseProfile}
                            className="h-6 px-2 text-xs"
                            data-testid="relearn-noise-btn"
                        >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Re-learn
                        </Button>
                    )}
                </div>
            </div>

            {/* Voice Isolation */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <Waves className="w-3 h-3" />
                        Voice Isolation
                        {advancedSettings.voice_isolation > 0 && isListening && (
                            <CheckCircle className="w-3 h-3 text-primary" />
                        )}
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
                    {advancedSettings.voice_isolation > 0 && isListening 
                        ? 'Bandpass + formant enhancement active' 
                        : 'Enhances speech frequencies (85Hz-3.4kHz)'}
                </p>
            </div>

            {/* Human Voice Focus */}
            <div className="space-y-3 pt-4 border-t border-border/30">
                <div className="flex items-center justify-between">
                    <Label className="label-text flex items-center gap-2">
                        <User className="w-3 h-3" />
                        Human Voice Focus
                        {humanVoiceReady && (advancedSettings.human_focus > 0 || advancedSettings.formant_boost > 0 || advancedSettings.presence_boost > 0) && isListening && (
                            <CheckCircle className="w-3 h-3 text-primary" />
                        )}
                    </Label>
                    <span className="text-sm font-mono text-foreground" data-testid="human-focus-value">
                        {advancedSettings.human_focus}%
                    </span>
                </div>
                <Slider
                    value={[advancedSettings.human_focus]}
                    onValueChange={(value) => updateAdvanced('human_focus', value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="human-focus-slider"
                />
                <p className="text-xs text-muted-foreground">
                    {advancedSettings.human_focus > 0 && isListening
                        ? 'Isolating human speech frequencies'
                        : 'Master control for speech isolation DSP'}
                </p>

                {/* Sub-controls appear when human focus or any sub-control is active */}
                {(advancedSettings.human_focus > 0 || advancedSettings.formant_boost > 0 || advancedSettings.presence_boost > 0 || advancedSettings.de_esser > 0 || advancedSettings.rumble_filter || advancedSettings.air_cut) && (
                    <div className="space-y-4 pl-2 border-l-2 border-primary/20 ml-1">
                        {/* Formant Boost */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                    <Mic className="w-3 h-3" />
                                    Formant Boost
                                </Label>
                                <span className="text-xs font-mono" data-testid="formant-boost-value">
                                    {advancedSettings.formant_boost}%
                                </span>
                            </div>
                            <Slider
                                value={[advancedSettings.formant_boost]}
                                onValueChange={(value) => updateAdvanced('formant_boost', value[0])}
                                min={0}
                                max={100}
                                step={5}
                                className="w-full"
                                data-testid="formant-boost-slider"
                            />
                        </div>

                        {/* Presence Boost */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                    <Sparkles className="w-3 h-3" />
                                    Presence / Clarity
                                </Label>
                                <span className="text-xs font-mono" data-testid="presence-boost-value">
                                    {advancedSettings.presence_boost}%
                                </span>
                            </div>
                            <Slider
                                value={[advancedSettings.presence_boost]}
                                onValueChange={(value) => updateAdvanced('presence_boost', value[0])}
                                min={0}
                                max={100}
                                step={5}
                                className="w-full"
                                data-testid="presence-boost-slider"
                            />
                        </div>

                        {/* De-esser */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
                                    <BellOff className="w-3 h-3" />
                                    De-esser
                                </Label>
                                <span className="text-xs font-mono" data-testid="de-esser-value">
                                    {advancedSettings.de_esser}%
                                </span>
                            </div>
                            <Slider
                                value={[advancedSettings.de_esser]}
                                onValueChange={(value) => updateAdvanced('de_esser', value[0])}
                                min={0}
                                max={100}
                                step={5}
                                className="w-full"
                                data-testid="de-esser-slider"
                            />
                        </div>

                        {/* Toggle row: Rumble Filter + Air Cut */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 flex-1">
                                <Switch
                                    checked={advancedSettings.rumble_filter}
                                    onCheckedChange={(checked) => updateAdvanced('rumble_filter', checked)}
                                    data-testid="rumble-filter-toggle"
                                />
                                <Label className="text-xs flex items-center gap-1 text-muted-foreground cursor-pointer">
                                    <AudioLines className="w-3 h-3" />
                                    Rumble Cut
                                </Label>
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                                <Switch
                                    checked={advancedSettings.air_cut}
                                    onCheckedChange={(checked) => updateAdvanced('air_cut', checked)}
                                    data-testid="air-cut-toggle"
                                />
                                <Label className="text-xs flex items-center gap-1 text-muted-foreground cursor-pointer">
                                    <Wind className="w-3 h-3" />
                                    Air Cut
                                </Label>
                            </div>
                        </div>
                    </div>
                )}
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdvancedFilters;
