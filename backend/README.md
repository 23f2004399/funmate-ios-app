# Face Detection Backend

Flask API for face detection using InsightFace buffalo_l model.

## Setup

1. **Install Python 3.8+** (if not already installed)

2. **Create virtual environment:**
```bash
cd backend
python -m venv venv
```

3. **Activate virtual environment:**

**Windows (PowerShell):**
```bash
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```bash
venv\Scripts\activate.bat
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

4. **Install dependencies:**
```bash
pip install -r requirements.txt
```

## Running the Server

```bash
python app.py
```

Server will start on: `http://localhost:5000`

## API Endpoints

### Health Check
```
GET http://localhost:5000/health
```

Response:
```json
{
  "status": "ok",
  "service": "face-detection-api",
  "model": "insightface-buffalo_l"
}
```

### Detect Face
```
POST http://localhost:5000/detect-face
Content-Type: multipart/form-data
Body: image file
```

Response (Success):
```json
{
  "decision": "ACCEPTED",
  "faces_count": 1,
  "faces": [
    {
      "bbox": [100, 150, 300, 450],
      "score": 0.95,
      "size": {
        "width": 200,
        "height": 300
      }
    }
  ],
  "message": "Face detected and validated"
}
```

Response (No Face):
```json
{
  "decision": "REJECTED",
  "faces_count": 0,
  "faces": [],
  "message": "No valid face detected"
}
```

## Testing with curl

```bash
curl -X POST http://localhost:5000/detect-face -F "image=@path/to/photo.jpg"
```

## Integration with React Native

From Android Emulator:
```
http://10.0.2.2:5000/detect-face
```

From Real Device (same WiFi):
```
http://YOUR_COMPUTER_IP:5000/detect-face
```

Find your IP:
- Windows: `ipconfig`
- Mac/Linux: `ifconfig`

## Model Details

- **Model:** InsightFace buffalo_l
- **Detection threshold:** 0.60
- **Minimum face size:** 20x20 pixels
- **Provider:** CPU (ONNX Runtime)

## Notes

- First request may be slow (model loading)
- Subsequent requests are faster (model cached)
- Model files downloaded to `~/.insightface/models/`
