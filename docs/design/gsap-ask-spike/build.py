# Builds index.html: the flat Ask office (tagged export) + props layer + crew + Clerk, door and answer, and the Query room.
r = lambda f: open(f).read()
office = r('ask-room-raw.svg')
office = office.replace('>STAFF<', '>QUERY<')
office = office.replace('viewBox="0 0 1280 600" width="1280" height="600"', 'viewBox="150 0 1060 600" width="1060" height="600"', 1)   # the canvas's zoom
assert 'viewBox="150 0 1060 600"' in office   # the office door leads to the Query room (the canvas now says so too)
assert office.rstrip().endswith('</svg>')
# depth: room, then props lying on furniture, then the crew, then the door overlay, copies, answer and the Clerk
office = office.rstrip()[:-len('</svg>')] + '  <g id="a-props"></g>\n' + r('crew.svgfrag') + r('office-extras.svgfrag') + '</svg>'
# the whiteboard stands on the front planks, in front of everyone who walks past it: draw it last
a = office.index('      <g id="qboard">'); b = office.index('</g>', a) + len('</g>\n')
board, office = office[a:b], office[:a] + office[b:]
office = office.rstrip()[:-len('</svg>')] + board + '</svg>'
page = r('template.html').replace('{{QUERY}}', r('query-room.svg')).replace('{{OFFICE}}', office)
open('index.html', 'w').write(page)
