# OpenCV.js Integration

This directory should contain OpenCV.js related files for client-side face detection.

## Required Files

Copy the following file from `frontend/public/` to this directory:
- `haarcascade_frontalface_default.xml` - Haar Cascade classifier for face detection

## Usage

The cascade file is automatically loaded by `useOpenCVWebcam` hook when face detection is enabled.

## Manual Copy Command

```bash
copy "frontend\public\haarcascade_frontalface_default.xml" "frontends\exam-ui\public\"
```
