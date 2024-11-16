# Pitch Shifting Script

This script allows you to download the audio from a YouTube video, apply a pitch shift, and save the result to an output file. You can choose between saving the output as a WAV or MP3 file. It is useful for musicians or anyone who wants to adjust the pitch of a song or audio from YouTube.

## Installation

Make sure you have Python installed, then install the required dependencies into your virtual environment by running:

```bash
python -m pip install -r requirements.txt
```

Ensure that [`ffmpeg` is also installed](https://www.ffmpeg.org/download.html) and available in your system's PATH.

## Usage

```bash
python pitch-shift.py <YouTube_URL> <pitch_shift> [--output <output_name>] [--mp3]
```

### Arguments

- `<YouTube_URL>`: The URL of the YouTube video to download.
- `<pitch_shift>`: The number of semitones to pitch shift (positive or negative).

### Options

- `--output <output_name>`: Optional. Specify the base name for the output file without extension. Default is 'output_shifted'.
- `--mp3`: Optional. Convert the output to MP3 format instead of WAV.

## Examples

1. **Basic Usage**

    ```bash
    python youtube_pitch_shifter.py https://www.youtube.com/watch?v=example 2
    ```
    Downloads the YouTube video, shifts the pitch up by 2 semitones, and saves the result as 'output_shifted.wav'.

2. **Custom Output and MP3 Conversion**

    ```bash
    python youtube_pitch_shifter.py https://www.youtube.com/watch?v=example -3 --output my_song --mp3
    ```
    Downloads the YouTube video, shifts the pitch down by 3 semitones, and saves the result as 'my_song.mp3'.
