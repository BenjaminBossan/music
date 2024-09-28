// Define the standard tuning notes for a guitar (from string 6 to string 1)
const guitarStrings = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// Map of note names to MIDI numbers and vice versa
const noteToMidi = {};
const midiToNote = {};

(function createNoteMappings() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let midiNumber = 12; // Starting from C0
    for (let octave = 0; octave <= 8; octave++) {
        for (let i = 0; i < notes.length; i++) {
            const noteName = notes[i] + octave;
            noteToMidi[noteName] = midiNumber;
            midiToNote[midiNumber] = noteName;
            midiNumber++;
        }
    }
})();

// Frequencies for notes (A4 = 440Hz)
const noteFrequencies = {};
for (let midi in midiToNote) {
    const frequency = 440 * Math.pow(2, (midi - 69) / 12);
    noteFrequencies[midiToNote[midi]] = frequency;
}

// Game variables
let correctAnswers = 0;
let startTime;
let timerInterval;
let gameStarted = false;
let currentNote = null;
let totalNotes = 10;    // default number of notes per round
let playSound = true;
let answerRecords = []; // Array to store answer records
let questionStartTime;
let maxFret = 4;        // Default maximum fret

// Audio context for sound playback
let audioCtx;

// Initialize the game
function init() {
    correctAnswers = 0;
    document.getElementById('score').textContent = '0';
    document.getElementById('time').textContent = '0.0';
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
    document.getElementById('notification').textContent = '';
    gameStarted = false;
    currentNote = null;
    clearInterval(timerInterval);
    generateFretboard();
    generatePiano();
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    document.getElementById('toggle-sound').textContent = playSound ? 'On' : 'Off';
    document.getElementById('total-notes').textContent = totalNotes;
}

// Update the fretboard when the highest fret input changes
document.getElementById('max-fret').addEventListener('input', function() {
    maxFret = parseInt(document.getElementById('max-fret').value) || 4;
    if (maxFret < 1) maxFret = 1;
    if (maxFret > 15) maxFret = 15;

    generateFretboard();
});

// Start the game
function startGame() {
    if (gameStarted) return;
    totalNotes = parseInt(document.getElementById('num-notes').value) || 20;
    document.getElementById('total-notes').textContent = totalNotes;

    maxFret = parseInt(document.getElementById('max-fret').value) || 4;
    if (maxFret < 1) maxFret = 1;
    if (maxFret > 15) maxFret = 15;

    // Regenerate fretboard and piano with new max fret
    generateFretboard();
    generatePiano();

    gameStarted = true;
    correctAnswers = 0;
    answerRecords = []; // Reset the answer records
    updateRecordTable(); // Clear the record table
    document.getElementById('score').textContent = '0';
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);
    showRandomNote();
}

// Stop the game
function stopGame() {
    if (!gameStarted) return;
    gameStarted = false;
    clearInterval(timerInterval);
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
    clearFretboardMarkers();
}

function updateTimer() {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    document.getElementById('time').textContent = elapsed;
}

function generateFretboard() {
    const fretboard = document.getElementById('fretboard');
    fretboard.innerHTML = '';

    const fretPositions = calculateFretPositions(maxFret);

    // Add fret lines
    for (let fret = 0; fret <= maxFret; fret++) {
        const fretLine = document.createElement('div');
        fretLine.classList.add('fret-line');
        fretLine.style.left = `${fretPositions[fret]}%`;
        fretboard.appendChild(fretLine);
    }

    for (let string = 5; string >= 0; string--) {
        // String
        const stringDiv = document.createElement('div');
        stringDiv.classList.add('string');
        stringDiv.dataset.string = string;
        fretboard.appendChild(stringDiv);

        // String label
        const labelDiv = document.createElement('div');
        labelDiv.classList.add('string-label');
        labelDiv.dataset.string = string;

        if (string === 5) {
            labelDiv.textContent = 'e'; // High E string represented as lowercase 'e'
        } else {
            labelDiv.textContent = guitarStrings[string].charAt(0); // Get the note letter
        }

        fretboard.appendChild(labelDiv);
    }

    adjustFretboardLayout();
}


function calculateFretPositions(maxFret) {
    const fretPositions = [];
    const scaleLength = 100; // Represented as a percentage

    for (let fret = 0; fret <= maxFret; fret++) {
        if (fret === 0) {
            fretPositions.push(0);
            continue;
        }
        const position = 100 * (1 - (1 / Math.pow(2, fret / 12)));
        fretPositions.push(position);
    }
    return fretPositions;
}

function adjustFretboardLayout() {
    const fretboard = document.getElementById('fretboard');
    const fretboardWidth = fretboard.offsetWidth;

    // Adjust strings and labels positions
    const stringPositions = [10, 28, 46, 64, 82, 100]; // Adjust as needed
    const stringLabels = fretboard.querySelectorAll('.string-label');
    stringLabels.forEach((label, index) => {
        label.style.left = '-25px';
        label.style.top = (stringPositions[index] - 9) + 'px'; // Adjust label position
    });

    const strings = fretboard.querySelectorAll('.string');
    strings.forEach((string, index) => {
        string.style.top = stringPositions[index] + 'px';
    });
}

// Generate the piano keys from E2 to E5
function generatePiano() {
    const piano = document.getElementById('piano');
    piano.innerHTML = '';

    // Determine the highest note based on max fret
    let highestNoteMidi = noteToMidi['E2']; // Start from E2
    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
        const stringNote = guitarStrings[stringIndex];
        const stringMidi = noteToMidi[stringNote];
        const noteMidi = stringMidi + maxFret;
        if (noteMidi > highestNoteMidi) {
            highestNoteMidi = noteMidi;
        }
    }

    // Ensure the piano extends up to at least B5
    const maxMidi = Math.max(highestNoteMidi, noteToMidi['B5']);

    // Adjust piano container width based on the number of keys
    const totalWhiteKeys = countWhiteKeys(noteToMidi['E2'], maxMidi);
    const pianoWidth = totalWhiteKeys * 40; // Each white key is 40px wide
    const pianoContainer = document.getElementById('piano-container');
    pianoContainer.style.width = pianoWidth + 'px';
    piano.style.width = pianoWidth + 'px';

    let whiteKeyIndex = 0;
    for (let midi = noteToMidi['E2']; midi <= maxMidi; midi++) {
        const note = midiToNote[midi];
        const isSharp = note.includes('#');
        const keyDiv = document.createElement('div');
        keyDiv.classList.add('key');
        keyDiv.dataset.note = note;

        const label = document.createElement('label');
        label.textContent = note; // Include octave number
        keyDiv.appendChild(label);

        keyDiv.addEventListener('click', onPianoKeyClick);

        if (isSharp) {
            keyDiv.classList.add('black');
            if (!isBlackKeyHidden(note)) {
                keyDiv.style.left = `${(whiteKeyIndex - 1) * 40 + 30}px`;
                piano.appendChild(keyDiv);
            }
        } else {
            keyDiv.classList.add('white');
            keyDiv.style.left = `${whiteKeyIndex * 40}px`;
            piano.appendChild(keyDiv);
            whiteKeyIndex++;
        }
    }
}

function countWhiteKeys(startMidi, endMidi) {
    let count = 0;
    for (let midi = startMidi; midi <= endMidi; midi++) {
        const note = midiToNote[midi];
        if (!note.includes('#')) {
            count++;
        }
    }
    return count;
}

// Determine if a black key should be hidden (no black key between E-F and B-C)
function isBlackKeyHidden(note) {
    return ['E', 'B'].some(
        natural => note.startsWith(natural) && note.includes('#')
    );
}

// Handle piano key clicks
function onPianoKeyClick(e) {
    if (!gameStarted) return;
    const selectedNote = e.currentTarget.dataset.note;
    const correctNote = currentNote;
    const timeTaken = ((Date.now() - questionStartTime) / 1000).toFixed(1);

    let isCorrect = false;

    if (selectedNote === correctNote) {
        correctAnswers++;
        document.getElementById('score').textContent = correctAnswers;
        isCorrect = true;
    }

    // Record the answer
    answerRecords.push({
        number: answerRecords.length + 1,
        yourAnswer: selectedNote,
        correctNote: correctNote,
        timeTaken: timeTaken,
        isCorrect: isCorrect,
    });

    updateRecordTable();

    if (isCorrect) {
        showNotification('Correct!', false);
    } else {
        showNotification(`Wrong! The correct note was ${correctNote}`, true);
    }

    if (correctAnswers >= totalNotes && isCorrect) {
        // Show 'Correct!' notification before stopping the game
        setTimeout(() => {
            stopGame();
            showNotification(`Game Over! Total time: ${document.getElementById('time').textContent}s`, true);
        }, 500);
    } else if (correctAnswers >= totalNotes) {
        // No need to show 'Correct!' notification, but stop the game
        stopGame();
        showNotification(`Game Over! Total time: ${document.getElementById('time').textContent}s`, true);
    } else {
        showRandomNote();
    }
}

// Show a random note on the fretboard (frets 0 to 4 inclusive)
function showRandomNote() {
    questionStartTime = Date.now();
    clearFretboardMarkers();

    const randomString = Math.floor(Math.random() * 6);
    const randomFret = Math.floor(Math.random() * (maxFret + 1)); // Frets 0 to maxFret
    currentNote = getNoteForFret(randomString, randomFret);

    const stringDiv = document.querySelector(`.string[data-string="${randomString}"]`);
    const marker = document.createElement('div');
    marker.classList.add('marker');

    // Get fret positions
    const fretPositions = calculateFretPositions(maxFret);
    let fretPosition = fretPositions[randomFret];

    marker.style.left = `${fretPosition}%`;

    if (randomFret === 0) {
        marker.textContent = 'x';
        marker.style.left = '0%';
    } else {
        marker.textContent = randomFret;
    }
    stringDiv.appendChild(marker);

    // Play the note sound if enabled
    if (playSound) {
        playNoteSound(currentNote);
    }
}

function updateRecordTable() {
    const recordBody = document.getElementById('record-body');
    recordBody.innerHTML = ''; // Clear existing records

    answerRecords.forEach(record => {
        const row = document.createElement('tr');
        row.classList.add(record.isCorrect ? 'correct' : 'incorrect');

        const numberCell = document.createElement('td');
        numberCell.textContent = record.number;
        row.appendChild(numberCell);

        const yourAnswerCell = document.createElement('td');
        yourAnswerCell.textContent = record.yourAnswer;
        row.appendChild(yourAnswerCell);

        const correctNoteCell = document.createElement('td');
        correctNoteCell.textContent = record.correctNote;
        row.appendChild(correctNoteCell);

        const timeTakenCell = document.createElement('td');
        timeTakenCell.textContent = record.timeTaken;
        row.appendChild(timeTakenCell);

        recordBody.appendChild(row);
    });
}


// Calculate the visual position of the fret marker
function getFretPosition(fret) {
    // Calculate the fret position based on standard fret spacing ratios
    const scaleLength = 100; // Represented as a percentage
    const fretPositions = [];
    for (let i = 0; i <= maxFret; i++) {
        const position = scaleLength - (scaleLength * (1 - Math.pow(0.943874, i)));
        fretPositions.push(position);
    }
    return fretPositions[fret] || (fret / maxFret) * 100;
}

// Clear markers from the fretboard
function clearFretboardMarkers() {
    const markers = document.querySelectorAll('.string .marker');
    markers.forEach(marker => marker.remove());
}

// Get the note for a given string and fret
function getNoteForFret(stringIndex, fret) {
    const stringNote = guitarStrings[stringIndex];
    const stringMidi = noteToMidi[stringNote];
    const noteMidi = stringMidi + parseInt(fret);
    const noteName = midiToNote[noteMidi];
    return noteName;
}

// Show a notification message
function showNotification(message, isError) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.color = isError ? 'red' : 'green';
    setTimeout(() => {
        notification.textContent = '';
    }, 3000);
}

// Play the sound of the note
function playNoteSound(note) {
    const frequency = noteFrequencies[note];
    if (!frequency) return;

    const now = audioCtx.currentTime;
    const duration = 1.5; // Total duration in seconds
    const fadeTime = 0.05; // Fade in/out time in seconds

    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);

    const gainNode = audioCtx.createGain();

    // Start with zero gain for fade-in
    gainNode.gain.setValueAtTime(0, now);

    // Fade in to target gain
    gainNode.gain.linearRampToValueAtTime(0.2, now + fadeTime);

    // Sustain gain until fade-out begins
    gainNode.gain.setValueAtTime(0.2, now + duration - fadeTime);

    // Fade out to zero gain
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + fadeTime); // Stop after the fade-out completes
}

// Toggle sound playback
function toggleSound() {
    playSound = !playSound;
    document.getElementById('toggle-sound').textContent = playSound ? 'On' : 'Off';
}

// Event listeners
document.getElementById('start').addEventListener('click', startGame);
document.getElementById('stop').addEventListener('click', stopGame);
document.getElementById('toggle-sound').addEventListener('click', toggleSound);

// Initialize the game on page load
window.onload = init;

