# Sheet-to-Sound (Local)

This guide shows you how to set up the **FastAPI + Audiveris** pipeline that turns photos of sheet-music on your Android phone into playable MP3 on your Linux workstation.

---

## 1 System prerequisites

| Package                                 | Why                                 | Ubuntu/Debian command                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenJDK 17 JRE**                      | Audiveris is a Java app             | `sudo apt install openjdk-17-jre-headless`                                                                                                                                                     |
| **Audiveris 5.x**                       | Optical Music Recognition           | Download `audiveris-5.x.zip` from the [releases page](https://github.com/Audiveris/audiveris/releases) and unzip to */opt/audiveris/*. The main CLI ends up at */opt/audiveris/bin/Audiveris*. |
| **FluidSynth**                          | MIDI → WAV rendering                | `sudo apt install fluidsynth`                                                                                                                                                                  |
| **FFmpeg**                              | WAV → MP3 conversion                | `sudo apt install ffmpeg`                                                                                                                                                                      |
| **Tesseract-OCR** <sup>(optional)</sup> | Lyrics/OCR support inside Audiveris | `sudo apt install tesseract-ocr`                                                                                                                                                               |
| **libgl1 / pkg-config**                 | Makes OpenCV headless build happy   | `sudo apt install libgl1 pkg-config`                                                                                                                                                           |

> **SoundFont** FluidSynth needs a General MIDI sound-font. Grab **FluidR3\_GM.sf2**:
> `wget https://archive.org/download/FluidR3_GM/FluidR3_GM.sf2 -P soundfonts/`
> Update `SF_PATH` in *app.py* if you use a different path or filename.

---

## 2 Python environment

```bash
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn[standard] music21 opencv-python-headless numpy python-multipart
```

* `opencv-python-headless` avoids pulling in GUI libs.
* `python-multipart` is required by FastAPI to accept file uploads.

---

## 3 FastAPI service

1. Edit the constants at the top of **app.py** if your paths differ:

   ```python
   TMP_DIR = '/tmp/sheet2music'      # working directory
   SF_PATH = 'soundfonts/FluidR3_GM.sf2'
   AUDIVERIS_CMD = '/opt/audiveris/bin/Audiveris'
   ```
2. Start the server:

   ```bash
   source venv/bin/activate
   python app.py  # listens on 0.0.0.0:5000
   ```
3. Health-check:

   ```bash
   curl http://<PC-IP>:5000/alive  # → {"status":"ok"}
   ```

---

## 4 Android capture shortcut

**App:** [HTTP Request Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts)

1. *Create → New shortcut → Request*
2. **Method:** `POST`
3. **URL:** `http://<PC-IP>:5000/upload`
4. **Body type:** **Multipart/Form-Data**
5. *Add parameter*

   * **Name:** `file`
   * **Type:** *File*
   * **Data source:** *Open file picker (single)* or *Shared file* if you plan to hit *Share ▶ Shortcut* from the gallery.
6. **Headers:** *leave empty* – the app will add the correct `Content-Type` with boundary.

> **Usage**
> Snap a sheet-music photo → **Share** → *HTTP Request Shortcuts* → *Your shortcut*.
> Your browser will open with an audio player once the server responds (10-15 s for a single page on most machines).

---

## 5 Desktop testing

```bash
curl -F "file=@/path/to/sheet.jpg" http://<PC-IP>:5000/upload > result.html
xdg-open result.html
```

---

## 6 Troubleshooting

| Symptom                               | Likely cause & fix                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **500 ParseError** from `ElementTree` | The `.mxl` file is corrupt. Make sure Audiveris succeeded; check *out\_dir* for `*_pre.jpg` (input) and `*.omr` logs. |
| **Music21 repeat errors**             | The regex cleaner should strip repeats; open the cleaned XML (`/xml/{token}`) to inspect if repeats remain.           |
| **Blank or skewed staves**            | Retake the photo with better lighting; ensure entire page is in frame.                                                |
| **Connection timeout from phone**     | Large multi-page photos can take >30 s; crop to one page or use Wi-Fi 6 for faster upload.                            |

---

### Removing temp files

Logs, intermediates, and results live in `$TMP_DIR/<token>/`.
`find /tmp/sheet2music -mtime +7 -type d -exec rm -r {} +` will delete jobs older than a week.

---

Enjoy practising!
— *Sheet-to-Sound* ✨
