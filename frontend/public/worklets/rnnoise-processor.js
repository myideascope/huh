// ML-Based Noise Reduction using RNNoise (WebAssembly)
// Loads WASM binary directly without Emscripten glue code
// WASM bytes are sent from the main thread via postMessage

class RNNoiseProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.FRAME_SIZE = 480; // RNNoise expects 480 samples (10ms at 48kHz)
        this.rnnoiseState = null;
        this.wasmExports = null;
        this.heapF32 = null;
        this.inputPtr = null;
        this.outputPtr = null;
        this.inputBuffer = new Float32Array(this.FRAME_SIZE);
        this.outputBuffer = new Float32Array(this.FRAME_SIZE);
        this.bufferIndex = 0;
        this.isInitialized = false;
        this.isEnabled = true;
        this.vadThreshold = 0.5;

        this.port.onmessage = (event) => {
            const { type } = event.data;
            if (type === 'init-wasm') {
                this.initWasm(event.data.wasmBytes);
            } else if (type === 'setEnabled') {
                this.isEnabled = event.data.value;
            } else if (type === 'setVadThreshold') {
                this.vadThreshold = event.data.value;
            }
        };
    }

    async initWasm(wasmBytes) {
        try {
            const importObj = {
                a: {
                    a: (requestedSize) => {
                        // _emscripten_resize_heap - not needed for fixed-size processing
                        return 0;
                    },
                    b: (dest, src, num) => {
                        // _emscripten_memcpy_big - copy within WASM memory
                        const heap = new Uint8Array(this.wasmExports.c.buffer);
                        heap.copyWithin(dest, src, src + num);
                    }
                }
            };

            const module = await WebAssembly.compile(wasmBytes);
            const instance = await WebAssembly.instantiate(module, importObj);
            this.wasmExports = instance.exports;

            // Call constructors
            this.wasmExports.d();

            // Initialize RNNoise
            this.wasmExports.g(); // _rnnoise_init

            // Create RNNoise state
            this.rnnoiseState = this.wasmExports.h(); // _rnnoise_create
            if (!this.rnnoiseState) {
                throw new Error('Failed to create RNNoise state');
            }

            // Allocate buffers in WASM memory
            const bytesPerSample = 4; // Float32
            this.inputPtr = this.wasmExports.e(this.FRAME_SIZE * bytesPerSample); // _malloc
            this.outputPtr = this.wasmExports.e(this.FRAME_SIZE * bytesPerSample); // _malloc

            if (!this.inputPtr || !this.outputPtr) {
                throw new Error('Failed to allocate WASM memory');
            }

            this.heapF32 = new Float32Array(this.wasmExports.c.buffer);
            this.isInitialized = true;
            this.port.postMessage({ type: 'initialized', success: true });

        } catch (error) {
            console.error('[RNNoise] Init failed:', error);
            this.port.postMessage({ type: 'initialized', success: false, error: error.message });
        }
    }

    processRNNoise(inputSamples) {
        if (!this.isInitialized || !this.wasmExports || !this.rnnoiseState) {
            return inputSamples;
        }

        try {
            // Refresh heap view in case memory grew
            if (this.heapF32.buffer !== this.wasmExports.c.buffer) {
                this.heapF32 = new Float32Array(this.wasmExports.c.buffer);
            }

            // Scale to int16 range as RNNoise expects
            const inputOffset = this.inputPtr >> 2;
            for (let i = 0; i < this.FRAME_SIZE; i++) {
                this.heapF32[inputOffset + i] = inputSamples[i] * 32767;
            }

            // Process - returns VAD probability
            const vadProbability = this.wasmExports.j( // _rnnoise_process_frame
                this.rnnoiseState,
                this.outputPtr,
                this.inputPtr
            );

            // Read output and scale back
            const outputOffset = this.outputPtr >> 2;
            const processedSamples = new Float32Array(this.FRAME_SIZE);
            for (let i = 0; i < this.FRAME_SIZE; i++) {
                processedSamples[i] = this.heapF32[outputOffset + i] / 32767;
            }

            // Apply VAD gating
            if (vadProbability < this.vadThreshold) {
                for (let i = 0; i < this.FRAME_SIZE; i++) {
                    processedSamples[i] *= vadProbability;
                }
            }

            // Report VAD probability occasionally
            if (Math.random() < 0.05) {
                this.port.postMessage({ type: 'vad', probability: vadProbability });
            }

            return processedSamples;

        } catch (error) {
            return inputSamples;
        }
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }

        const inputChannel = input[0];
        const outputChannel = output[0];

        if (!this.isEnabled || !this.isInitialized) {
            for (let i = 0; i < inputChannel.length; i++) {
                outputChannel[i] = inputChannel[i];
            }
            return true;
        }

        // Buffer samples (Web Audio gives 128, RNNoise needs 480)
        for (let i = 0; i < inputChannel.length; i++) {
            this.inputBuffer[this.bufferIndex] = inputChannel[i];
            this.bufferIndex++;

            if (this.bufferIndex >= this.FRAME_SIZE) {
                this.outputBuffer = this.processRNNoise(this.inputBuffer);
                this.bufferIndex = 0;
            }
        }

        // Output from processed buffer
        const outputOffset = Math.max(0, this.bufferIndex - inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
            const bufferIdx = (outputOffset + i) % this.FRAME_SIZE;
            outputChannel[i] = this.outputBuffer[bufferIdx] || inputChannel[i];
        }

        return true;
    }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
