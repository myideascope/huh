// Noise Reduction Audio Worklet Processor
// Uses spectral gating with noise floor estimation

class NoiseReductionProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // Parameters
        this.reductionAmount = 0; // 0-100
        this.noiseFloor = new Float32Array(256);
        this.noiseFloorInitialized = false;
        this.sampleBuffer = new Float32Array(512);
        this.bufferIndex = 0;
        this.smoothingFactor = 0.95;
        this.gateThreshold = 0.02;
        this.attackTime = 0.005;
        this.releaseTime = 0.05;
        this.envelope = 0;
        
        // For noise profile learning
        this.isLearningNoise = false;
        this.learningSamples = 0;
        this.learningFrames = 0;
        
        // Message handling
        this.port.onmessage = (event) => {
            if (event.data.type === 'setReduction') {
                this.reductionAmount = event.data.value;
            } else if (event.data.type === 'learnNoise') {
                this.isLearningNoise = true;
                this.learningSamples = 0;
                this.learningFrames = 0;
                this.noiseFloor.fill(0);
            } else if (event.data.type === 'reset') {
                this.noiseFloorInitialized = false;
                this.noiseFloor.fill(0);
            }
        };
    }

    // Simple RMS calculation for a block
    calculateRMS(samples) {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        return Math.sqrt(sum / samples.length);
    }

    // Spectral gate - reduces signal when below threshold
    applySpectralGate(input, output) {
        const reductionFactor = this.reductionAmount / 100;
        const attackCoeff = Math.exp(-1 / (sampleRate * this.attackTime));
        const releaseCoeff = Math.exp(-1 / (sampleRate * this.releaseTime));
        
        for (let i = 0; i < input.length; i++) {
            const sample = input[i];
            const absSample = Math.abs(sample);
            
            // Envelope follower
            if (absSample > this.envelope) {
                this.envelope = attackCoeff * this.envelope + (1 - attackCoeff) * absSample;
            } else {
                this.envelope = releaseCoeff * this.envelope + (1 - releaseCoeff) * absSample;
            }
            
            // Calculate adaptive threshold based on noise floor
            const noiseThreshold = this.gateThreshold * (1 + reductionFactor * 2);
            
            // Apply soft gate
            if (this.envelope < noiseThreshold) {
                // Below threshold - reduce signal
                const gateAmount = this.envelope / noiseThreshold;
                const reduction = Math.pow(gateAmount, 2 + reductionFactor * 3);
                output[i] = sample * reduction;
            } else {
                // Above threshold - pass through with slight smoothing
                output[i] = sample;
            }
        }
    }

    // Learn noise profile from ambient sound
    learnNoiseProfile(input) {
        for (let i = 0; i < input.length; i++) {
            const idx = this.learningSamples % this.noiseFloor.length;
            const absSample = Math.abs(input[i]);
            
            // Running average
            if (this.learningFrames === 0) {
                this.noiseFloor[idx] = absSample;
            } else {
                this.noiseFloor[idx] = this.noiseFloor[idx] * 0.9 + absSample * 0.1;
            }
            
            this.learningSamples++;
        }
        
        this.learningFrames++;
        
        // Learn for about 1 second of audio
        if (this.learningFrames > 50) {
            this.isLearningNoise = false;
            this.noiseFloorInitialized = true;
            
            // Calculate average noise floor
            let avgNoise = 0;
            for (let i = 0; i < this.noiseFloor.length; i++) {
                avgNoise += this.noiseFloor[i];
            }
            avgNoise /= this.noiseFloor.length;
            this.gateThreshold = avgNoise * 1.5;
            
            this.port.postMessage({ type: 'noiseProfileReady', threshold: this.gateThreshold });
        }
    }

    // Wiener filter-like spectral subtraction (simplified)
    applySpectralSubtraction(input, output) {
        const reductionFactor = this.reductionAmount / 100;
        
        // Add samples to buffer
        for (let i = 0; i < input.length; i++) {
            this.sampleBuffer[this.bufferIndex] = input[i];
            this.bufferIndex = (this.bufferIndex + 1) % this.sampleBuffer.length;
        }
        
        // Calculate local energy
        let localEnergy = 0;
        for (let i = 0; i < input.length; i++) {
            localEnergy += input[i] * input[i];
        }
        localEnergy = Math.sqrt(localEnergy / input.length);
        
        // Estimate noise energy
        const noiseEnergy = this.gateThreshold;
        
        // Wiener gain calculation
        const snr = Math.max(0, (localEnergy - noiseEnergy * reductionFactor) / (localEnergy + 0.0001));
        const gain = Math.max(0.1, Math.min(1, snr));
        
        // Apply gain with smoothing
        for (let i = 0; i < input.length; i++) {
            output[i] = input[i] * (1 - reductionFactor + reductionFactor * gain);
        }
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }
        
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        // If reduction is 0, pass through
        if (this.reductionAmount === 0) {
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            return true;
        }
        
        // Learning phase
        if (this.isLearningNoise) {
            this.learnNoiseProfile(inputChannel);
            // Pass through during learning
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            return true;
        }
        
        // Auto-learn noise floor if not initialized
        if (!this.noiseFloorInitialized) {
            this.isLearningNoise = true;
            this.port.postMessage({ type: 'learningNoise' });
        }
        
        // Apply noise reduction
        this.applySpectralGate(inputChannel, outputChannel);
        
        // Apply spectral subtraction on top for better results
        if (this.reductionAmount > 30) {
            const tempBuffer = new Float32Array(outputChannel);
            this.applySpectralSubtraction(tempBuffer, outputChannel);
        }
        
        return true;
    }
}

registerProcessor('noise-reduction-processor', NoiseReductionProcessor);
