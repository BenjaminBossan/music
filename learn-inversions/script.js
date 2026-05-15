(function() {
    // String index convention: 0 = low E (string 6), 5 = high E (string 1).
    // Each set lists the three string indices low→high and the tuning intervals
    // (in semitones) between them.
    var STRING_SETS = [
        { name: 'Strings 6-5-4 (E-A-D)', strings: [0, 1, 2], tuningLowMid: 5, tuningMidHigh: 5 },
        { name: 'Strings 5-4-3 (A-D-G)', strings: [1, 2, 3], tuningLowMid: 5, tuningMidHigh: 5 },
        { name: 'Strings 4-3-2 (D-G-B)', strings: [2, 3, 4], tuningLowMid: 5, tuningMidHigh: 4 },
        { name: 'Strings 3-2-1 (G-B-E)', strings: [3, 4, 5], tuningLowMid: 4, tuningMidHigh: 5 }
    ];

    // For each triad type, semitones between the lowest sounding note and the
    // mid/high notes when played as a closed-voicing triad.
    //   Root pos: low=root,  mid=3rd,    high=5th
    //   1st inv:  low=3rd,   mid=5th,    high=root (+8va)
    //   2nd inv:  low=5th,   mid=root,   high=3rd
    // Roles array describes which scale degree each of the three notes is.
    var TRIAD_TYPES = [
        { id: 'major-root',   label: 'Major (Root)',     quality: 'major',  inversion: 'root',   mid: 4, high: 7,  roles: ['root', 'third', 'fifth'] },
        { id: 'major-first',  label: 'Major (1st Inv.)', quality: 'major',  inversion: 'first',  mid: 3, high: 8,  roles: ['third', 'fifth', 'root'] },
        { id: 'major-second', label: 'Major (2nd Inv.)', quality: 'major',  inversion: 'second', mid: 5, high: 9,  roles: ['fifth', 'root', 'third'] },
        { id: 'minor-root',   label: 'Minor (Root)',     quality: 'minor',  inversion: 'root',   mid: 3, high: 7,  roles: ['root', 'third', 'fifth'] },
        { id: 'minor-first',  label: 'Minor (1st Inv.)', quality: 'minor',  inversion: 'first',  mid: 4, high: 9,  roles: ['third', 'fifth', 'root'] },
        { id: 'minor-second', label: 'Minor (2nd Inv.)', quality: 'minor',  inversion: 'second', mid: 5, high: 8,  roles: ['fifth', 'root', 'third'] }
    ];

    var MAX_FRET = 6;

    // Open-string pitch class (semitones from C) for each string index, low E → high E.
    var STRING_OPEN_PC = [4, 9, 2, 7, 11, 4];

    var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // Preferred root spellings by pitch class and quality. Pick whichever key
    // signature is conventional so each triad spells with stacked thirds and
    // single accidentals (e.g. Eb min, not D# min; Ab maj, not G# maj).
    var ROOT_SPELLINGS = {
        major: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
        minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
    };

    function spellNote(letter, targetPc) {
        var diff = ((targetPc - LETTER_PC[letter]) % 12 + 12) % 12;
        if (diff > 6) diff -= 12;
        var accidentals = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' };
        return letter + (accidentals[diff] || '?');
    }

    function getChordSpellings(rootSpelling, quality) {
        var rootLetter = rootSpelling[0];
        var rootIdx = LETTERS.indexOf(rootLetter);
        var rootAccidental = rootSpelling.slice(1);
        var rootPc = LETTER_PC[rootLetter];
        if (rootAccidental === '#') rootPc += 1;
        else if (rootAccidental === 'b') rootPc -= 1;
        rootPc = ((rootPc % 12) + 12) % 12;

        var thirdLetter = LETTERS[(rootIdx + 2) % 7];
        var fifthLetter = LETTERS[(rootIdx + 4) % 7];
        var thirdPc = (rootPc + (quality === 'major' ? 4 : 3)) % 12;
        var fifthPc = (rootPc + 7) % 12;

        return {
            root: rootSpelling,
            third: spellNote(thirdLetter, thirdPc),
            fifth: spellNote(fifthLetter, fifthPc)
        };
    }

    // DOM
    var startButton = document.getElementById('start-button');
    var stopButton = document.getElementById('stop-button');
    var restartButton = document.getElementById('restart-button');
    var nextButton = document.getElementById('next-button');
    var nextWrapper = document.getElementById('next-round-wrapper');
    var settingsDetails = document.getElementById('settings-details');
    var fretboard = document.getElementById('fretboard');
    var answerOptionsDiv = document.getElementById('answer-options');
    var feedbackDiv = document.getElementById('feedback');
    var legendDiv = document.getElementById('legend');
    var timerSpan = document.getElementById('timer');
    var correctAnswersSpan = document.getElementById('correct-answers');
    var totalRoundsSpan = document.getElementById('total-rounds');
    var totalTimeSpan = document.getElementById('total-time');
    var gameDiv = document.getElementById('game');
    var resultsDiv = document.getElementById('results');
    var settingsDiv = document.getElementById('settings');
    var roundSummaryBody = document.getElementById('round-summary');
    var finalRoundSummaryBody = document.getElementById('final-round-summary');
    var roundsInput = document.getElementById('rounds');
    var stringSetCheckboxes = document.getElementsByName('string-set');
    var inversionCheckboxes = document.getElementsByName('inversion');
    var includeMajorCheckbox = document.getElementById('include-major');
    var includeMinorCheckbox = document.getElementById('include-minor');
    var revealRolesCheckbox = document.getElementById('reveal-roles');

    var gameData = {
        correctNeeded: 10,
        correctAnswers: 0,
        attempts: 0,
        roundHistory: [],
        currentChord: null,
        startTime: null,
        timerInterval: null,
        pauseStart: null,
        isGameRunning: false,
        awaitingNext: false,
        availableStringSets: [],
        availableTriads: [],
        revealRoles: true
    };

    function startGame() {
        var selectedStringSets = [];
        for (var i = 0; i < stringSetCheckboxes.length; i++) {
            if (stringSetCheckboxes[i].checked) {
                selectedStringSets.push(parseInt(stringSetCheckboxes[i].value));
            }
        }
        if (selectedStringSets.length === 0) {
            alert('Please select at least one string set.');
            return;
        }

        var selectedInversions = {};
        for (var j = 0; j < inversionCheckboxes.length; j++) {
            if (inversionCheckboxes[j].checked) {
                selectedInversions[inversionCheckboxes[j].value] = true;
            }
        }
        if (Object.keys(selectedInversions).length === 0) {
            alert('Please select at least one inversion.');
            return;
        }

        var includeMajor = includeMajorCheckbox.checked;
        var includeMinor = includeMinorCheckbox.checked;
        if (!includeMajor && !includeMinor) {
            alert('Please select at least one chord quality.');
            return;
        }

        var availableTriads = TRIAD_TYPES.filter(function(t) {
            if (t.quality === 'major' && !includeMajor) return false;
            if (t.quality === 'minor' && !includeMinor) return false;
            if (!selectedInversions[t.inversion]) return false;
            return true;
        });
        if (availableTriads.length === 0) {
            alert('No chord types available with the current settings.');
            return;
        }

        gameData.availableStringSets = selectedStringSets;
        gameData.availableTriads = availableTriads;
        gameData.revealRoles = revealRolesCheckbox.checked;
        gameData.correctNeeded = parseInt(roundsInput.value) || 10;
        gameData.correctAnswers = 0;
        gameData.attempts = 0;
        gameData.roundHistory = [];
        gameData.startTime = Date.now();
        gameData.pauseStart = null;
        gameData.awaitingNext = false;
        gameData.isGameRunning = true;

        gameDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        feedbackDiv.innerHTML = '';
        feedbackDiv.className = '';
        roundSummaryBody.innerHTML = '';
        nextWrapper.style.display = 'none';

        if (settingsDetails) settingsDetails.open = false;

        timerSpan.textContent = '0.00';
        clearInterval(gameData.timerInterval);
        gameData.timerInterval = setInterval(updateTimer, 100);

        correctAnswersSpan.textContent = '0';
        totalRoundsSpan.textContent = gameData.correctNeeded;

        renderAnswerButtons();
        nextRound();
    }

    function stopGame() {
        clearInterval(gameData.timerInterval);
        gameData.timerInterval = null;
        gameData.pauseStart = null;
        gameData.awaitingNext = false;
        gameData.isGameRunning = false;
        gameDiv.style.display = 'none';
        resultsDiv.style.display = 'none';
        nextWrapper.style.display = 'none';
    }

    function restartGame() {
        stopGame();
        startGame();
    }

    function updateTimer() {
        var elapsed = (Date.now() - gameData.startTime) / 1000;
        timerSpan.textContent = elapsed.toFixed(2);
    }

    function renderAnswerButtons() {
        answerOptionsDiv.innerHTML = '';
        gameData.availableTriads.forEach(function(triad) {
            var btn = document.createElement('button');
            btn.textContent = triad.label;
            btn.dataset.triadId = triad.id;
            btn.addEventListener('click', handleAnswer);
            answerOptionsDiv.appendChild(btn);
        });
    }

    function nextRound() {
        var stringSetIdx = gameData.availableStringSets[
            Math.floor(Math.random() * gameData.availableStringSets.length)
        ];
        var stringSet = STRING_SETS[stringSetIdx];

        var triad = gameData.availableTriads[
            Math.floor(Math.random() * gameData.availableTriads.length)
        ];

        var midOffset = triad.mid - stringSet.tuningLowMid;
        var highOffset = triad.high - stringSet.tuningLowMid - stringSet.tuningMidHigh;

        var minOffset = Math.min(0, midOffset, highOffset);
        var maxOffset = Math.max(0, midOffset, highOffset);
        var minLowFret = 1 - minOffset;
        var maxLowFret = MAX_FRET - maxOffset;
        if (maxLowFret < minLowFret) {
            // Shape doesn't fit (shouldn't happen with MAX_FRET = 6, but guard).
            maxLowFret = minLowFret;
        }
        var lowFret = Math.floor(Math.random() * (maxLowFret - minLowFret + 1)) + minLowFret;

        var dots = [
            { stringIdx: stringSet.strings[0], fret: lowFret,             role: triad.roles[0] },
            { stringIdx: stringSet.strings[1], fret: lowFret + midOffset, role: triad.roles[1] },
            { stringIdx: stringSet.strings[2], fret: lowFret + highOffset, role: triad.roles[2] }
        ];

        var rootDot = dots.filter(function(d) { return d.role === 'root'; })[0];
        var rootPc = (STRING_OPEN_PC[rootDot.stringIdx] + rootDot.fret) % 12;
        var rootSpelling = ROOT_SPELLINGS[triad.quality][rootPc];
        var spellings = getChordSpellings(rootSpelling, triad.quality);
        var noteNames = dots.map(function(d) { return spellings[d.role]; });
        var chordFullName = rootSpelling + ' ' + triad.label;
        var notesString = noteNames.join(' – ');

        gameData.currentChord = {
            stringSetIdx: stringSetIdx,
            stringSetName: stringSet.name,
            triadId: triad.id,
            triadLabel: triad.label,
            chordFullName: chordFullName,
            notesString: notesString,
            dots: dots
        };

        renderFretboard(dots, false);
        feedbackDiv.innerHTML = '';
        feedbackDiv.className = '';
        legendDiv.style.display = 'none';

        var buttons = answerOptionsDiv.querySelectorAll('button');
        buttons.forEach(function(b) {
            b.disabled = false;
            b.classList.remove('choice-correct', 'choice-incorrect');
        });
    }

    function renderFretboard(dots, showRoles) {
        fretboard.innerHTML = '';

        for (var f = 0; f <= MAX_FRET; f++) {
            var line = document.createElement('div');
            line.classList.add('fret-line');
            line.style.left = (f / MAX_FRET * 100) + '%';
            fretboard.appendChild(line);
        }

        for (var s = 0; s < 6; s++) {
            var stringDiv = document.createElement('div');
            stringDiv.classList.add('string');
            stringDiv.dataset.stringIdx = s;
            fretboard.appendChild(stringDiv);

            var labelDiv = document.createElement('div');
            labelDiv.classList.add('string-label');
            labelDiv.dataset.stringIdx = s;
            labelDiv.textContent = s === 5 ? 'e' : ['E', 'A', 'D', 'G', 'B'][s];
            fretboard.appendChild(labelDiv);
        }

        dots.forEach(function(dot) {
            var dotDiv = document.createElement('div');
            dotDiv.classList.add('dot');
            dotDiv.dataset.stringIdx = dot.stringIdx;
            var leftPercent = ((dot.fret - 0.5) / MAX_FRET) * 100;
            dotDiv.style.left = leftPercent + '%';
            if (showRoles) {
                dotDiv.classList.add('role-' + dot.role);
            }
            fretboard.appendChild(dotDiv);
        });
    }

    function handleAnswer(event) {
        var btn = event.currentTarget;
        var guessId = btn.dataset.triadId;
        var guessLabel = btn.textContent;
        var correct = guessId === gameData.currentChord.triadId;

        var buttons = answerOptionsDiv.querySelectorAll('button');
        buttons.forEach(function(b) {
            b.disabled = true;
            if (b.dataset.triadId === gameData.currentChord.triadId) {
                b.classList.add('choice-correct');
            }
        });
        if (!correct) {
            btn.classList.add('choice-incorrect');
        }

        if (correct) {
            feedbackDiv.textContent = 'Correct!';
            feedbackDiv.className = 'correct';
        } else {
            feedbackDiv.textContent = 'Incorrect. Correct answer: ' + gameData.currentChord.triadLabel + '.';
            feedbackDiv.className = 'incorrect';
        }

        if (gameData.revealRoles) {
            renderFretboard(gameData.currentChord.dots, true);
            legendDiv.style.display = 'block';
        }

        gameData.attempts++;
        if (correct) {
            gameData.correctAnswers++;
            correctAnswersSpan.textContent = gameData.correctAnswers;
        }

        gameData.roundHistory.push({
            attempt: gameData.attempts,
            chord: gameData.currentChord.chordFullName,
            notes: gameData.currentChord.notesString,
            correctAnswer: gameData.currentChord.triadLabel,
            playerChoice: guessLabel,
            correct: correct
        });

        updateRoundSummary(roundSummaryBody);

        clearInterval(gameData.timerInterval);
        gameData.timerInterval = null;
        gameData.pauseStart = Date.now();
        gameData.awaitingNext = true;

        nextButton.textContent = gameData.correctAnswers >= gameData.correctNeeded
            ? 'Show Results'
            : 'Next';
        nextWrapper.style.display = 'block';
        nextButton.focus();
    }

    function onNextClicked() {
        if (!gameData.awaitingNext) return;
        gameData.awaitingNext = false;
        nextWrapper.style.display = 'none';

        if (gameData.pauseStart !== null) {
            gameData.startTime += Date.now() - gameData.pauseStart;
            gameData.pauseStart = null;
        }
        if (!gameData.timerInterval) {
            gameData.timerInterval = setInterval(updateTimer, 100);
        }

        if (gameData.correctAnswers >= gameData.correctNeeded) {
            endGame();
        } else {
            nextRound();
        }
    }

    function buildHistoryRow(entry) {
        var row = document.createElement('tr');
        row.innerHTML =
            '<td>' + entry.attempt + '</td>' +
            '<td>' + entry.chord + '</td>' +
            '<td>' + entry.notes + '</td>' +
            '<td>' + entry.playerChoice + '</td>' +
            '<td>' + (entry.correct ? 'Correct' : 'Incorrect') + '</td>';
        row.className = entry.correct ? 'row-correct' : 'row-incorrect';
        return row;
    }

    function updateRoundSummary(tbody) {
        var last = gameData.roundHistory[gameData.roundHistory.length - 1];
        tbody.insertBefore(buildHistoryRow(last), tbody.firstChild);
    }

    function endGame() {
        clearInterval(gameData.timerInterval);
        gameData.isGameRunning = false;
        gameDiv.style.display = 'none';
        resultsDiv.style.display = 'block';

        var totalTime = (Date.now() - gameData.startTime) / 1000;
        totalTimeSpan.textContent = totalTime.toFixed(2);

        finalRoundSummaryBody.innerHTML = '';
        gameData.roundHistory.forEach(function(entry) {
            finalRoundSummaryBody.insertBefore(buildHistoryRow(entry), finalRoundSummaryBody.firstChild);
        });
    }

    startButton.addEventListener('click', startGame);
    stopButton.addEventListener('click', stopGame);
    restartButton.addEventListener('click', restartGame);
    nextButton.addEventListener('click', onNextClicked);
})();
