"""Generate animation paths from public/crest.svg. Preserve the original geometry."""
import json
from pathlib import Path
from xml.etree import ElementTree

root = Path(__file__).resolve().parents[1]
svg = ElementTree.parse(root / 'public/crest.svg')
paths = [{'d': node.attrib['d'], 'fill': node.attrib['fill']} for node in svg.iter('{http://www.w3.org/2000/svg}path')]
(root / 'src/crest-paths.json').write_text(json.dumps(paths, separators=(',', ':')) + '\n')
