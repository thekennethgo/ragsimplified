# Copy OfficeAsk.dc.html with ids added to the parts the scenes animate (the canvas file is not changed).
import sys
src = open(sys.argv[1]).read()
def rep(a, b, count=1):
    global src
    assert src.count(a) == count, (src.count(a), a)
    src = src.replace(a, b)
rep('<g opacity="{{rankOpacity}}">\n        <path d="{{geo.dKept}}"', '<g id="d-kept" opacity="{{rankOpacity}}">\n        <path d="{{geo.dKept}}"')
rep('<g opacity="{{beamOpacity}}">', '<g id="lantern-beam" opacity="{{beamOpacity}}">')
rep('r="16" fill="#FFD98A" opacity="{{beamOpacity}}">', 'r="16" fill="#FFD98A" id="lantern-glow" opacity="{{beamOpacity}}">')
rep('<path d="{{geo.crtText}}"', '<path id="crt-text-idle" d="{{geo.crtText}}"')
rep('      <g>\n        <animateTransform attributeName="transform" type="translate" values="{{trShake}}"',
    '      <g id="printer">\n        <animateTransform attributeName="transform" type="translate" values="{{trShake}}"')
rep('<g opacity="{{trWorkOpacity}}">', '<g id="tr-work">')
rep('<path d="{{geo.inCard}}"', '<path id="tr-in-card" opacity="0" d="{{geo.inCard}}"')
rep('<path d="{{geo.cursor}}"', '<path id="crt-cursor" opacity="0" d="{{geo.cursor}}"')
for i in range(5):
    rep('<path d="{{geo.crtLines.%d}}"' % i, '<path class="crt-line" opacity="0" d="{{geo.crtLines.%d}}"' % i)
for i in range(4):
    rep('<path d="{{geo.bar.%d}}"' % i, '<path class="crt-bar" opacity="0" d="{{geo.bar.%d}}"' % i)
rep('<path d="{{geo.led}}"', '<path id="printer-led" opacity="0.3" d="{{geo.led}}"')
rep('<g opacity="{{rankOpacity}}"><path d="{{geo.keptStack.fy}}"', '<g id="kept-stack" opacity="{{rankOpacity}}"><path d="{{geo.keptStack.fy}}"')
rep('<path d="{{geo.magHandle}}"', '<path id="desk-mag-handle" d="{{geo.magHandle}}"')
rep('<ellipse cx="{{geo.magLens.x}}"', '<ellipse id="desk-mag-lens" cx="{{geo.magLens.x}}"')
rep('<g opacity="{{answerOpacity}}" fill="#7A5236">', '<g id="answer-dots" opacity="{{answerOpacity}}" fill="#7A5236">')
rep('      <path d="{{geo.paper}}" fill="#F2EBDD"></path>', '      <g id="typewriter">\n      <path d="{{geo.paper}}" fill="#F2EBDD"></path>')
rep('<path d="{{geo.paperLines}}"', '<path id="typer-lines-static" d="{{geo.paperLines}}"')
rep('      <path d="{{geo.keyDots}}" fill="#EFE6D6" stroke="#1E1A17" stroke-width="0.8"></path>',
    '      <path id="key-dots" d="{{geo.keyDots}}" fill="#EFE6D6" stroke="#1E1A17" stroke-width="0.8"></path>\n      <g id="typed-lines"></g>\n      </g>')
rep('<path d="{{geo.sdesk.fy}}"', '<path id="sdesk" d="{{geo.sdesk.fy}}"')
rep('      <path d="{{geo.bFeet}}"', '      <g id="qboard">\n      <path d="{{geo.bFeet}}"')
rep('<path d="{{geo.bKnobs}}" fill="#1E1A17"></path>', '<path d="{{geo.bKnobs}}" fill="#1E1A17"></path>\n      </g>')
# no stamp table in the Ask office: drop the table, blotter, ink pad and the stamped printout on it
before = src.count('\n')
src = '\n'.join(l for l in src.split('\n')
                if not any(k in l for k in ('{{geo.stampT.', '{{geo.blotter}}', '{{geo.inkPad.', '{{geo.inkFelt}}', 'opacity="{{printOpacity}}"')))
assert before - src.count('\n') in (0, 5), before - src.count('\n')   # 0: the canvas already dropped it
sys.stdout.write(src)
