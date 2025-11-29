// Output storage utilities
const OutputStorage = {
    STORAGE_KEY: 'ascii_video_outputs',
    MAX_OUTPUTS: 20,

    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load outputs from storage:', e);
            return [];
        }
    },

    save(output) {
        try {
            const outputs = this.getAll();
            outputs.unshift(output);
            // Keep only the most recent MAX_OUTPUTS
            if (outputs.length > this.MAX_OUTPUTS) {
                outputs.splice(this.MAX_OUTPUTS);
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(outputs));
            return true;
        } catch (e) {
            console.error('Failed to save output to storage:', e);
            return false;
        }
    },

    delete(id) {
        try {
            const outputs = this.getAll();
            const filtered = outputs.filter(o => o.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            return true;
        } catch (e) {
            console.error('Failed to delete output from storage:', e);
            return false;
        }
    },

    getById(id) {
        const outputs = this.getAll();
        return outputs.find(o => o.id === id);
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
};

// Make it available globally
window.OutputStorage = OutputStorage;

document.addEventListener('DOMContentLoaded', () => {
    const progressDiv = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultMp4Div = document.getElementById('resultMp4');
    const resultTextDiv = document.getElementById('resultText');
    const outputVideo = document.getElementById('outputVideo');
    const downloadMp4Btn = document.getElementById('downloadMp4');
    const downloadTextBtn = document.getElementById('downloadText');
    const convertMp4Btn = document.getElementById('convertMp4Btn');
    const convertTextBtn = document.getElementById('convertTextBtn');
    const convertTextSquareBtn = document.getElementById('convertTextSquareBtn');
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    const previewDiv = document.getElementById('preview');
    const previewCanvas = document.getElementById('previewCanvas');
    const thresholdInput = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const contrastInput = document.getElementById('contrast');
    const contrastValue = document.getElementById('contrastValue');
    const exposureInput = document.getElementById('exposure');
    const exposureValue = document.getElementById('exposureValue');
    const videoInput = document.getElementById('video');
    const widthInput = document.getElementById('width');
    const charsInput = document.getElementById('chars');

    const frameSlider = document.getElementById('frameSlider');
    const frameValue = document.getElementById('frameValue');
    const frameTotalValue = document.getElementById('frameTotalValue');
    const skipStartFramesInput = document.getElementById('skipStartFrames');
    const skipEndFramesInput = document.getElementById('skipEndFrames');

    const outputHistoryDiv = document.getElementById('outputHistory');
    const outputListDiv = document.getElementById('outputList');

    const previewModeCharsBtn = document.getElementById('previewModeChars');
    const previewModeRoundBtn = document.getElementById('previewModeRound');

    let currentMp4Result = null;
    let currentTextResult = null;
    let previewVideo = null;
    let previewSourceCanvas = null;
    let previewFrameCanvases = [];
    let previewTotalFrames = 0;
    let currentVideoFileName = '';
    let previewRoundPixels = false;

    // Render output history
    function renderOutputHistory() {
        const outputs = OutputStorage.getAll();

        if (outputs.length === 0) {
            outputListDiv.innerHTML = '<p class="empty-state">No saved outputs yet. Convert a video and it will appear here.</p>';
            return;
        }

        outputListDiv.innerHTML = outputs.map(output => `
            <div class="output-item" data-id="${output.id}">
                <div class="output-item-info">
                    <span class="output-item-name">${output.name}</span>
                    <span class="output-item-meta">${output.type} | ${output.dimensions} | ${OutputStorage.formatSize(output.size)} | ${OutputStorage.formatDate(output.timestamp)}</span>
                </div>
                <div class="output-item-actions">
                    <button class="output-item-btn play-btn-action" data-id="${output.id}">Play</button>
                    <button class="output-item-btn download-btn-action" data-id="${output.id}">Download</button>
                    <button class="output-item-btn danger delete-btn-action" data-id="${output.id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        outputListDiv.querySelectorAll('.play-btn-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                window.location.href = `play.html?output=${id}`;
            });
        });

        outputListDiv.querySelectorAll('.download-btn-action').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const output = OutputStorage.getById(id);
                if (output && output.data) {
                    downloadOutputData(output);
                }
            });
        });

        outputListDiv.querySelectorAll('.delete-btn-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Delete this output?')) {
                    OutputStorage.delete(id);
                    renderOutputHistory();
                }
            });
        });
    }

    async function downloadOutputData(output) {
        try {
            // Data is stored as base64
            const binaryString = atob(output.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/gzip' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = output.filename || `${output.name}.jsonl.gz`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to download:', e);
            alert('Failed to download the file.');
        }
    }

    // Initialize output history
    renderOutputHistory();

    // Preview functionality
    videoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            previewDiv.classList.add('hidden');
            currentVideoFileName = '';
            return;
        }

        currentVideoFileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

        previewVideo = document.createElement('video');
        previewVideo.muted = true;
        previewVideo.playsInline = true;
        previewFrameCanvases = [];

        previewVideo.onloadedmetadata = async () => {
            const duration = previewVideo.duration;
            const numFrames = Math.min(100, Math.floor(duration * 10));
            const frameInterval = duration / numFrames;
            previewTotalFrames = numFrames;

            for (let i = 0; i < numFrames; i++) {
                await new Promise((resolve) => {
                    previewVideo.currentTime = i * frameInterval;
                    previewVideo.onseeked = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = previewVideo.videoWidth;
                        canvas.height = previewVideo.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(previewVideo, 0, 0);
                        previewFrameCanvases.push(canvas);
                        resolve();
                    };
                });
            }

            updateFrameSliderRange();
            previewDiv.classList.remove('hidden');
            updatePreview();
        };

        previewVideo.src = URL.createObjectURL(file);
    });

    function updateFrameSliderRange() {
        if (previewTotalFrames === 0) return;

        const skipStart = parseInt(skipStartFramesInput.value) || 0;
        const skipEnd = parseInt(skipEndFramesInput.value) || 0;
        const effectiveFrames = Math.max(0, previewTotalFrames - skipStart - skipEnd);

        frameSlider.min = 0;
        frameSlider.max = Math.max(0, effectiveFrames - 1);
        frameSlider.value = Math.min(parseInt(frameSlider.value) || 0, frameSlider.max);
        frameValue.textContent = frameSlider.value;
        frameTotalValue.textContent = Math.max(0, effectiveFrames - 1);

        const actualFrameIndex = skipStart + parseInt(frameSlider.value);
        if (previewFrameCanvases[actualFrameIndex]) {
            previewSourceCanvas = previewFrameCanvases[actualFrameIndex];
            updatePreview();
        }
    }

    frameSlider.addEventListener('input', () => {
        const skipStart = parseInt(skipStartFramesInput.value) || 0;
        const sliderValue = parseInt(frameSlider.value);
        const actualFrameIndex = skipStart + sliderValue;

        frameValue.textContent = sliderValue;
        if (previewFrameCanvases[actualFrameIndex]) {
            previewSourceCanvas = previewFrameCanvases[actualFrameIndex];
            updatePreview();
        }
    });

    skipStartFramesInput.addEventListener('input', updateFrameSliderRange);
    skipEndFramesInput.addEventListener('input', updateFrameSliderRange);

    function updatePreview() {
        if (!previewSourceCanvas) return;

        const width = parseInt(widthInput.value) || 300;
        const chars = charsInput.value || 'F$V* ';
        const threshold = parseInt(thresholdInput.value) || 160;
        const contrast = parseInt(contrastInput.value) || 100;
        const exposure = parseInt(exposureInput.value) ?? -100;

        const converter = new VideoToAsciiConverter({
            asciiChars: chars,
            noiseLevel: 0,
            whiteThreshold: threshold,
            contrast: contrast,
            exposure: exposure
        });

        converter.frameToAscii(previewSourceCanvas, previewCanvas, width, false, previewRoundPixels);
    }

    // Preview mode toggle
    previewModeCharsBtn.addEventListener('click', () => {
        previewRoundPixels = false;
        previewModeCharsBtn.classList.add('active');
        previewModeRoundBtn.classList.remove('active');
        updatePreview();
    });

    previewModeRoundBtn.addEventListener('click', () => {
        previewRoundPixels = true;
        previewModeRoundBtn.classList.add('active');
        previewModeCharsBtn.classList.remove('active');
        updatePreview();
    });

    thresholdInput.addEventListener('input', () => {
        thresholdValue.textContent = thresholdInput.value;
        updatePreview();
    });

    contrastInput.addEventListener('input', () => {
        contrastValue.textContent = contrastInput.value;
        updatePreview();
    });

    exposureInput.addEventListener('input', () => {
        exposureValue.textContent = exposureInput.value;
        updatePreview();
    });

    widthInput.addEventListener('input', updatePreview);
    charsInput.addEventListener('input', updatePreview);

    function getOptions() {
        const fpsInput = document.getElementById('fps');
        const noiseLevelInput = document.getElementById('noiseLevel');

        return {
            fps: parseInt(fpsInput.value) || 10,
            width: parseInt(widthInput.value) || 300,
            chars: charsInput.value || 'F$V* ',
            noiseLevel: (parseInt(noiseLevelInput.value) || 15) / 100,
            threshold: parseInt(thresholdInput.value) || 160,
            contrast: parseInt(contrastInput.value) || 100,
            exposure: parseInt(exposureInput.value) ?? -100,
            skipStartFrames: parseInt(skipStartFramesInput.value) || 0,
            skipEndFrames: parseInt(skipEndFramesInput.value) || 0
        };
    }

    function validateOptions(options) {
        if (!videoInput.files[0]) {
            alert('Please select a video file');
            return false;
        }
        if (options.fps < 1 || options.fps > 30) {
            alert('FPS must be between 1 and 30');
            return false;
        }
        if (options.width < 40 || options.width > 720) {
            alert('Width must be between 40 and 720');
            return false;
        }
        return true;
    }

    function showProgress() {
        progressDiv.classList.remove('hidden');
        resultMp4Div.classList.add('hidden');
        resultTextDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = 'Loading video...';
    }

    function createProgressHandler() {
        return (progress) => {
            progressBar.style.width = `${progress.percent}%`;
            switch (progress.stage) {
                case 'loading':
                    progressText.textContent = 'Loading video...';
                    break;
                case 'extracting':
                    progressText.textContent = `Extracting frames: ${progress.current}/${progress.total}`;
                    break;
                case 'converting':
                    progressText.textContent = `Converting to ASCII: ${progress.current}/${progress.total}`;
                    break;
                case 'encoding':
                    progressText.textContent = `Encoding MP4: ${progress.current || ''}/${progress.total || ''}`;
                    break;
                case 'complete':
                    progressText.textContent = 'Complete!';
                    break;
            }
        };
    }

    convertMp4Btn.addEventListener('click', async () => {
        const options = getOptions();
        if (!validateOptions(options)) return;

        convertMp4Btn.disabled = true;
        convertTextBtn.disabled = true;
        convertTextSquareBtn.disabled = true;
        showProgress();

        try {
            const converter = new VideoToAsciiConverter({
                asciiChars: options.chars,
                noiseLevel: options.noiseLevel,
                whiteThreshold: options.threshold,
                contrast: options.contrast,
                exposure: options.exposure,
                onProgress: createProgressHandler()
            });

            const result = await converter.convertToMp4(videoInput.files[0], {
                fps: options.fps,
                asciiWidth: options.width,
                skipStartFrames: options.skipStartFrames,
                skipEndFrames: options.skipEndFrames
            });

            currentMp4Result = result;

            progressDiv.classList.add('hidden');
            resultMp4Div.classList.remove('hidden');

            const videoUrl = URL.createObjectURL(result.blob);
            outputVideo.src = videoUrl;

            downloadMp4Btn.textContent = result.format === 'mp4' ? 'Download MP4' : 'Download WebM';

        } catch (err) {
            console.error('Conversion error:', err);
            progressDiv.classList.add('hidden');
            errorDiv.classList.remove('hidden');
            errorMessage.textContent = err.message || 'Unknown error occurred';
        } finally {
            convertMp4Btn.disabled = false;
            convertTextBtn.disabled = false;
            convertTextSquareBtn.disabled = false;
        }
    });

    async function convertToTextWithOptions(squarePixels = false) {
        const options = getOptions();
        if (!validateOptions(options)) return;

        convertTextBtn.disabled = true;
        convertTextSquareBtn.disabled = true;
        convertMp4Btn.disabled = true;
        showProgress();

        try {
            const converter = new VideoToAsciiConverter({
                asciiChars: options.chars,
                noiseLevel: options.noiseLevel,
                whiteThreshold: options.threshold,
                contrast: options.contrast,
                exposure: options.exposure,
                onProgress: createProgressHandler()
            });

            const result = await converter.convertToText(videoInput.files[0], {
                fps: options.fps,
                asciiWidth: options.width,
                skipStartFrames: options.skipStartFrames,
                skipEndFrames: options.skipEndFrames,
                squarePixels: squarePixels
            });

            currentTextResult = result;

            progressDiv.classList.add('hidden');

            // Auto download and save to storage
            await downloadTextFile(result, squarePixels);

        } catch (err) {
            console.error('Conversion error:', err);
            progressDiv.classList.add('hidden');
            errorDiv.classList.remove('hidden');
            errorMessage.textContent = err.message || 'Unknown error occurred';
        } finally {
            convertTextBtn.disabled = false;
            convertTextSquareBtn.disabled = false;
            convertMp4Btn.disabled = false;
        }
    }

    convertTextBtn.addEventListener('click', () => convertToTextWithOptions(false));
    convertTextSquareBtn.addEventListener('click', () => convertToTextWithOptions(true));

    downloadMp4Btn.addEventListener('click', () => {
        if (!currentMp4Result) return;

        const url = URL.createObjectURL(currentMp4Result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentMp4Result.format === 'mp4' ? 'ascii-video.mp4' : 'ascii-video.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    function rleEncodeFrame(frame) {
        const flat = frame.flat();
        const encoded = [];
        let i = 0;
        while (i < flat.length) {
            const pixel = flat[i];
            let count = 1;
            while (i + count < flat.length && JSON.stringify(flat[i + count]) === JSON.stringify(pixel)) {
                count++;
            }
            if (count > 1) {
                encoded.push([count, pixel]);
            } else {
                encoded.push(pixel);
            }
            i += count;
        }
        return encoded;
    }

    async function downloadTextFile(result, squarePixels = false) {
        const lines = [];

        lines.push(JSON.stringify({
            fps: result.fps,
            width: result.asciiWidth,
            height: result.asciiHeight,
            frameCount: result.textFrames.length,
            duration: result.duration,
            rle: true
        }));

        for (const frame of result.textFrames) {
            lines.push(JSON.stringify(rleEncodeFrame(frame)));
        }

        const jsonlString = lines.join('\n');

        // Compress using CompressionStream
        const blob = new Blob([jsonlString]);
        const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const baseName = currentVideoFileName || 'ascii-video';
        const typeSuffix = squarePixels ? '-round' : '';
        const filename = `${baseName}${typeSuffix}-${timestamp}.jsonl.gz`;

        // Save to storage (use chunked base64 encoding to avoid stack overflow)
        const arrayBuffer = await compressedBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);

        const outputEntry = {
            id: OutputStorage.generateId(),
            name: `${baseName}${typeSuffix}`,
            filename: filename,
            type: squarePixels ? 'Round Pixels' : 'Text',
            dimensions: `${result.asciiWidth}x${result.asciiHeight}`,
            fps: result.fps,
            frameCount: result.textFrames.length,
            duration: result.duration,
            size: compressedBlob.size,
            timestamp: Date.now(),
            data: base64
        };

        OutputStorage.save(outputEntry);
        renderOutputHistory();

        // Download the file
        const url = URL.createObjectURL(compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadTextBtn.addEventListener('click', () => {
        if (!currentTextResult) return;
        downloadTextFile(currentTextResult);
    });
});
