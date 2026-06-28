(function() {
    var NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    var NOTE_TO_PC = {
        C: 0,
        'C#': 1,
        Db: 1,
        D: 2,
        'D#': 3,
        Eb: 3,
        E: 4,
        F: 5,
        'F#': 6,
        Gb: 6,
        G: 7,
        'G#': 8,
        Ab: 8,
        A: 9,
        'A#': 10,
        Bb: 10,
        B: 11
    };

    var SCALES = [
        {
            name: 'C major',
            chords: [
                chord('C', 'major', 'I'),
                chord('Dm', 'minor', 'ii'),
                chord('Em', 'minor', 'iii'),
                chord('F', 'major', 'IV'),
                chord('G', 'major', 'V'),
                chord('Am', 'minor', 'vi')
            ]
        },
        {
            name: 'A minor',
            chords: [
                chord('Am', 'minor', 'i'),
                chord('C', 'major', 'III'),
                chord('Dm', 'minor', 'iv'),
                chord('Em', 'minor', 'v'),
                chord('F', 'major', 'VI'),
                chord('G', 'major', 'VII')
            ]
        },
        {
            name: 'G major',
            chords: [
                chord('G', 'major', 'I'),
                chord('Am', 'minor', 'ii'),
                chord('Bm', 'minor', 'iii'),
                chord('C', 'major', 'IV'),
                chord('D', 'major', 'V'),
                chord('Em', 'minor', 'vi')
            ]
        },
        {
            name: 'E minor',
            chords: [
                chord('Em', 'minor', 'i'),
                chord('G', 'major', 'III'),
                chord('Am', 'minor', 'iv'),
                chord('Bm', 'minor', 'v'),
                chord('C', 'major', 'VI'),
                chord('D', 'major', 'VII')
            ]
        },
        {
            name: 'F major',
            chords: [
                chord('F', 'major', 'I'),
                chord('Gm', 'minor', 'ii'),
                chord('Am', 'minor', 'iii'),
                chord('Bb', 'major', 'IV'),
                chord('C', 'major', 'V'),
                chord('Dm', 'minor', 'vi')
            ]
        },
        {
            name: 'D minor',
            chords: [
                chord('Dm', 'minor', 'i'),
                chord('F', 'major', 'III'),
                chord('Gm', 'minor', 'iv'),
                chord('Am', 'minor', 'v'),
                chord('Bb', 'major', 'VI'),
                chord('C', 'major', 'VII')
            ]
        }
    ];

    var DETECTABLE_CHORDS = buildDetectableChords();
    var DEFAULT_MIN_CONFIDENCE = 0.70;
    var MIN_SIGNAL = 0.0018;
    var REQUIRED_STABLE_FRAMES = 9;
    var WRONG_STABLE_FRAMES = 16;
    var MIN_SECONDS_BETWEEN_ATTEMPTS = 0.9;
    var NEXT_CHORD_DELAY_MS = 1500;

    var startButton = document.getElementById('start-button');
    var pauseButton = document.getElementById('pause-button');
    var stopButton = document.getElementById('stop-button');
    var roundCountInput = document.getElementById('round-count');
    var confidenceThresholdInput = document.getElementById('confidence-threshold');
    var thresholdValueText = document.getElementById('threshold-value');
    var statusText = document.getElementById('status');
    var timerText = document.getElementById('timer');
    var scaleNameText = document.getElementById('scale-name');
    var roundProgressText = document.getElementById('round-progress');
    var attemptCountText = document.getElementById('attempt-count');
    var targetChordText = document.getElementById('target-chord');
    var targetFunctionText = document.getElementById('target-function');
    var detectedChordText = document.getElementById('detected-chord');
    var confidenceMeter = document.getElementById('confidence-meter');
    var confidenceText = document.getElementById('confidence-text');
    var feedback = document.getElementById('feedback');
    var transitionIndicator = document.getElementById('transition-indicator');
    var historyBody = document.getElementById('history-body');
    var resultsSection = document.getElementById('results');
    var resultTimeText = document.getElementById('result-time');
    var resultScaleText = document.getElementById('result-scale');
    var resultRoundsText = document.getElementById('result-rounds');
    var resultAttemptsText = document.getElementById('result-attempts');

    var state = {
        audioContext: null,
        analyser: null,
        stream: null,
        animationId: null,
        timerId: null,
        startedAt: 0,
        elapsedBeforePause: 0,
        mode: 'idle',
        scale: null,
        target: null,
        targetStartedAt: 0,
        roundGoal: 10,
        minConfidence: DEFAULT_MIN_CONFIDENCE,
        attemptsForTarget: 0,
        totalAttempts: 0,
        completed: [],
        lastStableName: null,
        stableFrames: 0,
        lastAttemptAt: 0,
        transitionTimerId: null,
        awaitingNext: false,
        acceptingAnswer: false
    };

    startButton.addEventListener('click', start);
    pauseButton.addEventListener('click', togglePause);
    stopButton.addEventListener('click', stop);
    confidenceThresholdInput.addEventListener('input', updateThresholdDisplay);
    updateThresholdDisplay();

    async function start() {
        if (state.mode === 'running') return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            statusText.textContent = 'Microphone access needs localhost, HTTPS, and a supported browser.';
            return;
        }

        try {
            resetSession();
            setControls('starting');
            statusText.textContent = 'Requesting microphone access...';
            await setupAudio();

            state.mode = 'running';
            state.startedAt = Date.now();
            state.acceptingAnswer = true;
            setControls('running');
            statusText.textContent = 'Listening. Play the shown chord in the selected scale.';
            resultsSection.hidden = true;
            renderHistory();
            nextChord();
            updateTimer();
            state.timerId = setInterval(updateTimer, 100);
            detectLoop();
        } catch (error) {
            statusText.textContent = 'Microphone unavailable: ' + error.message;
            setControls('idle');
            cleanupAudio();
        }
    }

    function resetSession() {
        state.roundGoal = clamp(parseInt(roundCountInput.value, 10) || 10, 1, 100);
        state.minConfidence = clamp(parseFloat(confidenceThresholdInput.value) || DEFAULT_MIN_CONFIDENCE, 0.45, 0.85);
        roundCountInput.value = String(state.roundGoal);
        confidenceThresholdInput.value = state.minConfidence.toFixed(2);
        updateThresholdDisplay();
        state.scale = SCALES[Math.floor(Math.random() * SCALES.length)];
        state.target = null;
        state.targetStartedAt = 0;
        state.elapsedBeforePause = 0;
        state.attemptsForTarget = 0;
        state.totalAttempts = 0;
        state.completed = [];
        state.lastStableName = null;
        state.stableFrames = 0;
        state.lastAttemptAt = 0;
        clearTransitionTimer();
        state.awaitingNext = false;
        state.acceptingAnswer = false;
        timerText.textContent = '0.0s';
        scaleNameText.textContent = state.scale.name;
        roundProgressText.textContent = '0 / ' + state.roundGoal;
        attemptCountText.textContent = '0';
        targetChordText.textContent = '-';
        targetFunctionText.textContent = '-';
        detectedChordText.textContent = 'Listening stopped';
        confidenceMeter.value = 0;
        confidenceText.textContent = 'Dormant until the guitar is loud enough';
        feedback.textContent = '';
        feedback.className = '';
        transitionIndicator.hidden = true;
    }

    async function setupAudio() {
        state.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        var source = state.audioContext.createMediaStreamSource(state.stream);
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 8192;
        state.analyser.smoothingTimeConstant = 0.72;
        source.connect(state.analyser);
    }

    function togglePause() {
        if (state.mode === 'running') {
            pause();
        } else if (state.mode === 'paused') {
            resume();
        }
    }

    function pause() {
        state.elapsedBeforePause = getElapsedSeconds();
        state.mode = 'paused';
        state.acceptingAnswer = false;
        state.lastStableName = null;
        state.stableFrames = 0;
        clearInterval(state.timerId);
        clearTransitionTimer();
        transitionIndicator.hidden = true;
        if (state.animationId) cancelAnimationFrame(state.animationId);
        if (state.audioContext && state.audioContext.state === 'running') {
            state.audioContext.suspend();
        }
        pauseButton.textContent = 'Resume';
        statusText.textContent = 'Paused.';
        detectedChordText.textContent = 'Paused';
    }

    async function resume() {
        if (state.audioContext && state.audioContext.state === 'suspended') {
            await state.audioContext.resume();
        }
        state.mode = 'running';
        state.startedAt = Date.now();
        pauseButton.textContent = 'Pause';
        statusText.textContent = 'Listening. Play the shown chord in the selected scale.';
        state.timerId = setInterval(updateTimer, 100);
        if (state.awaitingNext) {
            beginNextChordTransition();
        } else {
            state.acceptingAnswer = true;
            transitionIndicator.hidden = true;
        }
        detectLoop();
    }

    function stop() {
        state.mode = 'idle';
        state.awaitingNext = false;
        state.acceptingAnswer = false;
        setControls('idle');
        targetChordText.textContent = '-';
        targetFunctionText.textContent = '-';
        detectedChordText.textContent = 'Listening stopped';
        confidenceMeter.value = 0;
        confidenceText.textContent = 'Dormant until the guitar is loud enough';
        feedback.textContent = '';
        feedback.className = '';
        transitionIndicator.hidden = true;
        statusText.textContent = 'Stopped. Press Start to begin again.';
        clearInterval(state.timerId);
        clearTransitionTimer();
        cleanupAudio();
    }

    function finishGame() {
        var elapsed = getElapsedSeconds();
        state.mode = 'finished';
        state.elapsedBeforePause = elapsed;
        state.awaitingNext = false;
        state.acceptingAnswer = false;
        clearInterval(state.timerId);
        clearTransitionTimer();
        transitionIndicator.hidden = true;
        cleanupAudio();
        setControls('idle');
        statusText.textContent = 'Game over. Press Start for a new scale.';
        detectedChordText.textContent = 'Listening stopped';
        resultTimeText.textContent = elapsed.toFixed(1) + 's';
        resultScaleText.textContent = state.scale.name;
        resultRoundsText.textContent = state.completed.length + ' / ' + state.roundGoal;
        resultAttemptsText.textContent = String(state.totalAttempts);
        resultsSection.hidden = false;
    }

    function cleanupAudio() {
        if (state.animationId) {
            cancelAnimationFrame(state.animationId);
            state.animationId = null;
        }
        if (state.stream) {
            state.stream.getTracks().forEach(function(track) {
                track.stop();
            });
            state.stream = null;
        }
        if (state.audioContext) {
            state.audioContext.close();
            state.audioContext = null;
        }
        state.analyser = null;
    }

    function updateTimer() {
        if (state.mode !== 'running') return;
        timerText.textContent = getElapsedSeconds().toFixed(1) + 's';
    }

    function getElapsedSeconds() {
        if (state.mode === 'running') {
            return state.elapsedBeforePause + ((Date.now() - state.startedAt) / 1000);
        }
        return state.elapsedBeforePause;
    }

    function nextChord() {
        if (state.mode !== 'running') return;

        if (state.completed.length >= state.roundGoal) {
            finishGame();
            return;
        }

        var next = state.scale.chords[Math.floor(Math.random() * state.scale.chords.length)];
        while (state.target && next.name === state.target.name && state.scale.chords.length > 1) {
            next = state.scale.chords[Math.floor(Math.random() * state.scale.chords.length)];
        }

        state.target = next;
        state.targetStartedAt = getElapsedSeconds();
        state.attemptsForTarget = 0;
        state.lastStableName = null;
        state.stableFrames = 0;
        transitionIndicator.hidden = true;
        state.awaitingNext = false;
        state.acceptingAnswer = true;
        roundProgressText.textContent = (state.completed.length + 1) + ' / ' + state.roundGoal;
        attemptCountText.textContent = String(state.totalAttempts);
        targetChordText.classList.add('next');
        setTimeout(function() {
            if (state.mode !== 'running') return;
            targetChordText.textContent = next.name;
            targetFunctionText.textContent = functionLabel(next.func);
            targetChordText.classList.remove('next');
            feedback.textContent = '';
            feedback.className = '';
        }, 120);
    }

    function detectLoop() {
        if (state.mode !== 'running' || !state.analyser) return;
        if (state.awaitingNext) {
            state.animationId = requestAnimationFrame(detectLoop);
            return;
        }

        var detection = detectChord();
        if (!detection || detection.signal < MIN_SIGNAL) {
            setDormantDetector();
        } else if (detection.confidence >= state.minConfidence) {
            detectedChordText.textContent = detection.chord.name;
            confidenceMeter.value = smoothMeter(detection.confidence);
            confidenceText.textContent = 'Confidence: ' + Math.round(confidenceMeter.value * 100) + '%';
            processDetection(detection.chord.name);
        } else {
            detectedChordText.textContent = 'No clear chord';
            confidenceMeter.value = smoothMeter(detection.confidence);
            confidenceText.textContent = 'Confidence: ' + Math.round(confidenceMeter.value * 100) + '%';
            state.lastStableName = null;
            state.stableFrames = 0;
        }

        state.animationId = requestAnimationFrame(detectLoop);
    }

    function setDormantDetector() {
        detectedChordText.textContent = 'Dormant';
        confidenceMeter.value = smoothMeter(0);
        confidenceText.textContent = 'Dormant until the guitar is loud enough';
        state.lastStableName = null;
        state.stableFrames = 0;
    }

    function smoothMeter(nextValue) {
        var current = Number(confidenceMeter.value) || 0;
        return current * 0.8 + nextValue * 0.2;
    }

    function processDetection(chordName) {
        if (!state.acceptingAnswer) return;

        if (state.lastStableName === chordName) {
            state.stableFrames += 1;
        } else {
            state.lastStableName = chordName;
            state.stableFrames = 1;
        }

        var threshold = chordName === state.target.name ? REQUIRED_STABLE_FRAMES : WRONG_STABLE_FRAMES;
        var secondsSinceAttempt = (Date.now() - state.lastAttemptAt) / 1000;
        if (state.stableFrames < threshold || secondsSinceAttempt < MIN_SECONDS_BETWEEN_ATTEMPTS) {
            return;
        }

        state.lastAttemptAt = Date.now();
        state.totalAttempts += 1;
        state.attemptsForTarget += 1;
        attemptCountText.textContent = String(state.totalAttempts);

        if (chordName === state.target.name) {
            handleCorrectChord();
        } else {
            feedback.textContent = 'Detected ' + chordName + '. Try ' + state.target.name + ' again.';
            feedback.className = 'incorrect';
            state.stableFrames = 0;
        }
    }

    function handleCorrectChord() {
        state.acceptingAnswer = false;
        feedback.textContent = 'Correct: ' + state.target.name;
        feedback.className = 'correct';
        state.completed.push({
            scale: state.scale.name,
            func: state.target.func,
            chord: state.target.name,
            attempts: state.attemptsForTarget,
            elapsed: Math.max(0, getElapsedSeconds() - state.targetStartedAt).toFixed(1) + 's'
        });
        roundProgressText.textContent = state.completed.length + ' / ' + state.roundGoal;
        renderHistory();
        beginNextChordTransition();
    }

    function beginNextChordTransition() {
        clearTransitionTimer();
        state.awaitingNext = true;
        state.acceptingAnswer = false;
        state.lastStableName = null;
        state.stableFrames = 0;
        detectedChordText.textContent = 'Waiting';
        confidenceMeter.value = 0;
        confidenceText.textContent = 'Mute strings before the next chord';
        transitionIndicator.hidden = false;
        state.transitionTimerId = setTimeout(function() {
            state.transitionTimerId = null;
            if (state.mode !== 'running') return;
            state.awaitingNext = false;
            transitionIndicator.hidden = true;
            nextChord();
        }, NEXT_CHORD_DELAY_MS);
    }

    function clearTransitionTimer() {
        if (state.transitionTimerId) {
            clearTimeout(state.transitionTimerId);
            state.transitionTimerId = null;
        }
    }

    function detectChord() {
        var binCount = state.analyser.frequencyBinCount;
        var data = new Float32Array(binCount);
        state.analyser.getFloatFrequencyData(data);

        var chroma = new Array(12).fill(0);
        var sampleRate = state.audioContext.sampleRate;
        var nyquist = sampleRate / 2;
        var signal = 0;

        for (var i = 0; i < binCount; i++) {
            var frequency = i * nyquist / binCount;
            if (frequency < 70 || frequency > 1400) continue;

            var db = data[i];
            if (db < -82) continue;

            var energy = Math.pow(10, db / 20);
            var midi = Math.round(69 + 12 * Math.log2(frequency / 440));
            var pc = ((midi % 12) + 12) % 12;
            chroma[pc] += energy;
            signal += energy;
        }

        if (signal <= 0) return null;

        chroma = chroma.map(function(value) {
            return value / signal;
        });

        var best = null;
        DETECTABLE_CHORDS.forEach(function(chordDef) {
            var chordEnergy = chordDef.pcs.reduce(function(sum, pc) {
                return sum + chroma[pc];
            }, 0);
            var rootEnergy = chroma[chordDef.rootPc] || 0;
            var thirdPc = chordDef.quality === 'major' ? (chordDef.rootPc + 4) % 12 : (chordDef.rootPc + 3) % 12;
            var thirdEnergy = chroma[thirdPc] || 0;
            var fifthEnergy = chroma[(chordDef.rootPc + 7) % 12] || 0;
            var offChordEnergy = Math.max(0, 1 - chordEnergy);
            var confidence = chordEnergy + Math.min(rootEnergy, thirdEnergy, fifthEnergy) * 0.9 - offChordEnergy * 0.35;

            if (!best || confidence > best.confidence) {
                best = {
                    chord: chordDef,
                    confidence: Math.max(0, Math.min(1, confidence)),
                    signal: signal
                };
            }
        });

        return best;
    }

    function renderHistory() {
        historyBody.innerHTML = '';

        if (state.completed.length === 0) {
            var emptyRow = document.createElement('tr');
            var emptyCell = document.createElement('td');
            emptyCell.colSpan = 6;
            emptyCell.textContent = 'No completed chords yet.';
            emptyRow.appendChild(emptyCell);
            historyBody.appendChild(emptyRow);
            return;
        }

        state.completed.forEach(function(item, index) {
            var row = document.createElement('tr');
            [index + 1, item.scale, functionLabel(item.func), item.chord, item.attempts, item.elapsed].forEach(function(value) {
                var cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });
            historyBody.appendChild(row);
        });
    }


    function functionLabel(func) {
        if (func === 'I' || func === 'i') {
            return 'root (' + func + ') chord';
        }
        return func + ' chord';
    }

    function setControls(mode) {
        startButton.disabled = mode === 'running' || mode === 'starting';
        pauseButton.disabled = mode !== 'running';
        stopButton.disabled = mode === 'idle' || mode === 'starting';
        roundCountInput.disabled = mode === 'running' || mode === 'starting';
        confidenceThresholdInput.disabled = mode === 'starting';
        pauseButton.textContent = 'Pause';
    }

    function updateThresholdDisplay() {
        var value = clamp(parseFloat(confidenceThresholdInput.value) || DEFAULT_MIN_CONFIDENCE, 0.45, 0.85);
        state.minConfidence = value;
        thresholdValueText.textContent = Math.round(value * 100) + '%';
    }

    function buildDetectableChords() {
        var byName = {};
        NOTE_NAMES.forEach(function(root, rootPc) {
            byName[root] = {
                name: root,
                rootPc: rootPc,
                quality: 'major',
                pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]
            };
            byName[root + 'm'] = {
                name: root + 'm',
                rootPc: rootPc,
                quality: 'minor',
                pcs: [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12]
            };
        });
        byName.Bb = chord('Bb', 'major', '');
        byName.Bbm = chord('Bbm', 'minor', '');
        return Object.keys(byName).map(function(name) {
            return byName[name];
        });
    }

    function chord(name, quality, func) {
        var rootName = name.replace('m', '');
        var rootPc = NOTE_TO_PC[rootName];
        return {
            name: name,
            rootPc: rootPc,
            quality: quality,
            func: func,
            pcs: quality === 'major'
                ? [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]
                : [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12]
        };
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
})();
