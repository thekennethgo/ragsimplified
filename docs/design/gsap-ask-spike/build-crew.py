# Builds crew.svgfrag: Scout, Judge, Translator, Storyteller as animatable groups with carried props.
import subprocess, re
P = '../upload-page/project/'   # the canvas files

def tag(src, p):
    for a, b in [('<g transform="{{flip}}">', f'<g id="{p}-flip">'),
                 ('<g opacity="{{armDown}}">', f'<g id="{p}-arm-down" opacity="{{{{armDown}}}}">'),
                 ('<g opacity="{{armUp}}">', f'<g id="{p}-arm-up" opacity="{{{{armUp}}}}">'),
                 ('<g opacity="{{toolDown}}">', f'<g id="{p}-tool-down" opacity="{{{{toolDown}}}}">'),
                 ('<g opacity="{{doneMark}}">', f'<g id="{p}-check" opacity="{{{{doneMark}}}}">')]:
        assert src.count(a) == 1, (p, a)
        src = src.replace(a, b)
    return src

def add_props(svg, p, props):
    i = svg.index(f'<g id="{p}-check"')
    j = svg.rindex('</g>', 0, i)          # closes the flip group
    return svg[:j] + props + svg[j:]

def export(name, gid, p, facing, props):
    src = tag(open(P + f'Char{name}.dc.html').read(), p)
    open(f'Char{name}.tagged.dc.html', 'w').write(src)
    out = subprocess.run(['node', 'export-char.js', f'Char{name}.tagged.dc.html', gid, '40', '116',
                          '{"state":"waiting","facing":"%s"}' % facing], capture_output=True, text=True, check=True).stdout
    out = out.replace(' transform="translate(0 0)"', '')
    return add_props(out, p, props)

PAPER = 'fill="#F7F2E8" stroke="#B8AD98" stroke-width="0.7"'
scout = export('Scout', 'scout', 'sc', 'left', f'''
      <g id="sc-held-slip" opacity="0"><rect x="6" y="84" width="14" height="6" rx="0.8" {PAPER}></rect><path d="M8 87 H17" stroke="#6F8FA3" stroke-width="0.9"></path></g>
      <g id="sc-held-stack" opacity="0">
        <rect x="0" y="76" width="28" height="22" rx="1" fill="#E6DDCB" stroke="#B8AD98" stroke-width="0.7"></rect>
        <path d="M0 80 H28 M0 84 H28 M0 88 H28 M0 92 H28" stroke="#C9BFA8" stroke-width="0.8"></path>
        <rect x="2" y="72" width="26" height="6" rx="1" {PAPER}></rect>
        <rect x="18" y="70" width="8" height="4" rx="0.6" fill="#9FC4D9"></rect><rect x="4" y="70" width="7" height="4" rx="0.6" fill="#F2B25E"></rect>
      </g>
''')
judge = export('Judge', 'judge', 'jd', 'right', f'''
      <g id="jd-held-rejects" opacity="0">
        <rect x="0" y="84" width="26" height="14" rx="1" fill="#E6DDCB" stroke="#B8AD98" stroke-width="0.7" transform="rotate(-6 13 91)"></rect>
        <path d="M2 88 H24 M2 92 H24" stroke="#C9BFA8" stroke-width="0.8"></path>
      </g>
      <g id="jd-held-kept" opacity="0">
        <rect x="4" y="76" width="18" height="10" rx="0.8" {PAPER}></rect>
        <path d="M6 79 H18 M6 82 H16" stroke="#6F8FA3" stroke-width="0.8"></path>
        <path d="M17 75 V80" stroke="#9AA0A6" stroke-width="1.6" stroke-linecap="round"></path>
      </g>
''')
story = export('Storyteller', 'storyteller', 'st', 'right', '')
tr = open('../gsap-spike/translator.svgfrag').read()
i = tr.index('<g id="tr-check"'); j = tr.rindex('</g>', 0, i)
tr = tr[:j] + f'''  <g id="tr-held-slip" opacity="0"><rect x="6" y="84" width="14" height="6" rx="0.8" {PAPER}></rect><path d="M8 87 H17" stroke="#6F8FA3" stroke-width="0.9"></path></g>
    ''' + tr[j:]
tr = tr.replace('<!-- Translator, exported from CharTranslator.dc.html (80x120 local box, feet at 40,116). GSAP moves #translator. -->',
                '<!-- Translator, from CharTranslator.dc.html. Feet at 40,116. -->')
# depth order by feet: Scout (314), Judge (396), Translator (410), Storyteller (546); the Clerk comes after.
open('crew.svgfrag', 'w').write(scout + judge + tr + story)
