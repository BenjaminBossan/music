# Guitar Chord Trainer

A small browser app for practicing guitar chords by listening through the microphone. It is a static app: there is no backend and no build step.

## Running it

Microphone access requires a secure browser context. For local use, serve the repository on `localhost`:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/learn-chords/
```

Opening `index.html` directly with `file://` may load the page, but most browsers will block microphone access.

## Usage

1. Set the number of rounds. The default is 10.
2. Adjust the detection threshold if needed. Higher values reduce false positives but require a clearer chord.
3. Press Start and allow microphone access.
4. The app chooses one scale for the game from C major, A minor, G major, E minor, F major, or D minor.
5. Play the displayed chord. The app also shows its function in the selected scale, such as `root (I) chord` or `V chord`.
6. If the detected chord is wrong, keep trying. Attempts are counted for the current chord.
7. When the chord is detected correctly, it is logged and the next round starts after a 1.5 second mute transition.
8. When all rounds are complete, the game stops and shows total elapsed time, total attempts, and the result table. The table time is per chord, not cumulative.

Use Pause to suspend listening and the timer. Press Resume to continue. Stop ends the current game without showing a game-over result.

## Detection notes

The detector folds microphone FFT energy into pitch classes and scores major/minor triads. It is intended as a proof of concept, so real-room reliability depends on guitar volume, tuning, background noise, microphone quality, and chord voicing. When the input is too quiet, detection stays dormant instead of updating the confidence meter. The default detection threshold is 70%, and it can be adjusted while a game is running.
