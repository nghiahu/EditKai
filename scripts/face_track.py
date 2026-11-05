"""Finds the largest face in a video, a few times per second, on this machine only (no image leaves it).
Usage: face_track.py <video> <out.json> [--fps 4] [--model models/version-RFB-320.onnx]
Writes { fps, samples: [{ t, box: { x, y, w, h } | null, conf }] }; the box is a share (0-1) of the frame width and height.
Model: Ultra-Light-Fast-Generic-Face-Detector-1MB, RFB-320 (MIT, see models/LICENSE-ultraface.txt)."""
import argparse, json, os, subprocess, sys
import numpy as np

W, H = 320, 240            # the size the model takes
THRESHOLD = 0.7            # face score
NMS_IOU = 0.3              # boxes overlapping more than this are one face
here = os.path.dirname(os.path.abspath(__file__))

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("out")
ap.add_argument("--fps", type=float, default=4)
ap.add_argument("--model", default=os.path.join(here, "..", "models", "version-RFB-320.onnx"))
args = ap.parse_args()

if not os.path.exists(args.video):
    sys.exit(f"Không tìm thấy video {args.video}")
if not os.path.exists(args.model):
    sys.exit(f"Không tìm thấy mô hình mặt {args.model} (xem models/ và docs của đợt 1)")

import onnxruntime as ort
ort.set_default_logger_severity(4)
session = ort.InferenceSession(args.model, providers=["CPUExecutionProvider"])


def nms(boxes, scores):
    order = scores.argsort()[::-1]
    keep = []
    while len(order):
        i = order[0]
        keep.append(i)
        rest = order[1:]
        if not len(rest):
            break
        x1 = np.maximum(boxes[i, 0], boxes[rest, 0]); y1 = np.maximum(boxes[i, 1], boxes[rest, 1])
        x2 = np.minimum(boxes[i, 2], boxes[rest, 2]); y2 = np.minimum(boxes[i, 3], boxes[rest, 3])
        inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
        area = lambda b: (b[..., 2] - b[..., 0]) * (b[..., 3] - b[..., 1])
        order = rest[inter / (area(boxes[i]) + area(boxes[rest]) - inter + 1e-9) < NMS_IOU]
    return keep


def largest_face(frame):
    x = ((frame.astype(np.float32) - 127) / 128).transpose(2, 0, 1)[None]
    scores, boxes = session.run(None, {"input": x})
    scores, boxes = scores[0, :, 1], boxes[0]
    mask = scores > THRESHOLD
    if not mask.any():
        return None, 0.0
    boxes, scores = boxes[mask], scores[mask]
    keep = nms(boxes, scores)
    areas = [(boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1]) for i in keep]
    i = keep[int(np.argmax(areas))]
    x1, y1, x2, y2 = (float(np.clip(v, 0, 1)) for v in boxes[i])
    return {"x": round(x1, 4), "y": round(y1, 4), "w": round(x2 - x1, 4), "h": round(y2 - y1, 4)}, round(float(scores[i]), 3)


ffmpeg = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-i", args.video, "-an", "-vf", f"fps={args.fps},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    stdout=subprocess.PIPE,
)
samples = []
size = W * H * 3
while True:
    buf = ffmpeg.stdout.read(size)
    if len(buf) < size:
        break
    box, conf = largest_face(np.frombuffer(buf, np.uint8).reshape(H, W, 3))
    samples.append({"t": round(len(samples) / args.fps, 4), "box": box, "conf": conf})
if ffmpeg.wait() != 0:
    sys.exit(f"ffmpeg không đọc được {args.video}")

with open(args.out, "w", encoding="utf-8") as f:
    json.dump({"fps": args.fps, "samples": samples}, f)
print(f"{sum(1 for s in samples if s['box'])}/{len(samples)} mẫu có mặt", file=sys.stderr)
