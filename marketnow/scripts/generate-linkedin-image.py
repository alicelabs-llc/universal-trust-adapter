#!/usr/bin/env python3
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# MarketNow — LinkedIn Post Image Generator
# ===========================================
#
# Creates a professional 1200x627 image optimized for LinkedIn posts.
# Design: Dark theme with accent colors, highlighting L2.5 gVisor launch.
#
# Output: /home/z/my-project/marketnow/aep-marketplace/public/linkedin-v25.png

from PIL import Image, ImageDraw, ImageFont
import os

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════

WIDTH, HEIGHT = 1200, 627
OUTPUT_PATH = '/home/z/my-project/marketnow/aep-marketplace/public/linkedin-v25.png'

# Brand colors (from marketnow.site CSS)
BG_DARK = (5, 5, 5)          # #050505 — main background
BG_CARD = (15, 23, 42)       # #0f172a — slate-900 for cards
ACCENT_BLUE = (59, 130, 246) # #3b82f6 — blue-500
ACCENT_GREEN = (34, 197, 94) # #22c553 — green-500
ACCENT_PURPLE = (168, 85, 247)  # #a855f7 — purple-500
ACCENT_ORANGE = (249, 115, 22)  # #f97316 — orange-500
TEXT_WHITE = (255, 255, 255)
TEXT_GRAY = (148, 163, 184)  # slate-400
TEXT_LIGHT = (226, 232, 240)  # slate-200

# Fonts
FONT_DIR_DEJAVU = '/usr/share/fonts/truetype/dejavu/'
FONT_DIR_CARLITO = '/usr/share/fonts/truetype/english/'
FONT_DIR_FREE = '/usr/share/fonts/truetype/freefont/'

def load_font(size, bold=False):
    """Load a font with fallbacks."""
    paths = []
    if bold:
        paths = [
            f'{FONT_DIR_DEJAVU}DejaVuSans-Bold.ttf',
            f'{FONT_DIR_CARLITO}Carlito-Bold.ttf',
            f'{FONT_DIR_FREE}FreeSansBold.ttf',
        ]
    else:
        paths = [
            f'{FONT_DIR_DEJAVU}DejaVuSans.ttf',
            f'{FONT_DIR_CARLITO}Carlito-Regular.ttf',
            f'{FONT_DIR_FREE}FreeSans.ttf',
        ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


# ═══════════════════════════════════════════════════════════════════════════
# Create the image
# ═══════════════════════════════════════════════════════════════════════════

img = Image.new('RGB', (WIDTH, HEIGHT), BG_DARK)
draw = ImageDraw.Draw(img)

# ─── Background gradient effect (top to bottom) ────────────────────────────
for y in range(HEIGHT):
    # Subtle gradient from #050505 to #0a0a1a
    r = 5 + int((y / HEIGHT) * 5)
    g = 5 + int((y / HEIGHT) * 5)
    b = 5 + int((y / HEIGHT) * 15)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

# ─── Decorative accent bar at top ──────────────────────────────────────────
draw.rectangle([(0, 0), (WIDTH, 6)], fill=ACCENT_BLUE)

# ─── Logo/Brand area (top left) ────────────────────────────────────────────
font_brand = load_font(28, bold=True)
font_tagline = load_font(14)
font_headline = load_font(52, bold=True)
font_subhead = load_font(24, bold=True)
font_body = load_font(18)
font_small = load_font(14)
font_stat_num = load_font(36, bold=True)
font_stat_label = load_font(13)
font_badge = load_font(12, bold=True)

# Brand name "MarketNow" with colored dot
draw.text((60, 40), 'MarketNow', font=font_brand, fill=TEXT_WHITE)
# Blue dot accent
draw.ellipse([(245, 48), (260, 63)], fill=ACCENT_BLUE)

# Tagline
draw.text((60, 78), 'Trust layer for agent commerce', font=font_tagline, fill=TEXT_GRAY)

# ─── "NEW" badge (top right) ───────────────────────────────────────────────
badge_x, badge_y = WIDTH - 180, 45
draw.rounded_rectangle([(badge_x, badge_y), (badge_x + 120, badge_y + 28)], radius=14, fill=ACCENT_GREEN)
draw.text((badge_x + 18, badge_y + 6), 'L2.5 LIVE', font=font_badge, fill=BG_DARK)

# ─── Main headline (center-left) ───────────────────────────────────────────
headline_y = 140
draw.text((60, headline_y), 'I audited 8,760 MCP servers', font=font_headline, fill=TEXT_WHITE)
draw.text((60, headline_y + 65), 'with gVisor sandboxes', font=font_headline, fill=ACCENT_BLUE)

# Subheadline
draw.text((60, headline_y + 140), 'Every server now runs in a userspace kernel.', font=font_subhead, fill=TEXT_LIGHT)
draw.text((60, headline_y + 172), 'The MCP server never touches the host kernel.', font=font_subhead, fill=TEXT_LIGHT)

# ─── Stats row (bottom left) ───────────────────────────────────────────────
stats_y = 430
stats = [
    ('8,760+', 'MCP servers\nindexed', ACCENT_BLUE),
    ('6', 'audit layers\n(L1.5 → L2.5)', ACCENT_GREEN),
    ('60+', 'adversarial\ninputs tested', ACCENT_PURPLE),
    ('10/10', 'Anthropic MCP\nscore', ACCENT_ORANGE),
]

stat_x = 60
stat_width = 150
for i, (num, label, color) in enumerate(stats):
    x = stat_x + (i * stat_width)
    # Number
    draw.text((x, stats_y), num, font=font_stat_num, fill=color)
    # Label (split on newline)
    lines = label.split('\n')
    for j, line in enumerate(lines):
        draw.text((x, stats_y + 48 + (j * 16)), line, font=font_stat_label, fill=TEXT_GRAY)

# ─── Right side: Audit layers visualization ────────────────────────────────
# Draw a vertical stack of audit layer cards
layers_x = 720
layers_y = 140
layer_height = 42
layer_spacing = 8

layers = [
    ('L1.5', 'Static analysis', ACCENT_BLUE),
    ('L1.6', 'Pattern analysis', ACCENT_BLUE),
    ('L2.0', 'Active MCP probe', ACCENT_GREEN),
    ('L2.5', 'gVisor sandbox', ACCENT_GREEN),  # Highlighted
    ('L3', 'Firecracker microVM', TEXT_GRAY),
    ('L4', 'Supply chain attestation', TEXT_GRAY),
    ('L5', 'Third-party audit', TEXT_GRAY),
]

for i, (layer_name, desc, color) in enumerate(layers):
    y = layers_y + (i * (layer_height + layer_spacing))

    # Card background
    is_highlighted = (layer_name == 'L2.5')
    if is_highlighted:
        # Highlighted card with accent border
        draw.rounded_rectangle([(layers_x, y), (layers_x + 420, y + layer_height)],
                               radius=6, fill=(20, 40, 30), outline=ACCENT_GREEN, width=2)
    else:
        draw.rounded_rectangle([(layers_x, y), (layers_x + 420, y + layer_height)],
                               radius=6, fill=BG_CARD)

    # Layer name badge
    badge_w = 60
    draw.rounded_rectangle([(layers_x + 8, y + 8), (layers_x + 8 + badge_w, y + layer_height - 8)],
                           radius=4, fill=color)
    # Center the layer name in the badge
    bbox = draw.textbbox((0, 0), layer_name, font=font_badge)
    text_w = bbox[2] - bbox[0]
    text_x = layers_x + 8 + (badge_w - text_w) // 2
    draw.text((text_x, y + 13), layer_name, font=font_badge, fill=BG_DARK)

    # Description
    draw.text((layers_x + 80, y + 13), desc, font=font_body, fill=TEXT_WHITE if is_highlighted else TEXT_LIGHT)

    # Status indicator on the right
    if layer_name in ('L1.5', 'L1.6', 'L2.0', 'L2.5'):
        # Live indicator (green dot)
        draw.ellipse([(layers_x + 395, y + 18), (layers_x + 405, y + 28)], fill=ACCENT_GREEN)
    else:
        # Planned (gray dot)
        draw.ellipse([(layers_x + 395, y + 18), (layers_x + 405, y + 28)], fill=TEXT_GRAY)

# ─── "LIVE" label next to the layers section ───────────────────────────────
draw.text((layers_x, layers_y - 30), 'SENTINEL AUDIT PIPELINE', font=font_small, fill=TEXT_GRAY)
# Small green dot + LIVE
draw.ellipse([(layers_x + 200, layers_y - 26), (layers_x + 210, layers_y - 16)], fill=ACCENT_GREEN)
draw.text((layers_x + 215, layers_y - 30), 'LIVE', font=font_small, fill=ACCENT_GREEN)

# ─── Bottom bar with URL ───────────────────────────────────────────────────
draw.rectangle([(0, HEIGHT - 50), (WIDTH, HEIGHT)], fill=BG_CARD)
draw.text((60, HEIGHT - 38), 'marketnow.site', font=font_body, fill=ACCENT_BLUE)
draw.text((220, HEIGHT - 35), '|  Sentinel L2.5 gVisor sandbox now live', font=font_small, fill=TEXT_GRAY)

# Right side of bottom bar
draw.text((WIDTH - 280, HEIGHT - 35), 'github.com/edgarfloresguerra2011-a11y', font=font_small, fill=TEXT_GRAY)

# ═══════════════════════════════════════════════════════════════════════════
# Save
# ═══════════════════════════════════════════════════════════════════════════

img.save(OUTPUT_PATH, 'PNG', optimize=True)
print(f'✓ LinkedIn image created: {OUTPUT_PATH}')
print(f'  Size: {img.size}')
print(f'  File size: {os.path.getsize(OUTPUT_PATH)} bytes')
