#!/usr/bin/env python3
"""crop.py PAGE X0 X1 Y0 Y1 OUT
Fractions (0-1) of the rotated page image pages/pPAGE.png (4200x2800).
Output = the row-label strip glued to the chosen x-range, over the same y-range."""
import sys, subprocess, os
P, X0, X1, Y0, Y1, OUT = sys.argv[1], *map(float, sys.argv[2:6]), sys.argv[6]
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pages', f'p{P}.png')
W, H = 4200, 2800
y0, h = int(Y0*H), int((Y1-Y0)*H)
lx, lw = int(0.07*W), int(0.165*W)
x0, w = int(X0*W), int((X1-X0)*W)
subprocess.run(['magick', '(', src, '-crop', f'{lw}x{h}+{lx}+{y0}', '+repage', ')',
                '(', src, '-crop', f'{w}x{h}+{x0}+{y0}', '+repage', ')', '+append', OUT], check=True)
