// ML-Based Noise Reduction using RNNoise (WebAssembly)
// RNNoise is a recurrent neural network for noise suppression
// Uses @jitsi/rnnoise-wasm compiled library

// Import the sync version of RNNoise (inlined WASM)
importScripts('./rnnoise-sync.js');

class RNNoiseProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        // RNNoise configuration
        this.FRAME_SIZE = 480; // RNNoise expects 480 samples (10ms at 48kHz)
        this.rnnoiseState = null;
        this.rnnoiseModule = null;
        this.inputBuffer = new Float32Array(this.FRAME_SIZE);
        this.outputBuffer = new Float32Array(this.FRAME_SIZE);
        this.bufferIndex = 0;
        this.isInitialized = false;
        this.isEnabled = true;
        this.vadThreshold = 0.5; // Voice activity detection threshold
        
        // Heap pointers for WASM memory
        this.inputPtr = null;
        this.outputPtr = null;
        
        // Initialize RNNoise asynchronously
        this.initRNNoise();
        
        // Handle messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'setEnabled') {
                this.isEnabled = event.data.value;
            } else if (event.data.type === 'setVadThreshold') {
                this.vadThreshold = event.data.value;
            }
        };
    }
    
    async initRNNoise() {
        try {
            // RNNoise module is loaded via importScripts above
            if (typeof RNNoise === 'undefined') {
                throw new Error('RNNoise module not loaded');
            }
            
            // Initialize the WASM module
            this.rnnoiseModule = await RNNoise();
            
            // Create RNNoise state
            this.rnnoiseState = this.rnnoiseModule._rnnoise_create();
            
            if (!this.rnnoiseState) {
                throw new Error('Failed to create RNNoise state');
            }
            
            // Allocate memory for input/output buffers in WASM heap
            const bytesPerSample = 4; // Float32
            this.inputPtr = this.rnnoiseModule._malloc(this.FRAME_SIZE * bytesPerSample);
            this.outputPtr = this.rnnoiseModule._malloc(this.FRAME_SIZE * bytesPerSample);
            
            if (!this.inputPtr || !this.outputPtr) {
                throw new Error('Failed to allocate WASM memory');
            }
            
            this.isInitialized = true;
            this.port.postMessage({ type: 'initialized', success: true });
            console.log('[RNNoise] ML noise reduction initialized successfully');
            
        } catch (error) {
            console.error('[RNNoise] Initialization failed:', error);
            this.port.postMessage({ type: 'initialized', success: false, error: error.message });
        }
    }
    
    processRNNoise(inputSamples) {
        if (!this.isInitialized || !this.rnnoiseModule || !this.rnnoiseState) {
            return inputSamples;
        }
        
        try {
            // RNNoise expects samples in range [-32768, 32767] (int16 range)
            // But works with float internally, so we scale
            const scaledInput = new Float32Array(this.FRAME_SIZE);
            for (let i = 0; i < this.FRAME_SIZE; i++) {
                scaledInput[i] = inputSamples[i] * 32767;
            }
            
            // Copy input to WASM heap
            this.rnnoiseModule.HEAPF32.set(scaledInput, this.inputPtr / 4);
            
            // Process with RNNoise - returns VAD probability
            const vadProbability = this.rnnoiseModule._rnnoise_process_frame(
                this.rnnoiseState,
                this.outputPtr,
                this.inputPtr
            );
            
            // Copy output from WASM heap
            const processedSamples = new Float32Array(this.FRAME_SIZE);
            for (let i = 0; i < this.FRAME_SIZE; i++) {
                processedSamples[i] = this.rnnoiseModule.HEAPF32[this.outputPtr / 4 + i] / 32767;
            }
            
            // Apply VAD gating if probability is below threshold
            if (vadProbability < this.vadThreshold) {
                // Reduce volume for non-speech
                for (let i = 0; i < this.FRAME_SIZE; i++) {
                    processedSamples[i] *= vadProbability;
                }
            }
            
            // Send VAD probability to main thread periodically
            if (Math.random() < 0.05) {
                this.port.postMessage({ type: 'vad', probability: vadProbability });
            }
            
            return processedSamples;
            
        } catch (error) {
            console.error('[RNNoise] Processing error:', error);
            return inputSamples;
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
        
        // If not enabled or not initialized, pass through
        if (!this.isEnabled || !this.isInitialized) {
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            return true;
        }
        
        // Buffer incoming samples (Web Audio gives 128 samples, RNNoise needs 480)
        for (let i = 0; i < inputChannel.length; i++) {
            this.inputBuffer[this.bufferIndex] = inputChannel[i];
            this.bufferIndex++;
            
            // When we have enough samples, process with RNNoise
            if (this.bufferIndex >= this.FRAME_SIZE) {
                this.outputBuffer = this.processRNNoise(this.inputBuffer);
                this.bufferIndex = 0;
            }
        }
        
        // Output from the processed buffer
        // Note: There's inherent latency due to buffering (480 samples = 10ms at 48kHz)
        const outputOffset = Math.max(0, this.bufferIndex - inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
            const bufferIdx = (outputOffset + i) % this.FRAME_SIZE;
            outputChannel[i] = this.outputBuffer[bufferIdx] || inputChannel[i];
        }
        
        return true;
    }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
