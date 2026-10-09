"""Writes an original, copyright-free ambient backing track for the demo video.

Synthesised from scratch with the Python standard library (sine and soft saw tones, no samples,
no downloaded audio), so there is nothing to license or to trip YouTube's Content ID.
Usage: python3 demo/make_music.py <seconds> <out.wav>
"""
import math
import random
import struct
import sys
import wave
from array import array

SR = 32000
BPM = 78
BEAT = 60 / BPM
BAR = BEAT * 4
random.seed(7)

# A minor loop: Am9 - Fmaj7 - Cmaj7 - G6 (MIDI note numbers)
CHORDS = [
    [57, 60, 64, 67, 71],
    [53, 57, 60, 64, 67],
    [60, 64, 67, 71, 74],
    [55, 59, 62, 64, 67],
]


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def pad_note(freq, dur):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    att, rel = min(2.2, dur / 3), min(2.6, dur / 3)
    for detune in (-0.0035, 0.0, 0.0035):
        f = freq * (1 + detune)
        w = 2 * math.pi * f / SR
        for i in range(n):
            t = i / SR
            env = min(1.0, t / att, (dur - t) / rel)
            s = math.sin(w * i) + 0.35 * math.sin(2 * w * i) + 0.12 * math.sin(3 * w * i)
            out[i] += 0.05 * s * env * env
    return out


def pluck(freq, dur=1.8):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    w = 2 * math.pi * freq / SR
    for i in range(n):
        t = i / SR
        env = math.exp(-t * 3.2) * min(1.0, t / 0.004)
        out[i] = 0.16 * env * (math.sin(w * i) + 0.4 * math.sin(2 * w * i) * math.exp(-t * 4))
    return out


def bass_note(freq, dur):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    w = 2 * math.pi * freq / SR
    for i in range(n):
        t = i / SR
        env = min(1.0, t / 0.08, (dur - t) / 0.6)
        out[i] = 0.2 * env * math.sin(w * i)
    return out


def add(mix, buf, start):
    s = int(start * SR)
    end = min(len(mix), s + len(buf))
    for i in range(s, end):
        mix[i] += buf[i - s]


def main(seconds, path):
    total = int(seconds * SR)
    mix = array("f", [0.0]) * total
    bars = int(seconds / BAR) + 1
    plucks = {}
    for b in range(bars):
        chord = CHORDS[b % 4]
        t0 = b * BAR
        last = t0 + BAR > seconds - 6
        for m in chord[:4]:
            add(mix, pad_note(hz(m), BAR + 2.2), t0)
        if b >= 8:  # arpeggio joins after the pad has established itself
            notes = [chord[i] + 12 for i in (0, 2, 1, 3, 2, 4, 3, 1)]
            for k, m in enumerate(notes):
                if last and k % 2:
                    continue
                if random.random() < 0.12:
                    continue
                buf = plucks.setdefault(m, pluck(hz(m)))
                add(mix, buf, t0 + k * BEAT / 2)
        if 24 <= b and not last:  # soft bass on the root
            add(mix, bass_note(hz(chord[0] - 12), BAR * 0.95), t0)
        if 48 <= b < bars - 10 and b % 2 == 0:  # occasional high bell
            m = chord[4] + 12
            buf = plucks.setdefault(m, pluck(hz(m), 2.6))
            add(mix, buf, t0 + BEAT * 1.5)
    peak = max(max(mix), -min(mix)) or 1
    scale = 0.85 / peak
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * scale)) * 32767)) for v in mix))


if __name__ == "__main__":
    main(float(sys.argv[1]), sys.argv[2])
