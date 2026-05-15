import os
import uuid
import subprocess
import cv2
import numpy as np
import xml.etree.ElementTree as ET
import re
import zipfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from music21 import converter
import traceback

app = FastAPI()

TMP_DIR = '/tmp/sheet2music'
SF_PATH = 'soundfonts/Your.sf2'
AUDIVERIS_CMD = '/opt/audiveris/bin/Audiveris'
# Ensure tmp directory exists
os.makedirs(TMP_DIR, exist_ok=True)

############################################
# Helper functions
############################################

def preprocess_image(input_path: str, token: str) -> str:
    """Deskew + binarize image for Audiveris."""
    img_gray = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    if img_gray is None:
        raise ValueError(f"Failed to load image: {input_path}")
    _, img_bin = cv2.threshold(img_gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(img_bin > 0))
    if len(coords) > 10:
        rect = cv2.minAreaRect(coords)
        angle = rect[-1] if rect[-1] >= -45 else rect[-1] + 90
        h, w = img_bin.shape
        M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
        img_bin = cv2.warpAffine(img_bin, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    img_pre = cv2.bitwise_not(img_bin)
    pre_path = os.path.join(TMP_DIR, f"{token}_pre.jpg")
    cv2.imwrite(pre_path, img_pre)
    print(f"Preprocessed image saved to: {pre_path}")
    return pre_path


def extract_xml_from_mxl(mxl_path: str) -> str:
    """Return raw XML string extracted from a .mxl (zip) file."""
    with zipfile.ZipFile(mxl_path) as zf:
        # Take the first .xml inside
        xml_name = next(n for n in zf.namelist() if n.endswith('.xml'))
        return zf.read(xml_name).decode('utf-8')


def clean_xml_string(xml_text: str) -> str:
    """Remove <repeat> elements and barlines containing repeats via regex."""
    xml_text = re.sub(r'<repeat[^>]*?>.*?</repeat>', '', xml_text, flags=re.DOTALL)
    xml_text = re.sub(r'<barline[^>]*?>.*?<repeat[^>]*?>.*?</repeat>.*?</barline>', '',
                      xml_text, flags=re.DOTALL)
    return xml_text

############################################
# Routes
############################################

@app.get('/alive')
def alive():
    return {"status": "ok"}


@app.post('/upload', response_class=HTMLResponse)
async def upload(file: UploadFile = File(...)):
    token = uuid.uuid4().hex
    out_dir = os.path.join(TMP_DIR, token)
    os.makedirs(out_dir, exist_ok=True)
    try:
        # Save uploaded photo
        orig = os.path.join(out_dir, f"{token}.jpg")
        with open(orig, 'wb') as f:
            f.write(await file.read())

        # Preprocess for Audiveris
        pre = preprocess_image(orig, token)

        # Run Audiveris
        subprocess.run([AUDIVERIS_CMD, '-batch', '-export', '-output', out_dir, pre],
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, check=True)

        # Find produced .mxl
        mxl_file = next((f for f in os.listdir(out_dir) if f.endswith('.mxl')), None)
        if not mxl_file:
            return HTMLResponse('<h3>No MusicXML generated. Check image clarity.</h3>', status_code=400)
        mxl_path = os.path.join(out_dir, mxl_file)

        # Extract & sanitize XML
        xml_raw = extract_xml_from_mxl(mxl_path)
        xml_clean = clean_xml_string(xml_raw)
        xml_clean_path = os.path.join(out_dir, f'{token}.xml')
        with open(xml_clean_path, 'w', encoding='utf-8') as f:
            f.write(xml_clean)

        # Parse with music21
        midi_path = os.path.join(out_dir, f'{token}.mid')
        score = converter.parse(xml_clean_path)
        score.write('midi', fp=midi_path)

        # Synthesize audio
        wav = os.path.join(out_dir, f'{token}.wav')
        mp3 = os.path.join(out_dir, f'{token}.mp3')
        subprocess.run(['fluidsynth', '-ni', SF_PATH, midi_path, '-F', wav], check=True)
        subprocess.run(['ffmpeg', '-y', '-i', wav, mp3], check=True)

        # Return HTML with audio
        html = f"""
        <html><body>
          <h3>Transcription Complete</h3>
          <audio controls src="/play/{token}"></audio>
          <p>Download cleaned XML: <a href="/xml/{token}">here</a></p>
        </body></html>
        """
        return HTMLResponse(html)
    except Exception:
        tb = traceback.format_exc()
        print(tb)
        return HTMLResponse(f'<h3>Internal Error</h3><pre>{tb}</pre>', status_code=500)


@app.get('/play/{token}')
def play(token: str):
    path = os.path.join(TMP_DIR, token, f'{token}.mp3')
    if not os.path.exists(path):
        raise HTTPException(404, 'Audio not found')
    return FileResponse(path, media_type='audio/mpeg')


@app.get('/xml/{token}')
def xml(token: str):
    path = os.path.join(TMP_DIR, token, f'{token}.xml')
    if not os.path.exists(path):
        raise HTTPException(404, 'XML not found')
    return FileResponse(path, media_type='application/xml')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5000)
