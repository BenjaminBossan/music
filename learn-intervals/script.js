// The synth code is taken from:
// https://github.com/keithwhor/audiosynth
// d6eb4b0fa567ee276bfc6bda682dcba4dae7afe1
var Synth, AudioSynth, AudioSynthInstrument;
!function(){

    var URL = window.URL || window.webkitURL;
    var Blob = window.Blob;

    if(!URL || !Blob) {
        throw new Error('This browser does not support AudioSynth');
    }

    var _encapsulated = false;
    var AudioSynthInstance = null;
    var pack = function(c,arg){ return [new Uint8Array([arg, arg >> 8]), new Uint8Array([arg, arg >> 8, arg >> 16, arg >> 24])][c]; };
    var setPrivateVar = function(n,v,w,e){Object.defineProperty(this,n,{value:v,writable:!!w,enumerable:!!e});};
    var setPublicVar = function(n,v,w){setPrivateVar.call(this,n,v,w,true);};
    AudioSynthInstrument = function AudioSynthInstrument(){this.__init__.apply(this,arguments);};
    var setPriv = setPrivateVar.bind(AudioSynthInstrument.prototype);
    var setPub = setPublicVar.bind(AudioSynthInstrument.prototype);
    setPriv('__init__', function(a,b,c) {
        if(!_encapsulated) { throw new Error('AudioSynthInstrument can only be instantiated from the createInstrument method of the AudioSynth object.'); }
        setPrivateVar.call(this, '_parent', a);
        setPublicVar.call(this, 'name', b);
        setPrivateVar.call(this, '_soundID', c);
    });
    setPub('play', function(note, octave, duration) {
        return this._parent.play(this._soundID, note, octave, duration);
    });
    setPub('generate', function(note, octave, duration) {
        return this._parent.generate(this._soundID, note, octave, duration);
    });
    AudioSynth = function AudioSynth(){if(AudioSynthInstance instanceof AudioSynth){return AudioSynthInstance;}else{ this.__init__(); return this; }};
    setPriv = setPrivateVar.bind(AudioSynth.prototype);
    setPub = setPublicVar.bind(AudioSynth.prototype);
    setPriv('_debug',false,true);
    setPriv('_bitsPerSample',16);
    setPriv('_channels',1);
    setPriv('_sampleRate',44100,true);
    setPub('setSampleRate', function(v) {
        this._sampleRate = Math.max(Math.min(v|0,44100), 4000);
        this._clearCache();
        return this._sampleRate;
    });
    setPub('getSampleRate', function() { return this._sampleRate; });
    setPriv('_volume',32768,true);
    setPub('setVolume', function(v) {
        v = parseFloat(v); if(isNaN(v)) { v = 0; }
        v = Math.round(v*32768);
        this._volume = Math.max(Math.min(v|0,32768), 0);
        this._clearCache();
        return this._volume;
    });
    setPub('getVolume', function() { return Math.round(this._volume/32768*10000)/10000; });
    setPriv('_notes',{'C':261.63,'C#':277.18,'D':293.66,'D#':311.13,'E':329.63,'F':349.23,'F#':369.99,'G':392.00,'G#':415.30,'A':440.00,'A#':466.16,'B':493.88});
    setPriv('_fileCache',[],true);
    setPriv('_temp',{},true);
    setPriv('_sounds',[],true);
    setPriv('_mod',[function(i,s,f,x){return Math.sin((2 * Math.PI)*(i/s)*f+x);}]);
    setPriv('_resizeCache', function() {
        var f = this._fileCache;
        var l = this._sounds.length;
        while(f.length<l) {
            var octaveList = [];
            for(var i = 0; i < 8; i++) {
                var noteList = {};
                for(var k in this._notes) {
                    noteList[k] = {};
                }
                octaveList.push(noteList);
            }
            f.push(octaveList);
        }
    });
    setPriv('_clearCache', function() {
        this._fileCache = [];
        this._resizeCache();
    });
    setPub('generate', function(sound, note, octave, duration) {
        var thisSound = this._sounds[sound];
        if(!thisSound) {
            for(var i=0;i<this._sounds.length;i++) {
                if(this._sounds[i].name==sound) {
                    thisSound = this._sounds[i];
                    sound = i;
                    break;
                }
            }
        }
        if(!thisSound) { throw new Error('Invalid sound or sound ID: ' + sound); }
        var t = (new Date).valueOf();
        this._temp = {};
        octave |= 0;
        octave = Math.min(8, Math.max(1, octave));
        var time = !duration?2:parseFloat(duration);
        if(typeof(this._notes[note])=='undefined') { throw new Error(note + ' is not a valid note.'); }
        if(typeof(this._fileCache[sound][octave-1][note][time])!='undefined') {
            if(this._debug) { console.log((new Date).valueOf() - t, 'ms to retrieve (cached)'); }
            return this._fileCache[sound][octave-1][note][time];
        } else {
            var frequency = this._notes[note] * Math.pow(2,octave-4);
            var sampleRate = this._sampleRate;
            var volume = this._volume;
            var channels = this._channels;
            var bitsPerSample = this._bitsPerSample;
            var attack = thisSound.attack(sampleRate, frequency, volume);
            var dampen = thisSound.dampen(sampleRate, frequency, volume);
            var waveFunc = thisSound.wave;
            var waveBind = {modulate: this._mod, vars: this._temp};
            var val = 0;
            var curVol = 0;

            var data = new Uint8Array(new ArrayBuffer(Math.ceil(sampleRate * time * 2)));
            var attackLen = (sampleRate * attack) | 0;
            var decayLen = (sampleRate * time) | 0;

            for (var i = 0 | 0; i !== attackLen; i++) {

                val = volume * (i/(sampleRate*attack)) * waveFunc.call(waveBind, i, sampleRate, frequency, volume);

                data[i << 1] = val;
                data[(i << 1) + 1] = val >> 8;

            }

            for (; i !== decayLen; i++) {

                val = volume * Math.pow((1-((i-(sampleRate*attack))/(sampleRate*(time-attack)))),dampen) * waveFunc.call(waveBind, i, sampleRate, frequency, volume);

                data[i << 1] = val;
                data[(i << 1) + 1] = val >> 8;

            }

            var out = [
                'RIFF',
                pack(1, 4 + (8 + 24/* chunk 1 length */) + (8 + 8/* chunk 2 length */)), // Length
                'WAVE',
                // chunk 1
                'fmt ', // Sub-chunk identifier
                pack(1, 16), // Chunk length
                pack(0, 1), // Audio format (1 is linear quantization)
                pack(0, channels),
                pack(1, sampleRate),
                pack(1, sampleRate * channels * bitsPerSample / 8), // Byte rate
                pack(0, channels * bitsPerSample / 8),
                pack(0, bitsPerSample),
                // chunk 2
                'data', // Sub-chunk identifier
                pack(1, data.length * channels * bitsPerSample / 8), // Chunk length
                data
            ];
            var blob = new Blob(out, {type: 'audio/wav'});
            var dataURI = URL.createObjectURL(blob);
            this._fileCache[sound][octave-1][note][time] = dataURI;
            if(this._debug) { console.log((new Date).valueOf() - t, 'ms to generate'); }
            return dataURI;
        }
    });
    setPub('play', function(sound, note, octave, duration) {
        var src = this.generate(sound, note, octave, duration);
        var audio = new Audio(src);
        audio.play();
        return true;
    });
    setPub('debug', function() { this._debug = true; });
    setPub('createInstrument', function(sound) {
        var n = 0;
        var found = false;
        if(typeof(sound)=='string') {
            for(var i=0;i<this._sounds.length;i++) {
                if(this._sounds[i].name==sound) {
                    found = true;
                    n = i;
                    break;
                }
            }
        } else {
            if(this._sounds[sound]) {
                n = sound;
                sound = this._sounds[n].name;
                found = true;
            }
        }
        if(!found) { throw new Error('Invalid sound or sound ID: ' + sound); }
        _encapsulated = true;
        var ins = new AudioSynthInstrument(this, sound, n);
        _encapsulated = false;
        return ins;
    });
    setPub('listSounds', function() {
        var r = [];
        for(var i=0;i<this._sounds.length;i++) {
            r.push(this._sounds[i].name);
        }
        return r;
    });
    setPriv('__init__', function(){
        this._resizeCache();
    });
    setPub('loadSoundProfile', function() {
        for(var i=0,len=arguments.length;i<len;i++) {
            o = arguments[i];
            if(!(o instanceof Object)) { throw new Error('Invalid sound profile.'); }
            this._sounds.push(o);
        }
        this._resizeCache();
        return true;
    });
    setPub('loadModulationFunction', function() {
        for(var i=0,len=arguments.length;i<len;i++) {
            f = arguments[i];
            if(typeof(f)!='function') { throw new Error('Invalid modulation function.'); }
            this._mod.push(f);
        }
        return true;
    });
    AudioSynthInstance = new AudioSynth();
    Synth = AudioSynthInstance;
}();
// end synth code

Synth.loadModulationFunction(
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(2 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(4 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(8 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(0.5 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 1 * Math.sin(0.25 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(2 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(4 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(8 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(0.5 * Math.PI * ((i / sampleRate) * frequency) + x); },
    function(i, sampleRate, frequency, x) { return 0.5 * Math.sin(0.25 * Math.PI * ((i / sampleRate) * frequency) + x); }
);

Synth.loadSoundProfile({
    name: 'piano',
    attack: function() { return 0.002; },
    dampen: function(sampleRate, frequency, volume) {
        return Math.pow(0.5*Math.log((frequency*volume)/sampleRate),2);
    },
    wave: function(i, sampleRate, frequency, volume) {
        var base = this.modulate[0];
        return this.modulate[1](
            i,
            sampleRate,
            frequency,
            Math.pow(base(i, sampleRate, frequency, 0), 2) +
                (0.75 * base(i, sampleRate, frequency, 0.25)) +
                (0.1 * base(i, sampleRate, frequency, 0.5))
        );
    }
});

// Main JavaScript code
(function() {
    var startButton = document.getElementById('start-button');
    var stopButton = document.getElementById('stop-button');
    var restartButton = document.getElementById('restart-button');
    var replayButton = document.getElementById('replay-button');
    var difficultyRadios = document.getElementsByName('difficulty');
    var roundsInput = document.getElementById('rounds');
    var noteDurationInput = document.getElementById('note-duration');
    var intervalOptionsDiv = document.getElementById('interval-options');
    var timerSpan = document.getElementById('timer');
    var gameDiv = document.getElementById('game');
    var resultsDiv = document.getElementById('results');
    var totalTimeSpan = document.getElementById('total-time');
    var roundSummaryBody = document.getElementById('round-summary');
    var finalRoundSummaryBody = document.getElementById('final-round-summary');
    var feedbackDiv = document.getElementById('feedback');
    var roundsProgress = document.getElementById('rounds-progress');
    var correctAnswersSpan = document.getElementById('correct-answers');
    var totalRoundsSpan = document.getElementById('total-rounds');

    var gameData = {
        correctAnswers: 0,
        totalCorrectNeeded: 10,
        difficulty: 'easy',
        intervals: [],
        startTime: null,
        timerInterval: null,
        roundHistory: [],
        currentNotes: [],
        instrument: Synth.createInstrument('piano'),
        isGameRunning: false // Flag to check if a game is running
    };

    var noteFrequencies = {
        'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63,
        'F': 349.23, 'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00,
        'A#': 466.16, 'B': 493.88
    };

    var allNotes = ['E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
                    'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3',
                    'G#3', 'A3', 'A#3', 'B3', 'C4', 'C#4', 'D4', 'D#4',
                    'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4'];

    var easyIntervals = {
        'Minor Third': 3,
        'Major Third': 4,
        'Perfect Fifth': 7,
        'Octave': 12
    };

    var mediumIntervals = {
        'Minor Second': 1,
        'Major Second': 2,
        'Minor Third': 3,
        'Major Third': 4,
        'Perfect Fourth': 5,
        'Tritone': 6,
        'Perfect Fifth': 7,
        'Minor Sixth': 8,
        'Major Sixth': 9,
        'Minor Seventh': 10,
        'Major Seventh': 11,
        'Octave': 12
    };

    var hardIntervals = mediumIntervals;

    function startGame() {
        gameData.totalCorrectNeeded = parseInt(roundsInput.value) || 10;
        gameData.difficulty = getSelectedDifficulty();
        gameData.correctAnswers = 0;
        gameData.attempts = 0;
        gameData.roundHistory = [];
        gameData.startTime = Date.now();
        gameData.isGameRunning = true;

        gameDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        intervalOptionsDiv.innerHTML = '';
        feedbackDiv.innerHTML = '';
        roundSummaryBody.innerHTML = '';

        timerSpan.textContent = '0.00';
        clearInterval(gameData.timerInterval);
        gameData.timerInterval = setInterval(updateTimer, 100);

        correctAnswersSpan.textContent = gameData.correctAnswers;
        totalRoundsSpan.textContent = gameData.totalCorrectNeeded;

        generateIntervalOptions();
        nextRound();
    }

    function stopGame() {
        clearInterval(gameData.timerInterval);
        gameData.isGameRunning = false;
        gameDiv.style.display = 'none';
        resultsDiv.style.display = 'none';
    }

    function restartGame() {
        stopGame();
        startGame();
    }

    function updateTimer() {
        var elapsed = (Date.now() - gameData.startTime) / 1000;
        timerSpan.textContent = elapsed.toFixed(2);
    }

    function generateIntervalOptions() {
        var intervals;
        if (gameData.difficulty === 'easy') {
            intervals = easyIntervals;
        } else if (gameData.difficulty === 'medium') {
            intervals = mediumIntervals;
        } else {
            intervals = hardIntervals;
        }
        gameData.intervals = intervals;

        intervalOptionsDiv.innerHTML = '';

        for (var intervalName in intervals) {
            var button = document.createElement('button');
            button.textContent = intervalName;
            button.dataset.interval = intervals[intervalName];
            button.addEventListener('click', handleIntervalGuess);
            intervalOptionsDiv.appendChild(button);
        }
    }

    function nextRound() {
        feedbackDiv.innerHTML = '';

        var intervals = gameData.intervals;
        var intervalNames = Object.keys(intervals);
        var randomIntervalName = intervalNames[Math.floor(Math.random() * intervalNames.length)];
        var semitoneDistance = intervals[randomIntervalName];

        var startNoteIndex = Math.floor(Math.random() * allNotes.length);
        var startNote = allNotes[startNoteIndex];

        var endNoteIndex;

        if (gameData.difficulty === 'easy' || gameData.difficulty === 'medium') {
            endNoteIndex = startNoteIndex + semitoneDistance;
        } else {
            if (Math.random() < 0.5) {
                endNoteIndex = startNoteIndex + semitoneDistance;
            } else {
                endNoteIndex = startNoteIndex - semitoneDistance;
            }
        }

        if (endNoteIndex < 0 || endNoteIndex >= allNotes.length) {
            nextRound();
            return;
        }

        var endNote = allNotes[endNoteIndex];

        gameData.currentNotes = [startNote, endNote];
        gameData.currentInterval = semitoneDistance;
        gameData.currentIntervalName = randomIntervalName;

        playNotes();
    }

    function playNotes() {
        var notes = gameData.currentNotes;
        var durationMs = parseInt(noteDurationInput.value) || 500;
        var durationSec = durationMs / 1000;
        var [note1, note2] = notes.map(parseNote);

        gameData.instrument.play(note1.note, note1.octave, durationSec);

        setTimeout(function() {
            gameData.instrument.play(note2.note, note2.octave, durationSec);
        }, durationMs);
    }

    function parseNote(noteStr) {
        var note = noteStr.slice(0, -1);
        var octave = parseInt(noteStr.slice(-1));
        return { note: note, octave: octave };
    }

    function handleIntervalGuess(event) {
        var guessedInterval = parseInt(event.target.dataset.interval);
        var guessedIntervalName = event.target.textContent;
        var correct = guessedInterval === gameData.currentInterval;

        feedbackDiv.textContent = correct ? 'Correct!' : 'Incorrect.';
        feedbackDiv.className = correct ? 'correct' : 'incorrect';

        gameData.attempts++;
        if (correct) {
            gameData.correctAnswers++;
            correctAnswersSpan.textContent = gameData.correctAnswers;
        }

        gameData.roundHistory.push({
            attempt: gameData.attempts,
            notes: gameData.currentNotes.slice(),
            interval: gameData.currentIntervalName,
            playerChoice: guessedIntervalName,
            correct: correct
        });

        updateRoundSummary();

        if (gameData.correctAnswers >= gameData.totalCorrectNeeded) {
            endGame();
        } else {
            nextRound();
        }
    }

    function updateRoundSummary() {
        var lastAttempt = gameData.roundHistory[gameData.roundHistory.length - 1];

        var row = document.createElement('tr');
        row.innerHTML = '<td>' + lastAttempt.attempt + '</td>' +
                        '<td>' + lastAttempt.notes[0] + '</td>' +
                        '<td>' + lastAttempt.notes[1] + '</td>' +
                        '<td>' + lastAttempt.playerChoice + '</td>' +
                        '<td>' + lastAttempt.interval + '</td>' +
                        '<td>' + (lastAttempt.correct ? 'Correct' : 'Incorrect') + '</td>';
        roundSummaryBody.insertBefore(row, roundSummaryBody.firstChild);
    }

    function endGame() {
        clearInterval(gameData.timerInterval);
        gameData.isGameRunning = false;
        gameDiv.style.display = 'none';
        resultsDiv.style.display = 'block';

        var totalTime = (Date.now() - gameData.startTime) / 1000;
        totalTimeSpan.textContent = totalTime.toFixed(2);

        finalRoundSummaryBody.innerHTML = '';
        gameData.roundHistory.forEach(function(attempt) {
            var row = document.createElement('tr');
            row.innerHTML = '<td>' + attempt.attempt + '</td>' +
                            '<td>' + attempt.notes[0] + '</td>' +
                            '<td>' + attempt.notes[1] + '</td>' +
                            '<td>' + attempt.playerChoice + '</td>' +
                            '<td>' + attempt.interval + '</td>' +
                            '<td>' + (attempt.correct ? 'Correct' : 'Incorrect') + '</td>';
            finalRoundSummaryBody.insertBefore(row, finalRoundSummaryBody.firstChild);
        });
    }

    function getSelectedDifficulty() {
        for (var i = 0; i < difficultyRadios.length; i++) {
            if (difficultyRadios[i].checked) {
                return difficultyRadios[i].value;
            }
        }
        return 'easy';
    }

    function onDifficultyChange() {
        if (gameData.isGameRunning) {
            stopGame();
            startGame();
        }
    }

    function onRoundsChange() {
        if (gameData.isGameRunning) {
            stopGame();
            startGame();
        }
    }

    startButton.addEventListener('click', startGame);
    stopButton.addEventListener('click', stopGame);
    restartButton.addEventListener('click', restartGame);
    replayButton.addEventListener('click', playNotes);

    for (var i = 0; i < difficultyRadios.length; i++) {
        difficultyRadios[i].addEventListener('change', onDifficultyChange);
    }

    roundsInput.addEventListener('change', onRoundsChange);

})();
