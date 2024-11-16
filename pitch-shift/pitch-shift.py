"""
Download and pitch shift a YouTube video.

This script downloads the audio from a given YouTube video, applies a pitch shift, and saves the result to an output file. The output can be either a WAV or an MP3 file, depending on the user's choice.

Usage:
    python youtube_pitch_shifter.py <YouTube_URL> <pitch_shift> [--output <output_name>] [--mp3]

Arguments:
    YouTube_URL          The URL of the YouTube video to download.
    pitch_shift          The number of semitones to pitch shift (positive or negative).

Options:
    --output <output_name>  Optional. Specify the base name for the output file without extension. Default is 'output_shifted'.
    --mp3                  Optional. Convert the output to mp3 format instead of WAV.

Examples:
    python youtube_pitch_shifter.py https://www.youtube.com/watch?v=example 2
        Downloads the YouTube video, shifts the pitch up by 2 semitones, and saves the result as 'output_shifted.wav'.

    python youtube_pitch_shifter.py https://www.youtube.com/watch?v=example -3 --output my_song --mp3
        Downloads the YouTube video, shifts the pitch down by 3 semitones, and saves the result as 'my_song.mp3'.
"""

import argparse
import os
import shutil
import tempfile

import ffmpeg
import librosa
import soundfile as sf
import yt_dlp


# Define the main function
def main():
    parser = argparse.ArgumentParser(description="Download and pitch shift a YouTube video.")
    parser.add_argument("url", type=str, help="The YouTube URL to download")
    parser.add_argument("pitch_shift", type=int, help="Number of semitones to pitch shift (positive or negative)")
    parser.add_argument("--output", type=str, default="output_shifted", help="Output file name without extension")
    parser.add_argument("--mp3", action="store_true", help="Convert the output to mp3 format")
    args = parser.parse_args()

    # Create a temporary directory for intermediate files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Step 1: Download the audio
        audio_file_path = os.path.join(temp_dir, "audio.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": audio_file_path,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                }
            ],
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([args.url])

        # Find the downloaded audio file
        audio_file = [f for f in os.listdir(temp_dir) if f.endswith(".wav")][0]
        audio_file_path = os.path.join(temp_dir, audio_file)

        # Step 2: Load and pitch shift the audio
        y, sr = librosa.load(audio_file_path)
        y_shifted = librosa.effects.pitch_shift(y, sr=sr, n_steps=args.pitch_shift)

        # Step 3: Save the pitch-shifted audio to a new file in the temp directory
        output_wav_path = os.path.join(temp_dir, f"{args.output}.wav")
        sf.write(output_wav_path, y_shifted, sr)

        # Step 4 (Optional): Convert to MP3 if the flag is set
        if args.mp3:
            fname = args.output
            if fname.endswith(".mp3"):
                fname = fname[:-4]
            output_mp3_path = os.path.join(temp_dir, f"{fname}.mp3")
            (ffmpeg.input(output_wav_path).output(output_mp3_path, **{"qscale:a": 0}).run())
            final_output_path = os.path.join(os.getcwd(), f"{args.output}.mp3")
            shutil.move(output_mp3_path, final_output_path)
            print(f"Output saved as {final_output_path}")
        else:
            fname = args.output
            if fname.endswith(".wav"):
                fname = fname[:-4]
            final_output_path = os.path.join(os.getcwd(), f"{fname}.wav")
            shutil.move(output_wav_path, final_output_path)
            print(f"Output saved as {final_output_path}")


if __name__ == "__main__":
    main()
