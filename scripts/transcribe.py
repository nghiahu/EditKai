"""Word-level transcription with faster-whisper. Usage: transcribe.py <video> <out.json>"""
import json, os, sys
from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
model = WhisperModel(os.environ.get("EDITKAI_WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
segments, _ = model.transcribe(src, language=os.environ.get("EDITKAI_LANG", "vi"), word_timestamps=True, vad_filter=True)
words = [{"t": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for seg in segments for w in (seg.words or []) if w.word.strip()]
with open(out, "w", encoding="utf-8") as f:
    json.dump({"words": words}, f, ensure_ascii=False)
print(f"{len(words)} words", file=sys.stderr)
