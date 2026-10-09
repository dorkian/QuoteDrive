"""Writes an original, copyright-free electronic backing track for the demo video.

Synthesised from scratch with the Python standard library (oscillators, noise and envelopes, no
samples and no downloaded audio), so there is nothing to license or to trip YouTube's Content ID.
The track has an arc: a sparse intro, a groove, a breakdown, two driving sections with a riser into
each, a calm middle, and an outro. That gives the demo ups and downs, like a day of work.

Usage: python3 demo/make_music.py <seconds> <out.wav>
"""
import math
import random
import struct
import sys
import wave
from array import array

SR = 32000
BPM = 112
BEAT = 60 / BPM
BAR = BEAT * 4
STEP = BEAT / 4  # sixteenth note
random.seed(11)

# F minor loop: Fm7 - Dbmaj7 - Abmaj7 - Ebadd9. Each: bass root, arp/pad tones (MIDI).
CHORDS = [
    (41, [53, 56, 60, 63]),
    (37, [49, 53, 56, 60]),
    (44, [56, 60, 63, 67]),
    (39, [51, 55, 58, 62]),
]
LEAD = [  # lead motif per chord, as (sixteenth offset, chord-tone index, octave shift)
    [(0, 3, 12), (6, 2, 12), (8, 3, 12), (12, 1, 12)],
    [(0, 2, 12), (4, 3, 12), (8, 2, 12), (14, 1, 12)],
    [(0, 3, 12), (6, 1, 24), (10, 2, 12), (14, 0, 24)],
    [(0, 1, 24), (4, 0, 24), (8, 3, 12), (12, 2, 12)],
]


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def tone(freq, dur, harmonics, decay, attack=0.004, release=0.02):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    w = 2 * math.pi * freq / SR
    for i in range(n):
        t = i / SR
        env = min(1.0, t / attack, max(0.0, (dur - t) / release)) * math.exp(-t * decay)
        s = 0.0
        for h, a in harmonics:
            s += a * math.sin(w * h * i)
        out[i] = s * env
    return out


BRIGHT = {
    0: [(1, 1.0), (2, 0.25)],
    1: [(1, 1.0), (2, 0.5), (3, 0.28), (4, 0.12)],
    2: [(1, 1.0), (2, 0.7), (3, 0.5), (4, 0.35), (5, 0.2), (6, 0.12)],
}
_cache = {}


def arp_note(m, bright):
    key = ("arp", m, bright)
    if key not in _cache:
        _cache[key] = tone(hz(m), STEP * 1.6, BRIGHT[bright], 7.0)
        for i in range(len(_cache[key])):
            _cache[key][i] *= 0.11
    return _cache[key]


def lead_note(m):
    key = ("lead", m)
    if key not in _cache:
        n = int(BEAT * 1.1 * SR)
        out = array("f", [0.0]) * n
        w = 2 * math.pi * hz(m) / SR
        for i in range(n):
            t = i / SR
            vib = 1 + 0.004 * math.sin(2 * math.pi * 5.5 * t) * min(1.0, t / 0.25)
            env = min(1.0, t / 0.02, (n / SR - t) / 0.2) * math.exp(-t * 1.2)
            out[i] = 0.1 * env * (math.sin(w * vib * i) + 0.3 * math.sin(2 * w * vib * i))
        _cache[key] = out
    return _cache[key]


def pad_note(m, dur):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    att, rel = min(0.9, dur / 3), min(1.2, dur / 3)
    for detune in (-0.004, 0.004):
        w = 2 * math.pi * hz(m) * (1 + detune) / SR
        for i in range(n):
            t = i / SR
            env = min(1.0, t / att, (dur - t) / rel)
            out[i] += 0.035 * env * env * (math.sin(w * i) + 0.4 * math.sin(2 * w * i))
    return out


def bass_note(m, dur):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    w = 2 * math.pi * hz(m) / SR
    lp = 0.0
    for i in range(n):
        t = i / SR
        env = min(1.0, t / 0.005, (dur - t) / 0.03)
        saw = 2 * ((hz(m) * t) % 1.0) - 1
        lp += 0.12 * (saw - lp)  # one-pole low-pass: warm, not buzzy
        out[i] = 0.3 * env * (lp + 0.7 * math.sin(w * i))
    return out


def kick():
    n = int(0.28 * SR)
    out = array("f", [0.0]) * n
    ph = 0.0
    for i in range(n):
        t = i / SR
        f = 45 + 95 * math.exp(-t * 28)
        ph += 2 * math.pi * f / SR
        out[i] = 0.55 * math.sin(ph) * math.exp(-t * 11)
    return out


def noise(dur, decay, hp=True, amp=0.2):
    n = int(dur * SR)
    out = array("f", [0.0]) * n
    prev = 0.0
    for i in range(n):
        x = random.uniform(-1, 1)
        v = (x - prev) if hp else x
        prev = x
        out[i] = amp * v * math.exp(-i / SR * decay)
    return out


def add(mix, buf, start, gain=1.0):
    s = int(start * SR)
    if s < 0:
        return
    end = min(len(mix), s + len(buf))
    for i in range(s, end):
        mix[i] += buf[i - s] * gain


def section(bar, bars):
    """Which layers play in a bar: this is the 'ups and downs'."""
    outro = bars - 10
    L = dict(pad=True, arp=-1, bass=False, drums=0, lead=False, octave=False)
    if bar < 8:
        L.update(arp=0 if bar >= 4 else -1)
    elif bar < 24:
        L.update(arp=1, bass=True, drums=1)
    elif bar < 32:
        L.update(arp=0, lead=bar >= 28)
    elif bar < 56:
        L.update(arp=2, bass=True, drums=2, lead=bar % 8 >= 4)
    elif bar < 64:
        L.update(arp=0 if bar < 60 else 1, lead=True)
    elif bar < 96:
        L.update(arp=2, bass=True, drums=2, lead=True, octave=bar % 8 >= 4)
    elif bar < outro:
        L.update(arp=1, bass=True, drums=1)
    elif bar < outro + 4:
        L.update(arp=0, drums=0)
    else:
        L.update(arp=-1)
    return L


def main(seconds, path):
    total = int(seconds * SR)
    music = array("f", [0.0]) * total
    drums = array("f", [0.0]) * total
    bars = int(seconds / BAR) + 1
    k, hat, clap = kick(), noise(0.05, 70, amp=0.12), noise(0.16, 22, hp=False, amp=0.16)
    for b in range(bars):
        t0 = b * BAR
        if t0 >= seconds:
            break
        root, tones = CHORDS[b % 4]
        L = section(b, bars)
        for m in tones:
            add(music, pad_note(m, BAR + 0.5), t0)
        if L["arp"] >= 0:
            order = [0, 1, 2, 3, 2, 1, 3, 2, 1, 0, 2, 3, 1, 2, 0, 3]
            for s in range(16):
                if random.random() < 0.1:
                    continue
                m = tones[order[s]] + 12
                add(music, arp_note(m, L["arp"]), t0 + s * STEP)
                if L["octave"]:
                    add(music, arp_note(m + 12, 1), t0 + s * STEP, 0.5)
        if L["bass"]:
            for s in range(0, 16, 2):
                if s in (6, 14) and random.random() < 0.5:
                    continue
                add(music, bass_note(root, STEP * 1.8), t0 + s * STEP)
        if L["lead"]:
            for off, idx, shift in LEAD[b % 4]:
                add(music, lead_note(tones[idx] + shift), t0 + off * STEP)
        if L["drums"]:
            for beat in range(4):
                add(drums, k, t0 + beat * BEAT)
            for s in range(2, 16, 4):
                add(drums, hat, t0 + s * STEP)
            if L["drums"] == 2:
                for s in range(4, 16, 8):
                    add(drums, clap, t0 + s * STEP)
                for s in range(1, 16, 2):
                    add(drums, hat, t0 + s * STEP, 0.35)
        # riser into each new section: filtered noise swelling over the last bar
        if b + 1 in (8, 32, 64) or (b + 1 == 24):
            n = int(BAR * SR)
            prev = 0.0
            start = int(t0 * SR)
            for i in range(min(n, total - start)):
                x = random.uniform(-1, 1)
                v = (x - prev) * (i / n) ** 2 * 0.1
                prev = x
                music[start + i] += v
    # sidechain: the music ducks on every kick so the beat breathes
    kick_gain = array("f", [1.0]) * total
    for b in range(bars):
        L = section(b, bars)
        if not L["drums"]:
            continue
        for beat in range(4):
            s = int((b * BAR + beat * BEAT) * SR)
            for i in range(min(int(0.22 * SR), total - s)):
                kick_gain[s + i] = min(kick_gain[s + i], 0.35 + 0.65 * (1 - math.exp(-i / SR * 14)))
    mix = array("f", [music[i] * kick_gain[i] + drums[i] for i in range(total)])
    peak = max(max(mix), -min(mix)) or 1
    scale = 0.85 / peak
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * scale)) * 32767)) for v in mix))


if __name__ == "__main__":
    main(float(sys.argv[1]), sys.argv[2])
