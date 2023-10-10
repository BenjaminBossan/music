"""Script that helps to train rhythmic play"""

import random
import time


CHORDS = ["A", "Am", "B7", "C", "D", "D7", "Dm", "E", "E6", "E7", "Em", "G"]
RHYTHMS = [1, 2, 4, 8]
LOUDNESS = ["p", "mf", "f"]
FREQ = 120  # bpm
PROB_CHORD_CHANGE = 0.2
BAR = "1 & 2 & 3 & 4 &"


def random_chord():
    """Print a random chord, rhythm and loudness"""
    prev_chord = None
    while True:
        rhythm = random.choice(RHYTHMS)
        loudness = random.choice(LOUDNESS)
        if prev_chord is None or random.random() < PROB_CHORD_CHANGE:
            chord = random.choice(CHORDS)
            if chord != prev_chord:
                prev_chord = chord
                print_to_console(f"{chord}\n\n\n\nCtrl+C to exit")
                time.sleep(2)
        else:
            chord = prev_chord

        print_to_console(f"{chord} {rhythm}/{rhythm} {loudness}")
        time.sleep(0.5)

        for i in range(8):
            should_play = i in range(0, 8, (8 // rhythm))
            symbol = "^" if should_play else "-"
            indicator = i * "  " + symbol
            lines = [
                f"{chord} {rhythm}/{rhythm}",
                BAR,
                indicator,
                "",
                "Ctrl+C to exit",
            ]
            print_to_console("\n".join(lines))
            time.sleep(1 / FREQ * 60)


def print_to_console(text):
    """Print text to console and clear screen"""
    print("\033c", end="")
    print(text)
    # move cursor out of the way
    print("\n" * 20)


if __name__ == "__main__":
    random_chord()
