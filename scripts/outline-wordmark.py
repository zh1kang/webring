"""Regenerate the editable wordmark from Averia Serif Libre Bold.

Each letter is kerned until its outline overlaps the previous one, then all
contours are unioned into one shape, so the letters fuse like a lettered logo.
Requires Python fontTools and skia-pathops.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.qu2cuPen import Qu2CuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.transformPen import TransformPen
import pathops

WORD = 'Firestoners'
HEIGHT = 220
BASELINE = 195
CAP = 247
OVERLAP = 6
ROW = 1


class OutlinePen(BasePen):
    """Flatten an outline into polygons to measure each row's horizontal extent."""

    def __init__(self, glyphs):
        super().__init__(glyphs)
        self.polygons, self.current = [], []

    def _moveTo(self, point):
        self.current = [point]

    def _lineTo(self, point):
        self.current.append(point)

    def _curveToOne(self, a, b, c):
        (x0, y0) = self.current[-1]
        for step in range(1, 13):
            t = step / 12
            u = 1 - t
            self.current.append((
                u ** 3 * x0 + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t ** 3 * c[0],
                u ** 3 * y0 + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t ** 3 * c[1],
            ))

    def _qCurveToOne(self, a, b):
        (x0, y0) = self.current[-1]
        for step in range(1, 9):
            t = step / 8
            u = 1 - t
            self.current.append((u * u * x0 + 2 * u * t * a[0] + t * t * b[0], u * u * y0 + 2 * u * t * a[1] + t * t * b[1]))

    def _closePath(self):
        self.polygons.append(self.current)
        self.current = []

    _endPath = _closePath


def extents(polygons):
    """Return {row: (left, right)} for every scanline the outline crosses."""
    rows = {}
    for polygon in polygons:
        for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]):
            if y0 == y1:
                continue
            low, high = sorted((y0, y1))
            for row in range(int(low // ROW) + 1, int(high // ROW) + 1):
                y = row * ROW
                x = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
                left, right = rows.get(row, (x, x))
                rows[row] = (min(left, x), max(right, x))
    return rows


root = Path(__file__).resolve().parents[1]
font = TTFont(root / 'public/fonts/AveriaSerifLibre-Bold.ttf')
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = CAP / font['head'].unitsPerEm

word = pathops.Path()
previous = {}
x = 0
for letter in WORD:
    glyph = glyphs[cmap[ord(letter)]]
    source = DecomposingRecordingPen(glyphs)
    glyph.draw(source)
    measure = OutlinePen(glyphs)
    source.replay(TransformPen(measure, (scale, 0, 0, -scale, 0, BASELINE)))
    current = extents(measure.polygons)
    if previous:
        gaps = [current[row][0] - previous[row] for row in current if row in previous]
        x = -min(gaps) - OVERLAP if gaps else x
    for row, (_, right) in current.items():
        previous[row] = max(previous.get(row, float('-inf')), right + x)
    path = pathops.Path()
    source.replay(TransformPen(path.getPen(), (scale, 0, 0, -scale, x, BASELINE)))
    word = pathops.op(word, path, pathops.PathOp.UNION)

recording = RecordingPen()
word.draw(Qu2CuPen(recording, max_err=0.4, all_cubic=True))
left, top, right, bottom = word.bounds
margin = 24
commands = []
for operation, points in recording.value:
    values = [[round(px - left + margin, 2), round(py, 2)] for px, py in points]
    commands.append({'type': {'moveTo': 'M', 'lineTo': 'L', 'curveTo': 'C', 'closePath': 'Z'}[operation], 'points': values})
outline = {'width': round(right - left + margin * 2, 2), 'height': HEIGHT, 'commands': commands}
(root / 'src/wordmark-outline.json').write_text(json.dumps(outline, separators=(',', ':')) + '\n')
print(f'{len(commands)} commands, {outline["width"]} x {HEIGHT}, top {top:.1f}, bottom {bottom:.1f}')
