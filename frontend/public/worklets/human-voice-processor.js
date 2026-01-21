// Human Voice Isolation DSP Processor
// Combines multiple techniques to isolate human speech from background sounds

class HumanVoiceProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Filter states for multiple biquad filters
        this.filters = {
            // Formant filters (F1, F2, F3 resonances of human speech)
            formant1: { state: this.createFilterState(), freq: 500, Q: 2, gain: 0 },   // F1: 300-900Hz
            formant2: { state: this.createFilterState(), freq: 1500, Q: 2, gain: 0 },  // F2: 900-2500Hz
            formant3: { state: this.createFilterState(), freq: 2800, Q: 2, gain: 0 },  // F3: 2500-3500Hz
            
            // De-esser (reduces sibilance)
            deesser: { state: this.createFilterState(), freq: 6000, Q: 1, gain: 0 },
            
            // Rumble filter (removes sub-bass noise)
            rumble: { state: this.createFilterState(), freq: 80, Q: 0.7, enabled: false },
            
            // Presence filter (speech clarity 2-5kHz)
            presence: { state: this.createFilterState(), freq: 3500, Q: 1, gain: 0 },
            
            // Air/breath filter (reduces high freq hiss above speech)
            air: { state: this.createFilterState(), freq: 12000, Q: 0.7, enabled: false },
        };
        
        // Settings
        this.settings = {
            formantBoost: 0,      // 0-100: boost formant frequencies
            deesserAmount: 0,     // 0-100: reduce sibilance
            rumbleFilter: false,  // Remove sub-80Hz rumble
            presenceBoost: 0,     // 0-100: boost clarity range
            airCut: false,        // Cut frequencies above 12kHz
            humanFocus: 0,        // 0-100: overall human voice focus
        };
        
        // Envelope followers for dynamic processing
        this.envelope = 0;
        this.spectralCentroid = 1000;
        
        this.port.onmessage = (event) => {
            const { type, setting, value } = event.data;
            if (type === 'setSetting' && setting in this.settings) {
                this.settings[setting] = value;
                this.updateFilters();
            } else if (type === 'setAll') {
                Object.assign(this.settings, event.data.settings);
                this.updateFilters();
            }
        };
        
        this.updateFilters();
    }
    
    createFilterState() {
        return { x1: 0, x2: 0, y1: 0, y2: 0 };
    }
    
    // Calculate biquad coefficients for peaking EQ
    calcPeakingCoeffs(freq, Q, gainDB) {
        const A = Math.pow(10, gainDB / 40);
        const w0 = 2 * Math.PI * freq / sampleRate;
        const cosW0 = Math.cos(w0);
        const sinW0 = Math.sin(w0);
        const alpha = sinW0 / (2 * Q);
        
        const b0 = 1 + alpha * A;
        const b1 = -2 * cosW0;
        const b2 = 1 - alpha * A;
        const a0 = 1 + alpha / A;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha / A;
        
        return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
    }
    
    // Calculate highpass coefficients
    calcHighpassCoeffs(freq, Q) {
        const w0 = 2 * Math.PI * freq / sampleRate;
        const cosW0 = Math.cos(w0);
        const sinW0 = Math.sin(w0);
        const alpha = sinW0 / (2 * Q);
        
        const b0 = (1 + cosW0) / 2;
        const b1 = -(1 + cosW0);
        const b2 = (1 + cosW0) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha;
        
        return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
    }
    
    // Calculate lowpass coefficients
    calcLowpassCoeffs(freq, Q) {
        const w0 = 2 * Math.PI * freq / sampleRate;
        const cosW0 = Math.cos(w0);
        const sinW0 = Math.sin(w0);
        const alpha = sinW0 / (2 * Q);
        
        const b0 = (1 - cosW0) / 2;
        const b1 = 1 - cosW0;
        const b2 = (1 - cosW0) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha;
        
        return { b0: b0/a0, b1: b1/a0, b2: b2/a0, a1: a1/a0, a2: a2/a0 };
    }
    
    // Calculate notch/cut coefficients (for de-esser)
    calcNotchCoeffs(freq, Q, cutDB) {
        // Use peaking with negative gain for cuts
        return this.calcPeakingCoeffs(freq, Q, -Math.abs(cutDB));
    }
    
    updateFilters() {
        const { formantBoost, deesserAmount, presenceBoost, humanFocus } = this.settings;
        
        // Calculate effective gains based on humanFocus master control
        const focusFactor = humanFocus / 100;
        
        // Formant boost (emphasize human voice resonances)
        const formantGain = (formantBoost / 100) * 8 * (1 + focusFactor); // Up to 16dB boost
        this.filters.formant1.coeffs = this.calcPeakingCoeffs(500, 2 + focusFactor, formantGain * 0.8);
        this.filters.formant2.coeffs = this.calcPeakingCoeffs(1500, 2 + focusFactor, formantGain);
        this.filters.formant3.coeffs = this.calcPeakingCoeffs(2800, 2 + focusFactor, formantGain * 0.7);
        
        // De-esser (cut sibilance)
        const deesserCut = (deesserAmount / 100) * 12; // Up to 12dB cut
        this.filters.deesser.coeffs = this.calcNotchCoeffs(6000, 1.5, deesserCut);
        
        // Presence boost (speech clarity)
        const presenceGain = (presenceBoost / 100) * 6 * (1 + focusFactor * 0.5); // Up to 9dB
        this.filters.presence.coeffs = this.calcPeakingCoeffs(3500, 1.5, presenceGain);
        
        // Rumble filter
        this.filters.rumble.coeffs = this.calcHighpassCoeffs(
            80 + (focusFactor * 40), // 80-120Hz depending on focus
            0.7
        );
        
        // Air cut filter
        this.filters.air.coeffs = this.calcLowpassCoeffs(
            12000 - (focusFactor * 4000), // 12kHz down to 8kHz with focus
            0.7
        );
    }
    
    applyBiquad(sample, coeffs, state) {
        if (!coeffs) return sample;
        
        const output = coeffs.b0 * sample + coeffs.b1 * state.x1 + coeffs.b2 * state.x2
                     - coeffs.a1 * state.y1 - coeffs.a2 * state.y2;
        
        state.x2 = state.x1;
        state.x1 = sample;
        state.y2 = state.y1;
        state.y1 = output;
        
        return output;
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }
        
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        const { formantBoost, deesserAmount, rumbleFilter, presenceBoost, airCut, humanFocus } = this.settings;
        
        // If everything is off, pass through
        if (formantBoost === 0 && deesserAmount === 0 && !rumbleFilter && 
            presenceBoost === 0 && !airCut && humanFocus === 0) {
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            return true;
        }
        
        for (let i = 0; i < inputChannel.length; i++) {
            let sample = inputChannel[i];
            
            // Apply rumble filter first (highpass)
            if (rumbleFilter || humanFocus > 0) {
                sample = this.applyBiquad(sample, this.filters.rumble.coeffs, this.filters.rumble.state);
            }
            
            // Apply formant boosts
            if (formantBoost > 0 || humanFocus > 0) {
                sample = this.applyBiquad(sample, this.filters.formant1.coeffs, this.filters.formant1.state);
                sample = this.applyBiquad(sample, this.filters.formant2.coeffs, this.filters.formant2.state);
                sample = this.applyBiquad(sample, this.filters.formant3.coeffs, this.filters.formant3.state);
            }
            
            // Apply presence boost
            if (presenceBoost > 0 || humanFocus > 0) {
                sample = this.applyBiquad(sample, this.filters.presence.coeffs, this.filters.presence.state);
            }
            
            // Apply de-esser
            if (deesserAmount > 0) {
                sample = this.applyBiquad(sample, this.filters.deesser.coeffs, this.filters.deesser.state);
            }
            
            // Apply air cut (lowpass)
            if (airCut || humanFocus > 50) {
                sample = this.applyBiquad(sample, this.filters.air.coeffs, this.filters.air.state);
            }
            
            outputChannel[i] = sample;
        }
        
        return true;
    }
}

registerProcessor('human-voice-processor', HumanVoiceProcessor);
