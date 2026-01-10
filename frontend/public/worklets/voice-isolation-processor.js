// Voice Isolation Audio Worklet Processor
// Uses bandpass filtering and formant enhancement

class VoiceIsolationProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Voice frequency range: 85Hz - 3400Hz (typical human speech)
        this.isolationAmount = 0; // 0-100
        
        // Biquad filter coefficients for voice bandpass
        // Low cutoff ~100Hz
        this.lowCutCoeffs = this.calculateHighpassCoeffs(100, 0.707);
        // High cutoff ~3500Hz  
        this.highCutCoeffs = this.calculateLowpassCoeffs(3500, 0.707);
        // Presence boost around 2-4kHz
        this.presenceCoeffs = this.calculatePeakingCoeffs(3000, 2, 6);
        // Fundamental voice boost 100-300Hz
        this.fundamentalCoeffs = this.calculatePeakingCoeffs(200, 1, 4);
        
        // Filter states
        this.lowCutState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        this.highCutState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        this.presenceState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        this.fundamentalState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        
        // Voice activity detection
        this.voiceEnvelope = 0;
        this.noiseEnvelope = 0;
        
        this.port.onmessage = (event) => {
            if (event.data.type === 'setIsolation') {
                this.isolationAmount = event.data.value;
                this.updateFilters();
            }
        };
    }
    
    // Calculate highpass biquad coefficients
    calculateHighpassCoeffs(freq, Q) {
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
        
        return {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0
        };
    }
    
    // Calculate lowpass biquad coefficients
    calculateLowpassCoeffs(freq, Q) {
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
        
        return {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0
        };
    }
    
    // Calculate peaking EQ coefficients
    calculatePeakingCoeffs(freq, Q, gainDB) {
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
        
        return {
            b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
            a1: a1 / a0, a2: a2 / a0
        };
    }
    
    // Update filter coefficients based on isolation amount
    updateFilters() {
        const isolationFactor = this.isolationAmount / 100;
        
        // Tighter bandpass as isolation increases
        const lowFreq = 100 + isolationFactor * 100; // 100-200Hz
        const highFreq = 3500 - isolationFactor * 500; // 3500-3000Hz
        
        this.lowCutCoeffs = this.calculateHighpassCoeffs(lowFreq, 0.707 + isolationFactor * 0.5);
        this.highCutCoeffs = this.calculateLowpassCoeffs(highFreq, 0.707 + isolationFactor * 0.5);
        
        // Increase presence boost with isolation
        const presenceGain = 3 + isolationFactor * 6; // 3-9dB
        this.presenceCoeffs = this.calculatePeakingCoeffs(2500, 1.5, presenceGain);
        
        // Increase fundamental boost
        const fundamentalGain = 2 + isolationFactor * 4; // 2-6dB
        this.fundamentalCoeffs = this.calculatePeakingCoeffs(200, 1.2, fundamentalGain);
    }
    
    // Apply biquad filter
    applyBiquad(sample, coeffs, state) {
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
        
        // If isolation is 0, pass through
        if (this.isolationAmount === 0) {
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            return true;
        }
        
        const isolationFactor = this.isolationAmount / 100;
        
        for (let i = 0; i < inputChannel.length; i++) {
            let sample = inputChannel[i];
            
            // Apply bandpass filtering (highpass then lowpass)
            let filtered = this.applyBiquad(sample, this.lowCutCoeffs, this.lowCutState);
            filtered = this.applyBiquad(filtered, this.highCutCoeffs, this.highCutState);
            
            // Apply presence boost for clarity
            filtered = this.applyBiquad(filtered, this.presenceCoeffs, this.presenceState);
            
            // Apply fundamental boost for fullness
            filtered = this.applyBiquad(filtered, this.fundamentalCoeffs, this.fundamentalState);
            
            // Mix dry and wet signal based on isolation amount
            outputChannel[i] = sample * (1 - isolationFactor * 0.7) + filtered * isolationFactor * 1.2;
        }
        
        return true;
    }
}

registerProcessor('voice-isolation-processor', VoiceIsolationProcessor);
