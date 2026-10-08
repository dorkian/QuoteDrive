"""Writes the fictional customer logo marks to public/logos/<slug>.svg.

Original geometric marks drawn for this demo (no real brands, no external assets).
Run: python3 scripts/make_logos.py
"""
import pathlib
import re

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "logos"

# name -> (gradient from, gradient to, glyph drawn in white on a 96x96 tile)
W = 'fill="#fff"'
S = 'fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"'
LOGOS = {
    "Lombarda Studio Group": ("#6d5ae6", "#9085e9", f'<path d="M30 70V26h10v34h26v10z" {W}/><circle cx="66" cy="32" r="7" {W}/>'),
    "Cedar & Pine Logistics": ("#127a55", "#199e70", f'<path d="M48 22 66 48H56l12 18H28l12-18H30z" {W}/><rect x="44" y="66" width="8" height="10" {W}/>'),
    "Harbor Freight Cooperative": ("#2b6fc9", "#3987e5", f'<circle cx="48" cy="28" r="6" {S}/><path d="M48 34v38M32 46h32M28 60c4 10 12 14 20 14s16-4 20-14" {S}/>'),
    "Alder Health Network": ("#0f9a8a", "#2dbfa8", f'<path d="M40 24h16v16h16v16H56v16H40V56H24V40h16z" {W}/>'),
    "Brightwater Utilities": ("#1d6fb8", "#35a0e0", f'<path d="M48 22C48 22 30 44 30 58a18 18 0 0 0 36 0C66 44 48 22 48 22z" {W}/>'),
    "Kestrel Biotech Campus": ("#3b8f3a", "#6cbf4a", f'<path d="M34 28c14 4 28 18 28 40M62 28c-14 4-28 18-28 40" {S}/><circle cx="48" cy="48" r="5" {W}/>'),
    "Meridian Law Partners": ("#2a3a5c", "#4a5f8f", f'<path d="M48 22v52M30 72h36M26 36h44M26 36l-8 20h16zM70 36l-8 20h16z" {S}/>'),
    "Solace Hospitality Group": ("#d95926", "#f08a4b", f'<circle cx="48" cy="48" r="11" {W}/><path d="M48 20v10M48 66v10M20 48h10M66 48h10M28 28l7 7M61 61l7 7M68 28l-7 7M35 61l-7 7" {S}/>'),
    "Tidewater Insurance Services": ("#1f5f8a", "#3d8fc0", f'<path d="M48 20 70 29v18c0 14-9 24-22 30-13-6-22-16-22-30V29z" {W}/><path d="M38 47l8 8 14-16" fill="none" stroke="#1f5f8a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
    "Skyline Aviation Services": ("#3466c9", "#5b8ff0", f'<path d="M20 52 76 26 58 76 48 56z" {W}/>'),
    "Vantage Media Studios": ("#c2377e", "#e87ba4", f'<path d="M36 26l34 22-34 22z" {W}/>'),
    "Peregrine Outdoor Co": ("#8a5a2b", "#c98500", f'<path d="M18 70 38 38l10 14 10-20 22 38z" {W}/>'),
    "Northgate University": ("#7a1f3d", "#b4375f", f'<path d="M48 24 22 38l26 14 26-14z" {W}/><path d="M32 50v14c8 8 24 8 32 0V50" fill="none" stroke="#fff" stroke-width="6"/>'),
    "Orchard Retail Collective": ("#c4382e", "#ee6a4e", f'<path d="M24 38h48l-5 36H29z" {W}/><path d="M36 38c0-14 24-14 24 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>'),
    "Quarry & Co": ("#4b5563", "#7b8794", f'<path d="M20 70 36 40l12 16 14-30 14 44z" {W}/><path d="M26 76h44" {S}/>'),
    "Fernhill Council Services": ("#2f6f4e", "#4f9f76", f'<path d="M24 74h48M30 74V44M44 74V44M58 74V44M72 74V44M22 44h52L48 24z" {S}/>'),
}


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


for name, (a, b, glyph) in LOGOS.items():
    sid = slug(name)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">'
        f"<title>{name.replace('&', '&amp;')} logo (fictional)</title>"
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/>'
        f'<stop offset="1" stop-color="{b}"/></linearGradient></defs>'
        f'<rect width="96" height="96" rx="22" fill="url(#g)"/>{glyph}</svg>\n'
    )
    (OUT / f"{sid}.svg").write_text(svg)
print(f"wrote {len(LOGOS)} logos to {OUT}")
