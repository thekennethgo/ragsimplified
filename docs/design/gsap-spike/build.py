# Builds index.html: room SVG + drawer overlay + characters, injected into template.html.
svg = open('upload-room.svg').read()
r = lambda f: open(f).read()
assert '<g id="label-maker">' in svg and '<g id="spots"' in svg
svg = svg.replace('<g id="label-maker">', r('drawer.svgfrag') + '  <g id="label-maker">', 1)
svg = svg.replace('<g id="spots"', r('translator.svgfrag') + r('chars.svgfrag') + '  <g id="spots"', 1)
open('index.html', 'w').write(r('template.html').replace('{{SVG}}', svg))
