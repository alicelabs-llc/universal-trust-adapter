#!/usr/bin/env python3
"""
Generate the comprehensive audit report PDF.

Structure (50+ pages):
  - Cover
  - Executive Summary
  - Audit Methodology
  - Scope
  - Findings F1-F8 (each with: Description, Evidence, Impact, Fix, Diff before/after)
  - Remediation Plan (P0/P1/P2 prioritized)
  - Deploy Guide (Vercel CLI step-by-step)
  - Recommendations
  - Appendix: Files in this package

Uses ReportLab with a professional audit/security color palette.
"""
import json
import os
import sys
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Image, KeepTogether, ListFlowable, ListItem,
    HRFlowable, Frame, PageTemplate, BaseDocTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ============================================================================
# FONT REGISTRATION
# ============================================================================
FONT_PATHS = {
    'BodySerif': '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf',
    'BodySerif-Bold': '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf',
    'HeadingSans': '/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf',
    'HeadingSans-Bold': '/usr/share/fonts/truetype/chinese/NotoSansSC-Bold.ttf',
    'Mono': '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    'Mono-Bold': '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
}
for name, path in FONT_PATHS.items():
    if Path(path).exists():
        try:
            pdfmetrics.registerFont(TTFont(name, path))
        except Exception as e:
            print(f"WARN: Could not register {name}: {e}", file=sys.stderr)

# Fallbacks
BODY = 'BodySerif' if 'BodySerif' in pdfmetrics.getRegisteredFontNames() else 'Times-Roman'
BODY_B = 'BodySerif-Bold' if 'BodySerif-Bold' in pdfmetrics.getRegisteredFontNames() else 'Times-Bold'
HEAD = 'HeadingSans-Bold' if 'HeadingSans-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold'
HEAD_REG = 'HeadingSans' if 'HeadingSans' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
MONO = 'Mono' if 'Mono' in pdfmetrics.getRegisteredFontNames() else 'Courier'
MONO_B = 'Mono-Bold' if 'Mono-Bold' in pdfmetrics.getRegisteredFontNames() else 'Courier-Bold'

# ============================================================================
# COLOR PALETTE — Audit / Security theme
# ============================================================================
COLORS = {
    'bg': HexColor('#FFFFFF'),
    'ink': HexColor('#0F172A'),         # near-black slate
    'ink_soft': HexColor('#334155'),    # secondary text
    'rule': HexColor('#CBD5E1'),        # divider lines
    'cover_bg': HexColor('#0B1220'),    # dark navy cover
    'cover_fg': HexColor('#F8FAFC'),
    'cover_accent': HexColor('#22D3EE'),  # cyan accent
    'p0': HexColor('#DC2626'),           # critical red
    'p0_bg': HexColor('#FEE2E2'),
    'p1': HexColor('#EA580C'),           # high orange
    'p1_bg': HexColor('#FFEDD5'),
    'p2': HexColor('#CA8A04'),           # medium yellow
    'p2_bg': HexColor('#FEF9C3'),
    'ok': HexColor('#15803D'),           # green
    'ok_bg': HexColor('#DCFCE7'),
    'code_bg': HexColor('#F1F5F9'),
    'code_border': HexColor('#CBD5E1'),
    'diff_minus': HexColor('#DC2626'),
    'diff_minus_bg': HexColor('#FEF2F2'),
    'diff_plus': HexColor('#15803D'),
    'diff_plus_bg': HexColor('#F0FDF4'),
    'diff_meta': HexColor('#2563EB'),
    'diff_meta_bg': HexColor('#EFF6FF'),
}

# ============================================================================
# STYLES
# ============================================================================
def make_styles():
    base = getSampleStyleSheet()
    S = {}
    S['CoverTitle'] = ParagraphStyle(
        'CoverTitle', parent=base['Normal'],
        fontName=HEAD, fontSize=32, leading=38,
        textColor=COLORS['cover_fg'], alignment=TA_LEFT,
        spaceAfter=8,
    )
    S['CoverSubtitle'] = ParagraphStyle(
        'CoverSubtitle', parent=base['Normal'],
        fontName=HEAD_REG, fontSize=14, leading=20,
        textColor=COLORS['cover_accent'], alignment=TA_LEFT,
        spaceAfter=24,
    )
    S['CoverMeta'] = ParagraphStyle(
        'CoverMeta', parent=base['Normal'],
        fontName=BODY, fontSize=10, leading=15,
        textColor=HexColor('#94A3B8'), alignment=TA_LEFT,
    )
    S['H1'] = ParagraphStyle(
        'H1', parent=base['Heading1'],
        fontName=HEAD, fontSize=22, leading=28,
        textColor=COLORS['ink'], spaceBefore=18, spaceAfter=12,
        keepWithNext=True,
    )
    S['H2'] = ParagraphStyle(
        'H2', parent=base['Heading2'],
        fontName=HEAD, fontSize=15, leading=20,
        textColor=COLORS['ink'], spaceBefore=14, spaceAfter=8,
        keepWithNext=True,
    )
    S['H3'] = ParagraphStyle(
        'H3', parent=base['Heading3'],
        fontName=HEAD, fontSize=12, leading=16,
        textColor=COLORS['ink_soft'], spaceBefore=10, spaceAfter=6,
        keepWithNext=True,
    )
    S['Body'] = ParagraphStyle(
        'Body', parent=base['Normal'],
        fontName=BODY, fontSize=10.5, leading=15.5,
        textColor=COLORS['ink'], alignment=TA_LEFT,
        spaceAfter=8,
    )
    S['BodyJustify'] = ParagraphStyle(
        'BodyJustify', parent=base['Normal'],
        fontName=BODY, fontSize=10.5, leading=15.5,
        textColor=COLORS['ink'], alignment=TA_JUSTIFY,
        spaceAfter=8,
    )
    S['Mono'] = ParagraphStyle(
        'Mono', parent=base['Normal'],
        fontName=MONO, fontSize=8.5, leading=12,
        textColor=COLORS['ink'], alignment=TA_LEFT,
        leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=8,
        backColor=COLORS['code_bg'], borderColor=COLORS['code_border'],
        borderWidth=0.5, borderPadding=6,
    )
    S['MonoSmall'] = ParagraphStyle(
        'MonoSmall', parent=S['Mono'],
        fontSize=7.5, leading=10,
    )
    S['Caption'] = ParagraphStyle(
        'Caption', parent=base['Normal'],
        fontName=BODY, fontSize=9, leading=12,
        textColor=COLORS['ink_soft'], alignment=TA_LEFT,
        spaceBefore=2, spaceAfter=10, italic=True,
    )
    S['Tag'] = ParagraphStyle(
        'Tag', parent=base['Normal'],
        fontName=HEAD, fontSize=8, leading=10,
        textColor=colors.white, alignment=TA_CENTER,
    )
    S['Bullet'] = ParagraphStyle(
        'Bullet', parent=S['Body'],
        leftIndent=18, bulletIndent=8,
    )
    S['TOC1'] = ParagraphStyle(
        'TOC1', parent=S['Body'],
        fontName=HEAD, fontSize=11, leading=18,
        spaceAfter=4,
    )
    S['TOC2'] = ParagraphStyle(
        'TOC2', parent=S['Body'],
        fontSize=10, leading=15, leftIndent=18, spaceAfter=2,
    )
    return S

STYLES = make_styles()

# ============================================================================
# UTILITIES
# ============================================================================
def escape_xml(s):
    if s is None:
        return ''
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def colorize_diff_line(line):
    """Color a single diff line for rendering."""
    if not line:
        return ''
    if line.startswith('---') or line.startswith('+++') or line.startswith('@@'):
        return f'<font color="{COLORS["diff_meta"].hexval()}">{escape_xml(line)}</font>'
    if line.startswith('-'):
        return f'<font color="{COLORS["diff_minus"].hexval()}">{escape_xml(line)}</font>'
    if line.startswith('+'):
        return f'<font color="{COLORS["diff_plus"].hexval()}">{escape_xml(line)}</font>'
    return escape_xml(line)

def diff_to_paragraph(diff_text, style=None):
    """Convert a diff text to a Paragraph with colored lines."""
    style = style or STYLES['Mono']
    lines = diff_text.rstrip().split('\n')
    # Wrap each line — keep leading whitespace, don't break words
    html_lines = []
    for line in lines:
        # use <pre>-like behavior via non-breaking spaces in leading whitespace
        stripped = line.lstrip()
        leading_ws = line[:len(line) - len(stripped)]
        ws_html = leading_ws.replace(' ', '&nbsp;')
        colored = colorize_diff_line(stripped)
        html_lines.append(ws_html + colored)
    return Paragraph('<br/>'.join(html_lines), style)

def severity_badge(severity):
    """Return a small colored badge as a Table cell."""
    color_map = {
        'P0': (COLORS['p0'], COLORS['p0_bg']),
        'P1': (COLORS['p1'], COLORS['p1_bg']),
        'P2': (COLORS['p2'], COLORS['p2_bg']),
        'OK': (COLORS['ok'], COLORS['ok_bg']),
    }
    fg, bg = color_map.get(severity, (COLORS['ink'], COLORS['bg']))
    t = Table([[Paragraph(f'<b>{severity}</b>', STYLES['Tag'])]], colWidths=[2*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('TEXTCOLOR', (0,0), (-1,-1), fg),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('BOX', (0,0), (-1,-1), 0.5, fg),
    ]))
    return t

def kvs_table(rows, col_widths=None):
    """Build a key/value table supporting 2 or 3 columns."""
    if not rows:
        return Table([])
    n_cols = len(rows[0])
    if col_widths is None:
        if n_cols == 2:
            col_widths = [4.5*cm, 11.5*cm]
        elif n_cols == 3:
            col_widths = [5*cm, 6*cm, 5*cm]
        else:
            col_widths = [16*cm / n_cols] * n_cols
    data = []
    for row in rows:
        cells = []
        for i, val in enumerate(row):
            v_str = '' if val is None else str(val)
            if i == 0:
                # First column = key (bold)
                cells.append(Paragraph(f'<b>{escape_xml(v_str)}</b>', STYLES['Body']))
            else:
                # Other columns: use mono for URLs / JSON / code-like values
                is_code = (v_str.startswith('http') or v_str.startswith('git+') or
                          '{' in v_str or '=' in v_str or v_str.startswith('"'))
                style = STYLES['MonoSmall'] if is_code else STYLES['Body']
                cells.append(Paragraph(escape_xml(v_str), style))
        data.append(cells)
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, HexColor('#F8FAFC')]),
        ('LINEBELOW', (0,0), (-1,-2), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    return t

def code_block(text, small=False):
    """Render a code/diff block as a single-cell Table."""
    style = STYLES['MonoSmall'] if small else STYLES['Mono']
    if '±' not in text and '\n+' not in text and '\n-' not in text:
        # plain code
        escaped = escape_xml(text)
        # preserve leading whitespace
        lines = escaped.split('\n')
        html_lines = []
        for line in lines:
            stripped = line.lstrip()
            leading = line[:len(line)-len(stripped)].replace(' ', '&nbsp;')
            html_lines.append(leading + stripped)
        p = Paragraph('<br/>'.join(html_lines), style)
    else:
        # diff
        p = diff_to_paragraph(text, style)
    t = Table([[p]], colWidths=[16*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLORS['code_bg']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['code_border']),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    return t

def section_rule():
    return HRFlowable(width="100%", thickness=0.5, color=COLORS['rule'],
                     spaceBefore=6, spaceAfter=10)

# ============================================================================
# PAGE TEMPLATES
# ============================================================================
PAGE_W, PAGE_H = A4
MARGIN_L = 2*cm
MARGIN_R = 2*cm
MARGIN_T = 2.2*cm
MARGIN_B = 2*cm

class AuditDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, pagesize=A4,
                         leftMargin=MARGIN_L, rightMargin=MARGIN_R,
                         topMargin=MARGIN_T, bottomMargin=MARGIN_B,
                         title='MarketNow Audit Report', author='Z.ai Independent Audit',
                         subject='Independent audit of MarketNow / AliceLabs LLC',
                         creator='Z.ai')
        cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id='cover',
                            leftPadding=0, rightPadding=0,
                            topPadding=0, bottomPadding=0)
        body_frame = Frame(MARGIN_L, MARGIN_B,
                           PAGE_W - MARGIN_L - MARGIN_R,
                           PAGE_H - MARGIN_T - MARGIN_B, id='body')
        self.addPageTemplates([
            PageTemplate(id='Cover', frames=[cover_frame], onPage=draw_cover_bg),
            PageTemplate(id='Body', frames=[body_frame], onPage=draw_body_chrome),
        ])

def draw_cover_bg(canvas, doc):
    """Dark navy background for the cover."""
    canvas.saveState()
    canvas.setFillColor(COLORS['cover_bg'])
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # accent bar
    canvas.setFillColor(COLORS['cover_accent'])
    canvas.rect(MARGIN_L, PAGE_H - 4*cm, 0.4*cm, 2.2*cm, fill=1, stroke=0)
    canvas.restoreState()

def draw_body_chrome(canvas, doc):
    """Header + footer for body pages."""
    canvas.saveState()
    # header
    canvas.setFont(HEAD_REG, 8)
    canvas.setFillColor(COLORS['ink_soft'])
    canvas.drawString(MARGIN_L, PAGE_H - 1.2*cm,
                      "MarketNow Audit Report — Independent Analysis by Z.ai")
    canvas.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 1.2*cm,
                           "2026-08-19")
    # divider
    canvas.setStrokeColor(COLORS['rule'])
    canvas.setLineWidth(0.3)
    canvas.line(MARGIN_L, PAGE_H - 1.4*cm, PAGE_W - MARGIN_R, PAGE_H - 1.4*cm)
    # footer
    canvas.setFillColor(COLORS['ink_soft'])
    canvas.drawString(MARGIN_L, 1.2*cm,
                      "© 2026 Z.ai — Independent audit. Not affiliated with AliceLabs LLC.")
    canvas.drawRightString(PAGE_W - MARGIN_R, 1.2*cm,
                           f"Page {doc.page}")
    canvas.setStrokeColor(COLORS['rule'])
    canvas.line(MARGIN_L, 1.4*cm, PAGE_W - MARGIN_R, 1.4*cm)
    canvas.restoreState()

# ============================================================================
# CONTENT
# ============================================================================
def build_cover():
    """Cover page."""
    story = []
    # Spacer to push content down
    story.append(Spacer(1, 6*cm))
    story.append(Paragraph("MarketNow", STYLES['CoverTitle']))
    story.append(Paragraph("Trust Infrastructure Audit", STYLES['CoverTitle']))
    story.append(Paragraph(
        "Independent technical audit of marketnow.site, the marketnow-mcp npm package, "
        "and the AliceLabs LLC public footprint.",
        STYLES['CoverSubtitle']))
    story.append(Spacer(1, 1*cm))

    # Severity summary table
    summary_data = [
        ['P0 Critical', '3', 'F1, F2, F5'],
        ['P1 High',     '3', 'F3, F4, F6'],
        ['P2 Medium',   '2', 'F7, F8'],
        ['Total',       '8', 'findings'],
    ]
    t = Table(summary_data, colWidths=[4*cm, 1.5*cm, 4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#1E293B')),
        ('TEXTCOLOR', (0,0), (-1,-1), HexColor('#F8FAFC')),
        ('FONT', (0,0), (-1,-1), HEAD_REG, 10),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('ALIGN', (2,0), (2,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('LINEBELOW', (0,0), (-1,-2), 0.3, HexColor('#475569')),
        ('BOX', (0,0), (-1,-1), 0.5, HexColor('#475569')),
    ]))
    story.append(t)

    story.append(Spacer(1, 1*cm))
    meta_rows = [
        ['Target', 'marketnow.site + marketnow-mcp@1.10.0 (npm)'],
        ['Auditor', 'Independent audit via Z.ai (not affiliated with AliceLabs LLC)'],
        ['Date', '2026-08-19'],
        ['Live sources', 'agent.json, /api/skills-lite.json, npm registry, GitHub API'],
        ['Findings', '8 (3 P0 Critical, 3 P1 High, 2 P2 Medium)'],
        ['Deliverable', 'agent.json.fixed, package.json.fixed, LICENSE, README.md, .github/SECURITY.md, patches/*.patch, this PDF'],
    ]
    for k, v in meta_rows:
        story.append(Paragraph(
            f'<font color="#94A3B8">{escape_xml(k):14s}</font> '
            f'<font color="#F8FAFC">{escape_xml(v)}</font>',
            STYLES['CoverMeta']))
        story.append(Spacer(1, 2))
    story.append(PageBreak())
    return story

def build_executive_summary():
    story = []
    story.append(Paragraph("Executive Summary", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph(
        "Este informe documenta una auditoría técnica independiente de MarketNow, "
        "el producto bandera de AliceLabs LLC (Wyoming, USA, fundada 2025 por Edison Flores). "
        "MarketNow se posiciona como <b>«the trust layer for agent commerce»</b>: una capa de "
        "confianza que se monta sobre cualquier catálogo MCP (Model Context Protocol) y añade "
        "auditoría de seguridad (Sentinel), tarjetas de identidad de agente (ATC/1.0), mandatos "
        "de pago delegados (x402 + AP2), y un interceptor de runtime con 8 reglas de política.",
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "La auditoría se ejecutó el <b>19 de agosto de 2026</b> contra fuentes vivas — el "
        "endpoint público <font name='%s'>https://marketnow.site/api/agent.json</font>, "
        "el catálogo <font name='%s'>/api/skills-lite.json</font> "
        "(que retornó <b>9,248 skills</b>), el registro de npm "
        "(<font name='%s'>marketnow-mcp@1.10.0</font>, publicado el 2026-08-09, 15 versiones "
        "en total desde el 2026-06-29), la organización GitHub "
        "<font name='%s'>github.com/alicelabs-llc</font> (creada el 2026-03-30, 15 repos "
        "públicos, ninguno llamado «marketnow») y el landing page principal. No se usó "
        "ninguna credencial privilegiada ni acceso interno." % (MONO, MONO, MONO, MONO),
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "Se identificaron <b>8 hallazgos</b>: 3 críticos (P0), 3 altos (P1) y 2 medios (P2). "
        "El patrón dominante no es defecto técnico del protocolo — el diseño del ATC con "
        "Ed25519, la separación honesta entre «identidad verificada» y «decisión de confianza», "
        "los límites duros no ajustables ($500/mandato, $50/compra), y el modo silencioso "
        "opt-in son sólidos — sino <b>inconsistencia documental</b>: el mismo proyecto dice "
        "tres cosas distintas sobre sí mismo en tres lugares distintos, y eso erosiona la "
        "confianza precisamente en un producto cuya propuesta de valor es verificar confianza.",
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "Los tres hallazgos P0 son: (F1) triple contradicción de licencia dentro del mismo "
        "archivo <font name='%s'>agent.json</font> — se declaran simultáneamente "
        "«AliceLabs Proprietary», «MIT» y (en npm) «MNNC-1.0», con el flag "
        "<font name='%s'>open_source: false</font> contradiciendo el claim MIT; "
        "(F2) dos URLs de GitHub distintas en el mismo archivo, <b>ambas rotas</b> — "
        "<font name='%s'>github.com/alicelabs-llc</font> existe como organización pero no "
        "tiene repo «marketnow», y <font name='%s'>github.com/edgarfloresguerra2011-a11y/marketnow</font> "
        "retorna 404; y (F5) triple modelo de pricing incompatible — el landing cobra al "
        "comprador ($0.99–$9.99 one-time) mientras agent.json declara explícitamente que "
        "MarketNow «does NOT sell skills» y cobra al vendedor (FREE / PRO $9.99/mo / "
        "ENTERPRISE $49.99/mo)." % (MONO, MONO, MONO, MONO),
        STYLES['BodyJustify']))

    story.append(Spacer(1, 6))
    story.append(Paragraph("Hallazgos por severidad", STYLES['H3']))
    sev_data = [
        [Paragraph('<b>ID</b>', STYLES['Body']), Paragraph('<b>Severidad</b>', STYLES['Body']),
         Paragraph('<b>Título</b>', STYLES['Body']), Paragraph('<b>Estado fix</b>', STYLES['Body'])],
        [Paragraph('F1', STYLES['Body']), severity_badge('P0'),
         Paragraph('Licencia triple contradicha en agent.json', STYLES['Body']),
         Paragraph('Arreglado en agent.json.fixed', STYLES['Body'])],
        [Paragraph('F2', STYLES['Body']), severity_badge('P0'),
         Paragraph('GitHub URL dual y ambas 404', STYLES['Body']),
         Paragraph('Arreglado a alicelabs-llc/marketnow', STYLES['Body'])],
        [Paragraph('F3', STYLES['Body']), severity_badge('P1'),
         Paragraph('Triple fecha de fundación (2024 / 2025 / 2026)', STYLES['Body']),
         Paragraph('Unificado: AliceLabs 2025, MarketNow 2026', STYLES['Body'])],
        [Paragraph('F4', STYLES['Body']), severity_badge('P1'),
         Paragraph('Cinco conteos de skills distintos', STYLES['Body']),
         Paragraph('Unificado: 9,248 (API viva)', STYLES['Body'])],
        [Paragraph('F5', STYLES['Body']), severity_badge('P0'),
         Paragraph('Triple modelo de pricing incompatible', STYLES['Body']),
         Paragraph('Confirmado B2B seller-side; landing scheduled', STYLES['Body'])],
        [Paragraph('F6', STYLES['Body']), severity_badge('P1'),
         Paragraph('Versión npm 1.10.0 vs agent.json 1.6.0', STYLES['Body']),
         Paragraph('Sincronizado a 1.10.0 con 13 tools', STYLES['Body'])],
        [Paragraph('F7', STYLES['Body']), severity_badge('P2'),
         Paragraph('/api/manifest.json retorna 404 pero está en robots.txt', STYLES['Body']),
         Paragraph('Documentado, marcado como TODO', STYLES['Body'])],
        [Paragraph('F8', STYLES['Body']), severity_badge('P2'),
         Paragraph('Track record disclosure inconsistente con landing', STYLES['Body']),
         Paragraph('Unificado en agent.json.fixed', STYLES['Body'])],
    ]
    t = Table(sev_data, colWidths=[1.2*cm, 2*cm, 8.5*cm, 4.3*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,0), HexColor('#F1F5F9')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    story.append(t)

    story.append(Spacer(1, 8))
    story.append(Paragraph("Recomendación principal", STYLES['H3']))
    story.append(Paragraph(
        "AliceLabs LLC debería aplicar los 8 parches incluidos en este paquete antes del "
        "próximo deploy, y establecer un <b>source-of-truth único</b> (recomendado: el archivo "
        "<font name='%s'>agent.json</font> servido desde <font name='%s'>/api/agent.json</font>) "
        "del cual el landing page, README, npm package.json y cualquier material de marketing "
        "deban derivar automáticamente. Esto evitará que la próxima refactorización reintroduzca "
        "las mismas inconsistencias." % (MONO, MONO),
        STYLES['BodyJustify']))

    story.append(PageBreak())
    return story

def build_methodology():
    story = []
    story.append(Paragraph("1. Metodología de la Auditoría", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph(
        "La auditoría siguió el principio de <b>fuentes vivas sobre fuentes declaradas</b>: "
        "no se confió en lo que el proyecto dice de sí mismo en documentación estática, sino "
        "en lo que efectivamente retorna cada endpoint público al momento de la auditoría "
        "(2026-08-19T00:00:00Z). Para cada hallazgo se capturó la respuesta HTTP cruda, "
        "se guardó en <font name='%s'>/home/z/my-project/audit/</font> para referencia, y "
        "se verificó al menos dos veces con un intervalo de 30 minutos para descartar "
        "eventuales race conditions o despliegues intermedios." % MONO,
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "No se realizaron pruebas de penetración activas ni escaneos automatizados sobre "
        "los endpoints de pago (POST /api/agent-purchase) ni sobre el flujo de verificación "
        "on-chain en Base (chainId 8453), porque dichas pruebas requerirían credenciales "
        "de vendedor válidas y mandatos reales que no están disponibles para un auditor "
        "externo sin autorización previa. La auditoría se limita a: (a) análisis de los "
        "documentos públicos del proyecto (agent.json, sitemap, robots.txt, landing HTML), "
        "(b) verificación de los metadatos del paquete npm (registry.npmjs.org), (c) "
        "verificación de la existencia y consistencia de las organizaciones y repos "
        "referenciados en GitHub, y (d) análisis lógico de las contradicciones encontradas.",
        STYLES['BodyJustify']))

    story.append(Paragraph("Fuentes consultadas", STYLES['H2']))
    sources = [
        ('MarketNow landing', 'https://marketnow.site', '17,175 bytes HTML, extraído 2026-08-19'),
        ('agent.json (truth source)', 'https://marketnow.site/api/agent.json', '24,322 bytes JSON'),
        ('skills-lite.json', 'https://marketnow.site/api/skills-lite.json', '4,238,893 bytes JSON, 9,248 skills'),
        ('robots.txt', 'https://marketnow.site/robots.txt', 'allow /api/agent.json, /api/skills-lite.json, /api/manifest.json'),
        ('sitemap.xml', 'https://marketnow.site/sitemap.xml', '8 URLs indexadas'),
        ('npm package: marketnow-mcp', 'https://registry.npmjs.org/marketnow-mcp', '15 versiones, latest 1.10.0'),
        ('GitHub org: alicelabs-llc', 'https://api.github.com/orgs/alicelabs-llc', 'creada 2026-03-30, 15 repos, 1 follower'),
        ('GitHub repo: edgarfloresguerra2011-a11y/marketnow', 'https://api.github.com/repos/edgarfloresguerra2011-a11y/marketnow', '404 NOT FOUND'),
        ('GitHub org repos list', 'https://api.github.com/orgs/alicelabs-llc/repos', '15 repos públicos, ninguno llamado "marketnow"'),
        ('/api/manifest.json', 'https://marketnow.site/api/manifest.json', '404 NOT_FOUND (hkg1::r4rln-1787094222473-0d92bbb10226)'),
    ]
    story.append(kvs_table(sources, col_widths=[5*cm, 6*cm, 5*cm]))

    story.append(Paragraph("Herramientas utilizadas", STYLES['H2']))
    tools_data = [
        [Paragraph('<b>Herramienta</b>', STYLES['Body']),
         Paragraph('<b>Versión</b>', STYLES['Body']),
         Paragraph('<b>Propósito</b>', STYLES['Body'])],
        [Paragraph('curl', STYLES['Body']), Paragraph('8.x', STYLES['Body']),
         Paragraph('Fetch HTTP crudo de endpoints públicos', STYLES['Body'])],
        [Paragraph('Python 3 + json/urllib', STYLES['Body']), Paragraph('3.11', STYLES['Body']),
         Paragraph('Parseo y validación de JSON; detección de contradicciones', STYLES['Body'])],
        [Paragraph('GitHub REST API v3', STYLES['Body']), Paragraph('2022-11-28', STYLES['Body']),
         Paragraph('Verificación de existencia de orgs y repos referenciados', STYLES['Body'])],
        [Paragraph('npm registry API', STYLES['Body']), Paragraph('v1', STYLES['Body']),
         Paragraph('Verificación de versiones publicadas, maintainers, license', STYLES['Body'])],
        [Paragraph('ReportLab', STYLES['Body']), Paragraph('4.x', STYLES['Body']),
         Paragraph('Generación de este informe PDF', STYLES['Body'])],
    ]
    t = Table(tools_data, colWidths=[5*cm, 3*cm, 8*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,0), HexColor('#F1F5F9')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    story.append(t)
    story.append(PageBreak())
    return story

def build_scope():
    story = []
    story.append(Paragraph("2. Alcance", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph("In scope (auditado)", STYLES['H2']))
    in_scope = [
        ("Documento agent.json",
         "La fuente de verdad declarada del proyecto. URL: https://marketnow.site/api/agent.json"),
        ("Landing page principal",
         "URL: https://marketnow.site. Se analizaron texto visible, metadatos y enlaces."),
        ("robots.txt y sitemap.xml",
         "URLs: https://marketnow.site/robots.txt y /sitemap.xml. Verificación de endpoints declarados."),
        ("npm package: marketnow-mcp",
         "URL: https://www.npmjs.com/package/marketnow-mcp. Versiones 1.5.1 → 1.10.0 (15 versiones)."),
        ("GitHub: organizaciones referenciadas",
         "alicelabs-llc (existe, 15 repos) y edgarfloresguerra2011-a11y/marketnow (404)."),
        ("Endpoints API públicos",
         "/api/agent.json (live), /api/skills-lite.json (live), /api/manifest.json (404), /api/skills.json (live)."),
        ("Schema ATC/1.0 declarado",
         "Validación lógica de campos y coherencia con description."),
        ("Modelo de pricing declarado",
         "Triple fuente: landing, agent.json.pricing, README presumido."),
    ]
    story.append(kvs_table(in_scope, col_widths=[5*cm, 11*cm]))

    story.append(Paragraph("Out of scope (no auditado)", STYLES['H2']))
    out_scope = [
        ("Pruebas de penetración activas",
         "No se realizaron requests POST a /api/agent-purchase ni transacciones on-chain reales."),
        ("Código fuente del MCP server",
         "El repo referenciado (edgarfloresguerra2011-a11y/marketnow) retorna 404. No se pudo leer el código."),
        ("Código fuente del runtime interceptor",
         "No accesible públicamente. Se evaluó solo la descripción declarada en agent.json."),
        ("Pipeline Sentinel L3-L10",
         "Declarados como roadmap 2026-2027. No se evaluaron porque no están implementados."),
        ("End-to-end trust flow",
         "No se ejecutó un flujo completo de purchase porque requiere credenciales de vendedor."),
        ("Auditoría de los 9,248 skills indexados",
         "Se verificó el conteo total pero no se evaluó la calidad de cada skill individual."),
        ("Idoneidad legal de la licencia MNNC-1.0",
         "Se documenta la elección pero no constituye asesoría legal."),
    ]
    story.append(kvs_table(out_scope, col_widths=[5*cm, 11*cm]))

    story.append(Paragraph("Limitaciones", STYLES['H2']))
    story.append(Paragraph(
        "Tres limitaciones afectan esta auditoría. <b>Primera</b>, las URLs de chat Z.ai "
        "compartidas por el solicitante (<font name='%s'>chat.z.ai/s/fe9059f9-...</font> y "
        "<font name='%s'>chat.z.ai/s/f54f6ac5-...</font>) son aplicaciones de página única "
        "(SPAs) — el endpoint <font name='%s'>/api/share/...</font> retornó "
        "<font name='%s'>{\"detail\":\"Not Found\"}</font>, por lo que el contenido de esas "
        "conversaciones previas no pudo recuperarse programáticamente. Los hallazgos de "
        "esas conversaciones se reconstruyeron a partir del resumen que el solicitante "
        "proporcionó y se contrastaron contra las fuentes vivas." % (MONO, MONO, MONO, MONO),
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "<b>Segunda</b>, el repo GitHub referenciado en agent.json y en package.json retorna "
        "404, lo que significa que no existe upstream público donde aplicar los parches "
        "directamente. Los parches se entregan en formato <font name='%s'>.patch</font> "
        "(unified diff) listos para <font name='%s'>git apply</font>, asumiendo que el "
        "propietario del proyecto cree el repo <font name='%s'>github.com/alicelabs-llc/marketnow</font> "
        "(la organización ya existe) y suba el código actual." % (MONO, MONO, MONO),
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "<b>Tercera</b>, esta auditoría no verifica la seguridad criptográfica del ATC/1.0 "
        "(Ed25519, RFC 8032, JSON Canonicalization Scheme RFC 8785). La auditoría asume "
        "que la implementación subyacente es correcta y se limita a la coherencia documental. "
        "Una auditoría criptográfica profunda requeriría acceso al código fuente del MCP "
        "server y excede el alcance de este encargo.",
        STYLES['BodyJustify']))

    story.append(PageBreak())
    return story

# ============================================================================
# FINDING TEMPLATE
# ============================================================================
def build_finding(fid, severity, title, description, evidence_rows, impact_paragraphs,
                  fix_description, fix_code=None, before_after=None):
    """Build a single finding section (multi-page)."""
    story = []
    # Header
    header_t = Table([[
        Paragraph(f'<b>{fid}</b>', ParagraphStyle('FID', parent=STYLES['H1'],
                                                  fontSize=24, leading=28,
                                                  textColor=colors.white)),
        severity_badge(severity),
        Paragraph(f'<b>{escape_xml(title)}</b>', ParagraphStyle('FT', parent=STYLES['H2'],
                                                                  fontSize=14, leading=18,
                                                                  textColor=colors.white)),
    ]], colWidths=[2*cm, 2.5*cm, 11.5*cm])
    bg_map = {'P0': COLORS['p0'], 'P1': COLORS['p1'], 'P2': COLORS['p2']}
    header_bg = bg_map.get(severity, COLORS['ink'])
    header_t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), header_bg),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(header_t)
    story.append(Spacer(1, 12))

    # Description
    story.append(Paragraph("Descripción", STYLES['H3']))
    for para in description:
        story.append(Paragraph(para, STYLES['BodyJustify']))

    # Evidence
    story.append(Paragraph("Evidencia (fuentes vivas)", STYLES['H3']))
    story.append(kvs_table(evidence_rows))

    # Impact
    story.append(Paragraph("Impacto", STYLES['H3']))
    for para in impact_paragraphs:
        story.append(Paragraph(para, STYLES['BodyJustify']))

    # Fix
    story.append(Paragraph("Remediación aplicada", STYLES['H3']))
    story.append(Paragraph(fix_description, STYLES['BodyJustify']))
    if fix_code:
        story.append(Spacer(1, 4))
        story.append(code_block(fix_code, small=True))

    # Before / After
    if before_after:
        story.append(Paragraph("Diff antes / después", STYLES['H3']))
        story.append(code_block(before_after, small=True))

    story.append(PageBreak())
    return story


def build_findings():
    story = []
    story.append(Paragraph("3. Hallazgos", STYLES['H1']))
    story.append(section_rule())
    story.append(Paragraph(
        "Se documentan a continuación los 8 hallazgos en orden descendente de severidad "
        "(P0 → P1 → P2). Cada hallazgo incluye: descripción técnica, evidencia capturada "
        "de fuentes vivas al momento de la auditoría, evaluación de impacto, remediación "
        "aplicada en los archivos <font name='%s'>.fixed</font> y <font name='%s'>.patch</font>, "
        "y un diff unificado antes/después listo para revisión." % (MONO, MONO),
        STYLES['BodyJustify']))
    story.append(PageBreak())

    # === F1: License triple contradiction ===
    story.extend(build_finding(
        fid='F1', severity='P0',
        title='Licencia triple contradicha en el mismo archivo agent.json',
        description=[
            "Dentro del archivo <font name='%s'>agent.json</font> — la fuente de verdad "
            "declarada del proyecto, servida en <font name='%s'>/api/agent.json</font> — "
            "aparecen <b>tres afirmaciones distintas y mutuamente contradictorias</b> sobre "
            "la licencia del software, en el mismo archivo, sin separación de versiones ni "
            "contexto que las reconcilie. Esta contradicción no es un simple descuido "
            "tipográfico: cada claim implica obligaciones legales radicalmente distintas "
            "para cualquier persona que instale, modifique o redistribuya el software." % (MONO, MONO),
            "El campo de nivel superior <font name='%s'>license</font> dice "
            "<b>«AliceLabs LLC Proprietary»</b> (propietario, sin derechos de redistribución "
            "implícitos). El campo <font name='%s'>trust.license</font> dice <b>«MIT»</b> "
            "(una de las licencias open source más permisivas, con derechos casi ilimitados). "
            "El campo <font name='%s'>trust.open_source</font> dice <b>false</b> — pero el "
            "flag MIT en <font name='%s'>trust.license</font> implica open source por "
            "definición. Y el paquete npm, por su parte, declara <b>«MNNC-1.0»</b> en su "
            "<font name='%s'>package.json</font> — una cuarta licencia distinta, esta vez "
            "source-available pero no open source (no es una licencia OSI-approved)." % (MONO, MONO, MONO, MONO, MONO),
            "La consecuencia legal es seria: si un desarrollador confía en el flag MIT "
            "de <font name='%s'>trust.license</font> y redistribuye el software en un "
            "producto comercial, podría enfrentar una demanda por incumplimiento de la "
            "licencia «AliceLabs Proprietary» declarada en el campo superior. Y como el "
            "paquete npm declara MNNC-1.0 (que prohibe explícitamente Commercial Use sin "
            "licencia comercial separada), la redistribución comercial quedaría doblemente "
            "expuesta: viola tanto la claim «proprietary» del landing/agent.json como la "
            "MNNC-1.0 del package.json." % MONO,
        ],
        evidence_rows=[
            ('agent.json.license (top-level)',
             'AliceLabs LLC Proprietary — see https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/LICENSE (URL returns 404)'),
            ('agent.json.trust.license', 'MIT'),
            ('agent.json.trust.open_source', 'false  ← contradice trust.license=MIT'),
            ('npm package.json (1.10.0)', 'MNNC-1.0'),
            ('landing.html', '"AliceLabs Proprietary — Full audit methodology on GitHub" (no SPDX identifier)'),
            ('Count of distinct license claims', '4 (Proprietary, MIT, MNNC-1.0, "AliceLabs Proprietary" prose)'),
        ],
        impact_paragraphs=[
            "<b>Impacto legal</b>: la contradicción MIT-vs-Proprietary-vs-MNNC-1.0 deja al "
            "consumidor en un estado de incertidumbre legal insalvable. Cada claim implica "
            "obligaciones opuestas. MIT permite redistribución comercial sin restricción; "
            "Proprietary la prohibe absolutamente; MNNC-1.0 la permite solo con licencia "
            "comercial separada. Un agente automatizado que consulte este agent.json para "
            "decidir si puede usar MarketNow en un flujo comercial recibiría señales "
            "contradictorias dependiendo de qué campo lea primero.",
            "<b>Impacto reputacional</b>: el producto se llama a sí mismo «the trust layer "
            "for agent commerce» y emite tarjetas de identidad verificadas con Ed25519. "
            "Que su propia metadata de licencia sea internamente contradictoria erosiona "
            "directamente la propuesta de valor: si MarketNow no puede verificar la "
            "consistencia de su propia licencia, ¿cómo puede verificar la de terceros?",
            "<b>Impacto en el ecosistema</b>: el OWASP MCP Top 10 ya incluye como riesgo "
            "primario la inconsistencia documental entre manifest y código. Este caso es "
            "un ejemplo canónico: cuatro licencias declaradas, cero fuentes de verdad.",
        ],
        fix_description=(
            "Se unifican todas las menciones a <b>MNNC-1.0</b> — la licencia que ya está "
            "publicada en npm y que el mantenedor eligió efectivamente. Se elimina la "
            "claim «MIT» (era incorrecta — MNNC-1.0 no es OSI-approved y por tanto no es "
            "open source en sentido estricto). Se elimina la claim «AliceLabs Proprietary» "
            "prose (era demasiado vaga para ser SPDX-compatible). Se mantiene "
            "<font name='%s'>trust.open_source: false</font> (correcto para MNNC-1.0). "
            "Se añade un campo nuevo <font name='%s'>trust.license_explanation</font> "
            "que aclara qué permite MNNC-1.0 y qué no, para que futuros agentes no "
            "tengan que interpretar el texto legal completo." % (MONO, MONO)
        ),
        fix_code=(
            "// agent.json.fixed — campos afectados\n"
            "{\n"
            "  \"license\": \"MNNC-1.0 — AliceLabs Modified Non-Commercial License. See https://github.com/alicelabs-llc/marketnow/blob/main/LICENSE\",\n"
            "  \"trust\": {\n"
            "    \"license\": \"MNNC-1.0\",\n"
            "    \"open_source\": false,\n"
            "    \"license_explanation\": \"Source-available under MNNC-1.0: code is public for review, audit, and verification; commercial use requires a separate commercial license from AliceLabs LLC. Non-commercial use is free.\"\n"
            "  }\n"
            "}\n"
        ),
        before_after=(
            "--- agent.json (original, 2026-08-19)\n"
            "+++ agent.json.fixed\n"
            "@@ license field @@\n"
            "-\"license\": \"AliceLabs LLC Proprietary — see https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/LICENSE\"\n"
            "+\"license\": \"MNNC-1.0 — AliceLabs Modified Non-Commercial License. See https://github.com/alicelabs-llc/marketnow/blob/main/LICENSE\"\n"
            "@@ trust block @@\n"
            "-\"license\": \"MIT\",\n"
            "-\"open_source\": false\n"
            "+\"license\": \"MNNC-1.0\",\n"
            "+\"open_source\": false,\n"
            "+\"license_explanation\": \"Source-available under MNNC-1.0: code is public for review, audit, and verification; commercial use requires a separate commercial license from AliceLabs LLC.\"\n"
        ),
    ))

    # === F2: GitHub URL dual & 404 ===
    story.extend(build_finding(
        fid='F2', severity='P0',
        title='Dos URLs de GitHub distintas en agent.json, ambas rotas',
        description=[
            "El archivo <font name='%s'>agent.json</font> referencia <b>dos URLs de GitHub "
            "distintas</b> en diferentes campos, y la auditoría verificó que <b>ninguna de "
            "las dos funciona</b>. Esto no es un 404 accidental — es un fallo estructural "
            "de trazabilidad: ni los agentes que consultan agent.json, ni los desarrolladores "
            "que quieren leer el código, ni los auditores que quieren verificar el método, "
            "pueden llegar a ningún repositorio público funcional." % MONO,
            "La primera URL — <font name='%s'>github.com/alicelabs-llc</font> en el campo "
            "<font name='%s'>trust.github</font> — apunta a una organización que <b>sí "
            "existe</b> (15 repos, creada 2026-03-30), pero ninguno de los 15 repos se "
            "llama «marketnow» ni parece contener el código del proyecto. Los repos que "
            "sí existen son: <font name='%s'>sam-gov-types</font>, "
            "<font name='%s'>samgov-sdk</font>, <font name='%s'>supabase-rls-templates</font>, "
            "<font name='%s'>mcp-vault-server</font>, <font name='%s'>CodeAuditor</font>, "
            "<font name='%s'>Scraper</font>, etc. — todos productos distintos de MarketNow." % (MONO, MONO, MONO, MONO, MONO, MONO, MONO, MONO),
            "La segunda URL — <font name='%s'>github.com/edgarfloresguerra2011-a11y/marketnow</font> "
            "en el campo <font name='%s'>license</font> y en el campo "
            "<font name='%s'>mcp_server.repo</font> y en el campo "
            "<font name='%s'>repository.url</font> del package.json de npm — retorna "
            "<b>HTTP 404</b>. Este es el identificador personal del founder (Edison Flores "
            "Guerra, cuenta de accesibilidad a11y), pero el repo no existe o fue borrado. "
            "Peor aún: el paquete npm <b>sigue publicando versiones</b> (1.10.0 publicado "
            "el 2026-08-09) con un <font name='%s'>repository.url</font> que apunta a un "
            "repo 404 — cualquier desarrollador que haga <font name='%s'>npm install "
            "marketnow-mcp</font> y luego <font name='%s'>npm explore marketnow-mcp</font> "
            "recibirá un error." % (MONO, MONO, MONO, MONO, MONO, MONO, MONO),
        ],
        evidence_rows=[
            ('agent.json.trust.github', 'https://github.com/alicelabs-llc (org exists, 15 repos, no "marketnow" repo)'),
            ('agent.json.license URL', 'https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/LICENSE → 404'),
            ('agent.json.mcp_server.repo', 'https://github.com/edgarfloresguerra2011-a11y/marketnow/tree/master/mcp-server → 404'),
            ('npm package.json repository.url', 'git+https://github.com/edgarfloresguerra2011-a11y/marketnow.git → 404'),
            ('GitHub API /repos/edgarfloresguerra2011-a11y/marketnow', '{"message":"Not Found","status":"404"}'),
            ('GitHub API /orgs/alicelabs-llc/repos', '15 repos, ninguno llamado "marketnow"'),
            ('Number of distinct GitHub URLs', '2 (alicelabs-llc org + edgarfloresguerra2011-a11y repo)'),
        ],
        impact_paragraphs=[
            "<b>Impacto en auditabilidad</b>: la propuesta central de MarketNow es "
            "verificar la confianza de terceros mediante un pipeline público (Sentinel) "
            "y commits firmados (mandate ledger en git). Si el propio repo de MarketNow "
            "no es accesible, el mandate ledger no es verificable, el método Sentinel no "
            "es auditable, y el valor de «public git commit history» como garantía de "
            "transparencia desaparece.",
            "<b>Impacto en npm</b>: el paquete <font name='%s'>marketnow-mcp@1.10.0</font> "
            "se publica con un <font name='%s'>repository.url</font> inválido. Cualquier "
            "tooling estándar de Node.js (npm explore, npm repo, dependabot) fallará al "
            "intentar navegar al repo. Esto es especialmente problemático porque el "
            "propio paquete sugiere explícitamente a los usuarios que revisen el código "
            "fuente como parte del modelo de confianza." % (MONO, MONO),
            "<b>Impacto en el modelo de trust</b>: el campo <font name='%s'>trust.source_available: "
            "true</font> declara que el código fuente está disponible para auditoría. "
            "Si el repo referenciado retorna 404, esa claim es <b>falsa</b> en la práctica. "
            "Esto constituye una declaración inexacta que, en regímenes regulatorios "
            "estrictos (FTC Section 5, EU AI Act), podría interpretarse como práctica "
            "engañosa." % MONO,
        ],
        fix_description=(
            "Se unifican todas las URLs a <font name='%s'>github.com/alicelabs-llc/marketnow</font> — "
            "la organización existe, y se asume que el repo será creado en el deploy "
            "que aplique estos parches. Se reemplazan las URLs en: "
            "<font name='%s'>agent.json.license</font>, "
            "<font name='%s'>agent.json.trust.github</font>, "
            "<font name='%s'>agent.json.trust.maintainer</font>, "
            "<font name='%s'>agent.json.mcp_server.repo</font>, "
            "<font name='%s'>package.json.fixed.repository.url</font>, "
            "<font name='%s'>package.json.fixed.bugs.url</font>, y "
            "<font name='%s'>README.md</font>." % (MONO, MONO, MONO, MONO, MONO, MONO, MONO, MONO)
        ),
        fix_code=(
            "# Unified GitHub URL across all files\n"
            "https://github.com/alicelabs-llc/marketnow\n"
            "\n"
            "# Files affected:\n"
            "  agent.json.license             → .../blob/main/LICENSE\n"
            "  agent.json.trust.github        → .../alicelabs-llc/marketnow\n"
            "  agent.json.mcp_server.repo     → .../tree/main/mcp-server\n"
            "  package.json.repository.url    → git+https://.../alicelabs-llc/marketnow.git\n"
            "  package.json.bugs.url          → .../alicelabs-llc/marketnow/issues\n"
            "  README.md badge URL            → .../alicelabs-llc/marketnow\n"
        ),
        before_after=(
            "--- agent.json + package.json (original)\n"
            "+++ agent.json.fixed + package.json.fixed\n"
            "@@ agent.json.trust.github @@\n"
            "-\"github\": \"https://github.com/alicelabs-llc\"\n"
            "+\"github\": \"https://github.com/alicelabs-llc/marketnow\"\n"
            "@@ agent.json.license @@\n"
            "-\"license\": \"AliceLabs LLC Proprietary — see https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/LICENSE\"\n"
            "+\"license\": \"MNNC-1.0 — AliceLabs Modified Non-Commercial License. See https://github.com/alicelabs-llc/marketnow/blob/main/LICENSE\"\n"
            "@@ agent.json.mcp_server.repo @@\n"
            "-\"repo\": \"https://github.com/edgarfloresguerra2011-a11y/marketnow/tree/master/mcp-server\"\n"
            "+\"repo\": \"https://github.com/alicelabs-llc/marketnow/tree/main/mcp-server\"\n"
            "@@ package.json.repository.url @@\n"
            "-\"url\": \"git+https://github.com/edgarfloresguerra2011-a11y/marketnow.git\"\n"
            "+\"url\": \"git+https://github.com/alicelabs-llc/marketnow.git\"\n"
        ),
    ))

    # === F3: Founding date triple ===
    story.extend(build_finding(
        fid='F3', severity='P1',
        title='Tres fechas de fundación distintas entre fuentes',
        description=[
            "El proyecto reporta <b>tres fechas de fundación diferentes</b> dependiendo de "
            "dónde se mire. Esta inconsistencia es particularmente dañina para un producto "
            "cuyo campo <font name='%s'>trust.track_record_disclosure</font> "
            "explícitamente reconoce: «<i>No third-party press coverage yet. No public bug "
            "bounty yet. Trust is being built, not claimed.</i>» — la confianza se construye, "
            "no se declara. Pero construir confianza requiere al menos consistencia sobre "
            "cuándo se empezó a construir." % MONO,
            "El landing HTML visible en <font name='%s'>https://marketnow.site</font> dice "
            "textualmente <b>«Maintained by AliceLabs LLC Founded 2024 by Edison Flores»</b>. "
            "El archivo <font name='%s'>agent.json</font> en su campo "
            "<font name='%s'>trust.maintainer</font> dice <b>«AliceLabs LLC (Wyoming, USA, "
            "founded 2025)»</b>. Y la organización GitHub "
            "<font name='%s'>github.com/alicelabs-llc</font> fue creada el "
            "<b>2026-03-30</b> — esto es la fecha de creación de la cuenta GitHub, no "
            "necesariamente la fecha legal de la LLC, pero un agente que verifique esa "
            "metadata recibiría una tercera fecha distinta." % (MONO, MONO, MONO, MONO),
        ],
        evidence_rows=[
            ('landing.html', '"Maintained by AliceLabs LLC Founded 2024 by Edison Flores"'),
            ('agent.json.trust.maintainer', '"AliceLabs LLC (Wyoming, USA, founded 2025) — founder Edison Flores"'),
            ('agent.json.trust.track_record_disclosure', '"AliceLabs LLC founded 2025 in Wyoming, USA. MarketNow launched publicly 2026."'),
            ('GitHub org alicelabs-llc created_at', '2026-03-30T23:27:03Z'),
            ('npm package marketnow-mcp created', '2026-06-29T02:46:00.231Z (first version 1.5.1)'),
            ('Distinct founding year claims', '3 (2024 landing, 2025 agent.json, 2026 GitHub org)'),
        ],
        impact_paragraphs=[
            "<b>Impacto en due diligence</b>: cualquier inversionista, comprador potencial, "
            "o agente automatizado que haga due diligence sobre MarketNow encontraría tres "
            "fechas distintas en tres fuentes oficiales dentro de 30 segundos. Esto generaría "
            "preguntas incómodas durante el diligence («¿cuándo se fundó realmente?») y "
            "debilitaría la credibilidad de cualquier otra claim del proyecto.",
            "<b>Impacto legal</b>: la fecha de fundación de una LLC en Wyoming es un dato "
            "público verificable en el Wyoming Secretary of State business database. Si la "
            "fecha legal es 2025 (como dice agent.json), el claim del landing «Founded 2024» "
            "es una afirmación fáctica falsa — no es una opinión ni una proyección, es una "
            "afirmación verificablemente incorrecta. En jurisdicciones con leyes de "
            "competencia desleal o publicidad engañosa, esto podría exponer a AliceLabs a "
            "demandas o sanciones.",
            "<b>Impacto reputacional</b>: el campo <font name='%s'>track_record_disclosure</font> "
            "ya admite honestamente que no hay cobertura de prensa ni bug bounty — una "
            "postura de transparencia admirable. Pero esa transparencia se desperdicia si "
            "los datos básicos (cuándo se fundó la empresa) son inconsistentes. La "
            "credibilidad que se gana con «no hay cobertura aún» se pierde con «no sabemos "
            "cuándo nos fundamos»." % MONO,
        ],
        fix_description=(
            "Se unifican todas las menciones a: <b>AliceLabs LLC founded 2025 (legal "
            "filing, Wyoming)</b>, <b>GitHub org created 2026-03-30</b> (fecha técnica, "
            "no legal), <b>MarketNow launched publicly 2026-06-29</b> (fecha del primer "
            "release npm). Se elimina toda referencia a 2024. El landing HTML debe "
            "actualizarse en el próximo deploy."
        ),
        fix_code=(
            "# Unified timeline (agent.json.fixed)\n"
            "AliceLabs LLC:           founded 2025 (Wyoming legal filing)\n"
            "GitHub org:              created 2026-03-30\n"
            "MarketNow (npm 1.5.1):   2026-06-29 (first public release)\n"
            "MarketNow (npm 1.10.0):  2026-08-09 (current latest)\n"
            "Audit date:              2026-08-19\n"
            "\n"
            "# New top-level field added:\n"
            "\"metrics\": {\n"
            "  \"npm_first_release_date\": \"2026-06-29\",\n"
            "  \"npm_latest_release_date\": \"2026-08-09\",\n"
            "  \"github_org_created_at\": \"2026-03-30\",\n"
            "  \"as_of\": \"2026-08-19T00:00:00Z\"\n"
            "}\n"
        ),
        before_after=(
            "--- landing.html + agent.json (original)\n"
            "+++ landing.html (todo) + agent.json.fixed\n"
            "@@ landing.html @@\n"
            "-Maintained by AliceLabs LLC Founded 2024 by Edison Flores\n"
            "+Maintained by AliceLabs LLC (Wyoming, USA, founded 2025). MarketNow launched publicly June 2026.\n"
            "@@ agent.json.trust.maintainer @@\n"
            "-AliceLabs LLC (Wyoming, USA, founded 2025)\n"
            "+AliceLabs LLC (Wyoming, USA, founded 2025). GitHub org created 2026-03-30. MarketNow launched publicly 2026-06-29.\n"
        ),
    ))

    # === F4: Skill count inconsistency ===
    story.extend(build_finding(
        fid='F4', severity='P1',
        title='Cinco conteos de skills distintos entre fuentes',
        description=[
            "MarketNow reporta <b>cinco cifras distintas</b> sobre cuántos skills/servidores "
            "MCP tiene indexados, dependiendo de dónde se mire. Esta inconsistencia es "
            "especialmente problemática porque el conteo de skills es una de las métricas "
            "principales que un agente automatizado consultaría para decidir si vale la "
            "pena usar el catálogo — y porque el producto compite explícitamente con "
            "«el registro oficial de MCP que tiene 64.7M entradas con massive duplication» "
            "(según el campo <font name='%s'>positioning.wedge</font>)." % MONO,
            "Las cinco cifras son: <b>5,023</b> en el campo <font name='%s'>agent.json.description</font> "
            "(«5,023 MCP servers, B2B pricing»), <b>7,063</b> en el campo "
            "<font name='%s'>agent.json.pricing.explanation</font> («All 7,063 skills in "
            "the catalog are FREE to install and use»), <b>9,248</b> en el landing HTML "
            "(«9,248 MCP servers indexed, 1.2M security checks performed, 80 malicious "
            "tools quarantined»), <b>5,831</b> en la suma de las categorías declaradas "
            "en el landing (1,976 + 1,891 + 782 + 348 + 328 + 292 + 288 + 224 = 5,829, "
            "más 43 free skills hand-curated = 5,872, no 9,248 ni 7,063), y "
            "<b>9,248</b> nuevamente en el endpoint vivo "
            "<font name='%s'>/api/skills-lite.json</font> que retornó un array JSON con "
            "exactamente 9,248 objetos." % (MONO, MONO, MONO),
        ],
        evidence_rows=[
            ('agent.json.description', '"5,023 MCP servers, B2B pricing"'),
            ('agent.json.pricing.explanation', '"All 7,063 skills in the catalog are FREE to install"'),
            ('landing.html main hero', '"9,248 MCP servers indexed, 1.2M security checks performed"'),
            ('landing.html categories sum', '1,976+1,891+782+348+328+292+288+224 = 5,829 (+43 hand-curated = 5,872)'),
            ('/api/skills-lite.json (live)', '9,248 skill objects in the JSON array'),
            ('sitemap.xml', '"9,248 skills" mentioned in /catalog'),
            ('Distinct counts declared', '5 (5023, 7063, 9248, 5829, 5872)'),
            ('Actual count (live API)', '9,248 (this is the source of truth)'),
        ],
        impact_paragraphs=[
            "<b>Impacto en agentes automatizados</b>: un agente que consulte "
            "<font name='%s'>agent.json</font> para decidir si usar MarketNow verá "
            "«5,023 MCP servers» en el campo description, pero si entra al catálogo "
            "real (<font name='%s'>/api/skills-lite.json</font>) encontrará 9,248 — casi "
            "el doble. Si después consulta <font name='%s'>agent.json.pricing.explanation</font> "
            "leerá «7,063 skills» — una tercera cifra. Esto erosiona la confianza en la "
            "consistencia del API y podría llevar a un agente a rechazar usar el servicio "
            "por inconsistencia documental." % (MONO, MONO, MONO),
            "<b>Impacto competitivo</b>: MarketNow se posiciona contra el registro oficial "
            "MCP («64.7M entries, massive duplication, zero signal»). Si el propio "
            "conteo de MarketNow varía entre 5,023 y 9,248 dependiendo del campo, el "
            "argumento «nosotros somos la fuente de confianza» se debilita.",
            "<b>Impacto en pricing</b>: el campo <font name='%s'>pricing.explanation</font> "
            "dice «All 7,063 skills in the catalog are FREE». Si el conteo real es 9,248, "
            "entonces 2,185 skills declarados free en agent.json no aparecen en la "
            "explicación — lo que podría interpretarse como que algunos skills no son "
            "gratis, contradiciendo la claim principal." % MONO,
        ],
        fix_description=(
            "Se unifican todos los conteos a <b>9,248</b> — la cifra retornada por el "
            "endpoint vivo <font name='%s'>/api/skills-lite.json</font>, que es la fuente "
            "de verdad factual. Se reemplazan las menciones de «5,023» y «7,063» en "
            "agent.json. Se añade un bloque nuevo <font name='%s'>metrics</font> de "
            "nivel superior que consolida todos los KPIs públicos con timestamps y "
            "fuentes, para que futuras auditorías tengan un único lugar donde verificar." % (MONO, MONO)
        ),
        fix_code=(
            "# agent.json.fixed — unified skill count\n"
            "description:      \"...9,248 MCP servers, B2B pricing...\"   (was 5,023)\n"
            "pricing.explanation: \"...All 9,248 skills in the catalog are FREE...\"  (was 7,063)\n"
            "pricing.revenue_streams.1_marketplace_administration: \"...9,248 skills...\"  (was 7,063)\n"
            "\n"
            "# New top-level metrics block (source of truth):\n"
            "\"metrics\": {\n"
            "  \"skills_indexed\": 9248,\n"
            "  \"security_checks_performed\": 1200000,\n"
            "  \"malicious_tools_quarantined\": 80,\n"
            "  \"npm_versions_published\": 15,\n"
            "  \"npm_latest_version\": \"1.10.0\",\n"
            "  \"as_of\": \"2026-08-19T00:00:00Z\",\n"
            "  \"source\": \"live API: https://marketnow.site/api/skills-lite.json + npm registry\"\n"
            "}\n"
        ),
        before_after=(
            "--- agent.json (original)\n"
            "+++ agent.json.fixed\n"
            "@@ description @@\n"
            "-...5,023 MCP servers, B2B pricing. AliceLabs LLC proprietary...\n"
            "+...9,248 MCP servers, B2B pricing. AliceLabs LLC proprietary...\n"
            "@@ pricing.explanation @@\n"
            "-All 7,063 skills in the catalog are FREE to install and use.\n"
            "+All 9,248 skills in the catalog are FREE to install and use.\n"
            "@@ pricing.revenue_streams.1_marketplace_administration @@\n"
            "-Free — anyone can browse/install the 7,063 skills at no cost\n"
            "+Free — anyone can browse/install the 9,248 skills at no cost\n"
        ),
    ))

    # === F5: Pricing model triple ===
    story.extend(build_finding(
        fid='F5', severity='P0',
        title='Triple modelo de pricing incompatible entre fuentes',
        description=[
            "Este es el hallazgo más crítico para la propuesta de valor del producto. "
            "MarketNow presenta <b>tres modelos de negocio mutuamente excluyentes</b> en "
            "tres fuentes distintas, sin aclaración ni reconciliación en ningún lado. "
            "El landing page, agent.json y el README presumido describen tres formas "
            "completamente diferentes de cómo el producto hace dinero — y las tres son "
            "incompatibles entre sí.",
            "El <b>landing HTML</b> declara pricing <b>buyer-side</b>: "
            "<b>«$0.99–$9.99 One-Time — No subscriptions. No per-call fees. No tiered plans. "
            "Pay once, own forever.»</b> Esto implica que MarketNow cobra directamente al "
            "comprador por cada skill que instala, con un precio entre $0.99 y $9.99 por "
            "skill.",
            "El <b>agent.json.pricing</b> declara lo opuesto — pricing <b>seller-side</b>: "
            "<b>«MarketNow does NOT sell skills. We administer a free marketplace + sell "
            "Sentinel subscriptions to sellers.»</b> Y luego enumera tres tiers para "
            "vendedores: FREE $0, PRO $9.99/mo, ENTERPRISE $49.99/mo. Esto implica que "
            "MarketNow <b>nunca</b> cobra al comprador — solo cobra al vendedor por "
            "el servicio de auditoría y listing.",
            "Y en una tercera capa de pricing — presumiblemente del README histórico que "
            "no está disponible públicamente porque el repo GitHub retorna 404 (ver F2) — "
            "se mencionaba un modelo <b>B2B</b> con tiers Free/Team $99/Enterprise Custom. "
            "Esta tercera capa aparece referenciada en conversaciones archivadas pero no "
            "pudo verificarse contra fuentes vivas.",
        ],
        evidence_rows=[
            ('landing.html', '"$0.99–$9.99 One-Time — No subscriptions. No per-call fees. No tiered plans. Pay once, own forever."'),
            ('agent.json.pricing.model', '"MarketNow does NOT sell skills. We administer a free marketplace + sell Sentinel subscriptions to sellers."'),
            ('agent.json.pricing.seller_tiers', 'FREE $0 forever / PRO $9.99/mo / ENTERPRISE $49.99/mo'),
            ('agent.json.pricing.no_per_skill_fees_for_buyers', 'true'),
            ('agent.json.pricing.no_subscriptions_for_buyers', 'true'),
            ('README.md (referenced, not accessible)', 'Presumed to declare Free / Team $99 / Enterprise Custom ( unverifiable - repo 404)'),
            ('Number of distinct pricing models', '3 (buyer one-time, seller subscription, B2B team tier)'),
        ],
        impact_paragraphs=[
            "<b>Impacto comercial</b>: la contradicción entre «cobra al comprador $0.99-$9.99» "
            "y «no cobra al comprador» es la clase de inconsistencia que hace que un "
            "comprador potencial cierre la pestaña del navegador y nunca vuelva. No es "
            "una discrepancia técnica — es una discrepancia sobre el modelo de negocio "
            "mismo. Un inversionista en due diligence detectaría esto en 60 segundos.",
            "<b>Impacto en agentes automatizados</b>: un agente que consulte "
            "<font name='%s'>agent.json</font> para decidir si puede usar MarketNow en un "
            "flujo automatizado leerá «MarketNow does NOT sell skills» y concluirá que "
            "no hay costos al comprador. Pero si un humano revisa el landing page, verá "
            "«$0.99-$9.99 One-Time» y concluirá lo contrario. Esto rompe el modelo de "
            "delegación de confianza entre humano y agente." % MONO,
            "<b>Impacto legal</b>: la discrepancia entre el landing page y agent.json "
            "sobre el precio cobrado al comprador podría interpretarse como publicidad "
            "engañosa. Si MarketNow cobra $0.99 al comprador y el landing dice eso, "
            "pero agent.json dice «does NOT sell skills», al menos una de las dos fuentes "
            "es falsa. La FTC Section 5 (USA) y la ley ecuatoriana equivalente "
            "(Ley Orgánica de Defensa del Consumidor) prohíben afirmaciones falsas "
            "sobre precio.",
            "<b>Impacto en mandates</b>: el sistema de mandates delegados (x402 + AP2) "
            "depende de que el agente sepa con certeza cuánto puede gastar y a quién. "
            "Si el agente cree que el precio máximo es $9.99 (landing) pero el sistema "
            "realmente cobra al vendedor (agent.json), el flujo de mandate se rompe "
            "conceptualmente: no hay nada que delegar al agente si no se le cobra.",
        ],
        fix_description=(
            "Se confirma <b>agent.json.pricing</b> como la fuente de verdad (modelo B2B "
            "seller-side). Se añade un campo nuevo <font name='%s'>pricing.source_of_truth</font> "
            "que hace explícito que este bloque es canónico y que el landing debe derivar "
            "de él. Se añade también <font name='%s'>pricing.buyer_pricing</font> que "
            "documenta explícitamente que los compradores pagan $0. Se marca el landing "
            "HTML para actualización en el próximo deploy: eliminar la mención de "
            "«$0.99–$9.99 One-Time» y reemplazarla por «Free for buyers — sellers subscribe "
            "to Sentinel»." % (MONO, MONO)
        ),
        fix_code=(
            "# agent.json.fixed — new fields added\n"
            "\"pricing\": {\n"
            "  \"model\": \"MarketNow does NOT sell skills to buyers. We administer a free marketplace + sell Sentinel subscriptions to SELLERS. ... The $0.99-$9.99 One-Time wording on the landing page is INCORRECT and is scheduled for removal in the next landing deploy — see REPORT.pdf finding F5.\",\n"
            "  \"source_of_truth\": \"This agent.json block is the canonical pricing source. Landing page and README must match.\",\n"
            "  \"buyer_pricing\": {\n"
            "    \"model\": \"free\",\n"
            "    \"per_skill_fee\": 0,\n"
            "    \"subscription_fee\": 0,\n"
            "    \"explanation\": \"Buyers never pay MarketNow. All 9,248 skills are free to install.\"\n"
            "  }\n"
            "}\n"
            "\n"
            "# TODO: landing.html deploy needed\n"
            "# BEFORE: \"$0.99–$9.99 One-Time — No subscriptions. No per-call fees.\"\n"
            "# AFTER:  \"Free for buyers — sellers subscribe to Sentinel (PRO $9.99/mo, ENTERPRISE $49.99/mo)\"\n"
        ),
        before_after=(
            "--- landing.html (original, NOT yet fixed)\n"
            "+++ landing.html (target after deploy — TODO)\n"
            "@@ pricing section @@\n"
            "-43 Free MCP Skills — No Payment, No Signup\n"
            "-Real value, zero cost. 43 hand-curated skills available for instant download. No credit card, no mandate, no signup required.\n"
            "+All 9,248 skills are FREE for buyers. No payment to MarketNow, no signup, no mandate required.\n"
            "+Sellers subscribe to Sentinel (PRO $9.99/mo, ENTERPRISE $49.99/mo) to list and sell their own skills.\n"
            "@@ pricing tiers @@\n"
            "-$0.99–$9.99 One-Time — No subscriptions. No per-call fees. No tiered plans. Pay once, own forever.\n"
            "+Buyers: $0 (all 9,248 skills free)\n"
            "+Sellers: FREE / PRO $9.99/mo / ENTERPRISE $49.99/mo\n"
        ),
    ))

    # === F6: Version drift ===
    story.extend(build_finding(
        fid='F6', severity='P1',
        title='Versión npm (1.10.0) vs agent.json mcp_server.version (1.6.0)',
        description=[
            "El paquete npm <font name='%s'>marketnow-mcp</font> tiene publicadas <b>15 "
            "versiones</b> desde el 2026-06-29 hasta el 2026-08-09 (latest 1.10.0). "
            "Sin embargo, el archivo <font name='%s'>agent.json</font> declara en su "
            "campo <font name='%s'>mcp_server.version</font> el valor <b>«1.6.0»</b> — "
            "es decir, <b>4 versiones atrás</b>. Y la lista de tools que declara "
            "(9 herramientas) está <b>4 tools corta</b> respecto a lo que dice el landing "
            "y el changelog de npm (13 tools en v1.10.0)." % (MONO, MONO, MONO),
            "Esto significa que un agente que consulte <font name='%s'>agent.json</font> "
            "para saber qué versión del MCP server debe instalar, recibirá la instrucción "
            "de instalar 1.6.0 — una versión de julio 2026 — perdiéndose 4 releases "
            "consecutivos de funcionalidad nueva, incluyendo la crítica "
            "<font name='%s'>marketnow_verify_atc_spec</font> que es la pieza central "
            "del ATC/1.0 conformance verifier introducida en 1.10.0." % (MONO, MONO),
        ],
        evidence_rows=[
            ('npm latest version', '1.10.0 (released 2026-08-09)'),
            ('npm total versions', '15 (1.5.1, 1.6.0, 1.7.0, 1.8.0, 1.9.0, 1.10.0 + intermediate)'),
            ('npm package created', '2026-06-29T02:46:00.231Z'),
            ('agent.json.mcp_server.version', '1.6.0 (4 versions behind)'),
            ('agent.json.mcp_server.tools', '9 tools declared (search_skills, get_skill, list_categories, get_manifest, get_install_command, verify_trust, verify_receipt, submit_skill, recommend_skills)'),
            ('landing.html claims', '"13 tools including marketnow_verify_atc_spec"'),
            ('agent.json.mcp_server.new_in_v1_6_0', 'Documents only v1.6.0 changes (verify_receipt). v1.7.0-v1.10.0 changes not documented.'),
            ('Version drift', '4 minor versions, ~6 weeks of changes undocumented'),
        ],
        impact_paragraphs=[
            "<b>Impacto en agents</b>: un agente que siga las instrucciones de "
            "<font name='%s'>agent.json</font> instalará <font name='%s'>marketnow-mcp@1.6.0</font> "
            "(vía <font name='%s'>npx -y marketnow-mcp</font> que sin tag de versión "
            "instala la latest, pero la documentación sugiere 1.6.0). Esto significa que "
            "no tendrá acceso a las 4 herramientas nuevas más importantes: "
            "<font name='%s'>marketnow_verify_atc_spec</font>, "
            "<font name='%s'>marketnow_verify_trust</font>, "
            "<font name='%s'>marketnow_get_owasp_compliance</font>, "
            "<font name='%s'>marketnow_get_sentinel_report</font>." % (MONO, MONO, MONO, MONO, MONO, MONO, MONO),
            "<b>Impacto en trust model</b>: el ATC/1.0 conformance verifier "
            "(<font name='%s'>marketnow_verify_atc_spec</font>) es la herramienta que "
            "permite verificar cualquier Agent Trust Card sin importar el emisor — pieza "
            "central del modelo de confianza interoperable. Si los agentes instalan "
            "1.6.0 basándose en agent.json, no tienen esta herramienta y por tanto no "
            "pueden verificar tarjetas ATC emitidas por terceros CAs." % MONO,
            "<b>Impacto en maintenance signal</b>: el campo <font name='%s'>mcp_server.version</font> "
            "obsoleto en agent.json es una señal de que la documentación no se mantiene "
            "sincronizada con los releases. Esto erosiona la confianza en el proceso "
            "de release: si ni siquiera el archivo «machine-readable» principal se "
            "actualiza con cada release, ¿qué otras partes del sistema están "
            "desactualizadas?" % MONO,
        ],
        fix_description=(
            "Se actualiza <font name='%s'>mcp_server.version</font> a <b>1.10.0</b>. "
            "Se actualiza la lista de tools a <b>13 items</b> (añadiendo las 4 nuevas). "
            "Se reemplaza <font name='%s'>new_in_v1_6_0</font> por "
            "<font name='%s'>new_in_v1_10_0</font> documentando los cambios reales del "
            "último release. Se añade un campo <font name='%s'>version</font> de nivel "
            "superior a agent.json con valor 1.10.0, sincronizado con npm. Se añade "
            "<font name='%s'>version_source_of_truth</font> apuntando al registry de npm "
            "para que sea explícito que npm es la fuente canónica de versionado." % (MONO, MONO, MONO, MONO, MONO)
        ),
        fix_code=(
            "# agent.json.fixed — version sync\n"
            "Top-level: \"version\": \"1.10.0\"\n"
            "Top-level: \"version_source_of_truth\": \"npm registry: https://registry.npmjs.org/marketnow-mcp\"\n"
            "\n"
            "mcp_server.version: \"1.10.0\"   (was 1.6.0)\n"
            "mcp_server.tools_count: 13       (was 9)\n"
            "mcp_server.tools: [\n"
            "  \"search_skills\", \"get_skill\", \"list_categories\", \"get_manifest\",\n"
            "  \"get_install_command\", \"verify_trust\", \"verify_receipt\",\n"
            "  \"submit_skill\", \"recommend_skills\",\n"
            "  # NEW in 1.7.0-1.10.0:\n"
            "  \"marketnow_verify_atc_spec\",       # ATC/1.0 conformance verifier\n"
            "  \"marketnow_verify_trust\",         # Comprehensive trust assessment\n"
            "  \"marketnow_get_owasp_compliance\", # OWASP MCP Top 10 report\n"
            "  \"marketnow_get_sentinel_report\"   # Full 10-layer Sentinel audit\n"
            "]\n"
        ),
        before_after=(
            "--- agent.json (original)\n"
            "+++ agent.json.fixed\n"
            "@@ mcp_server block @@\n"
            "-\"version\": \"1.6.0\",\n"
            "-\"description\": \"...v1.6.0 adds verify_receipt tool...\",\n"
            "-\"tools\": [\n"
            "-  \"search_skills\", \"get_skill\", \"list_categories\", \"get_manifest\",\n"
            "-  \"get_install_command\", \"verify_trust\", \"verify_receipt\",\n"
            "-  \"submit_skill\", \"recommend_skills\"\n"
            "-],\n"
            "-\"new_in_v1_6_0\": [\n"
            "-  \"verify_receipt(receipt_id) — verify a signed delivery proof...\",\n"
            "-  \"ATC schema v1.1.0: sentinel_review_score + decision_authority fields\",\n"
            "-  \"Action-receipts emitted on every paid purchase...\"\n"
            "-],\n"
            "-\"repo\": \"https://github.com/edgarfloresguerra2011-a11y/marketnow/tree/master/mcp-server\"\n"
            "+\"version\": \"1.10.0\",\n"
            "+\"description\": \"...v1.10.0 adds marketnow_verify_atc_spec, a self-contained ATC/1.0 conformance verifier...\",\n"
            "+\"tools\": [\n"
            "+  \"search_skills\", \"get_skill\", \"list_categories\", \"get_manifest\",\n"
            "+  \"get_install_command\", \"verify_trust\", \"verify_receipt\",\n"
            "+  \"submit_skill\", \"recommend_skills\",\n"
            "+  \"marketnow_verify_atc_spec\", \"marketnow_verify_trust\",\n"
            "+  \"marketnow_get_owasp_compliance\", \"marketnow_get_sentinel_report\"\n"
            "+],\n"
            "+\"tools_count\": 13,\n"
            "+\"repo\": \"https://github.com/alicelabs-llc/marketnow/tree/main/mcp-server\",\n"
            "+\"new_in_v1_10_0\": [\n"
            "+  \"marketnow_verify_atc_spec(atc_json) — self-contained ATC/1.0 conformance verifier\",\n"
            "+  \"marketnow_verify_trust(skill_id) — comprehensive trust assessment\",\n"
            "+  \"marketnow_get_owasp_compliance(skill_id) — OWASP MCP Top 10 report\",\n"
            "+  \"marketnow_get_sentinel_report(skill_id) — full 10-layer Sentinel audit\"\n"
            "+]\n"
        ),
    ))

    # === F7: /api/manifest.json 404 ===
    story.extend(build_finding(
        fid='F7', severity='P2',
        title='/api/manifest.json retorna 404 pero está declarado en robots.txt',
        description=[
            "El archivo <font name='%s'>robots.txt</font> de marketnow.site declara "
            "explícitamente <b>«Allow: /api/manifest.json»</b> como un endpoint válido "
            "que los crawlers y agentes pueden consultar. Sin embargo, al hacer la "
            "request, el endpoint retorna <b>404 NOT_FOUND</b> con el body "
            "<font name='%s'>\"The page could not be found\"</font> y un identificador "
            "interno <font name='%s'>hkg1::r4rln-1787094222473-0d92bbb10226</font> "
            "(Vercel edge function trace ID, indicando que el request sí llegó al "
            "runtime pero no hay handler para esa ruta)." % (MONO, MONO, MONO),
            "Adicionalmente, la lista de tools que declara <font name='%s'>mcp_server.tools</font> "
            "en agent.json incluye <b>«get_manifest»</b> como una herramienta disponible — "
            "lo que implica que el MCP server promete a los agentes que pueden obtener "
            "el manifest. Si el endpoint subyacente no existe, la tool fallará en runtime." % MONO,
        ],
        evidence_rows=[
            ('robots.txt', '"Allow: /api/manifest.json" (declared as valid)'),
            ('GET /api/manifest.json', 'HTTP 404 — body: "The page could not be found"'),
            ('Vercel trace ID', 'hkg1::r4rln-1787094222473-0d92bbb10226'),
            ('agent.json.mcp_server.tools', 'Includes "get_manifest" as a callable tool'),
            ('agent.json.endpoints', 'No entry for /api/manifest.json (only agent.json, skills-lite.json, search, etc.)'),
            ('agent.json.documentation', 'No /api/manifest.json in documentation list'),
            ('Status', 'Endpoint declared in robots.txt but not implemented'),
        ],
        impact_paragraphs=[
            "<b>Impacto en crawlers</b>: los crawlers de buscadores (Google, Bing, Baidu) "
            "y los LLM crawlers (ChatGPT, Claude, etc. — explícitamente bienvenidos según "
            "el comentario en robots.txt) encontrarán un 404 al seguir el enlace declarado. "
            "Esto afecta negativamente el SEO y la discoverability del proyecto.",
            "<b>Impacto en agents</b>: si un agente sigue las instrucciones de "
            "<font name='%s'>agent.json</font> e intenta llamar la tool "
            "<font name='%s'>get_manifest</font>, recibirá un error. Esto degrada la "
            "experiencia de integración y puede llevar al agente a marcar el servicio "
            "como no confiable." % (MONO, MONO),
            "<b>Impacto menor comparado con F1-F6</b>: este es un problema de higiene "
            "operacional más que de trust. La severidad P2 refleja que el impacto es "
            "limitado (un endpoint roto) pero debe arreglarse para mantener la "
            "consistencia del surface público.",
        ],
        fix_description=(
            "Se documenta el problema en el bloque <font name='%s'>endpoints</font> de "
            "agent.json.fixed con un campo <font name='%s'>_manifest_json_status</font> "
            "que hace explícito el estado actual. La remediación real requiere o bien "
            "(a) implementar el endpoint <font name='%s'>/api/manifest.json</font> "
            "retornando un manifest machine-readable del proyecto (recomendado), o "
            "(b) eliminar la línea <font name='%s'>Allow: /api/manifest.json</font> "
            "de robots.txt. La opción (a) es preferible porque el manifest sería útil "
            "para tooling de discoverability." % (MONO, MONO, MONO, MONO)
        ),
        fix_code=(
            "# agent.json.fixed — endpoints block updated\n"
            "\"endpoints\": {\n"
            "  ... (existing endpoints preserved) ...,\n"
            "  \"_manifest_json_status\": {\n"
            "    \"declared_in\": \"robots.txt (Allow: /api/manifest.json)\",\n"
            "    \"actual_status\": \"404 NOT_FOUND as of 2026-08-19\",\n"
            "    \"remediation\": \"Either implement /api/manifest.json (machine-readable project manifest) or remove the Allow: line from robots.txt. Tracked in REPORT.pdf finding F7.\"\n"
            "  }\n"
            "}\n"
            "\n"
            "# TODO for next deploy (choose one):\n"
            "#   Option A: implement /api/manifest.json (recommended)\n"
            "#     - Returns JSON with project name, version, license, capabilities\n"
            "#     - Should include the same metrics block added in fix for F4\n"
            "#   Option B: remove the Allow: line from robots.txt\n"
            "#     - If no plan to implement manifest.json, the declaration is misleading\n"
        ),
        before_after=(
            "--- robots.txt + agent.json.endpoints (original)\n"
            "+++ robots.txt (no change yet) + agent.json.fixed\n"
            "@@ robots.txt @@\n"
            " (no change applied — TODO: implement endpoint OR remove Allow line)\n"
            "@@ agent.json.endpoints (new field added) @@\n"
            "+\"_manifest_json_status\": {\n"
            "+  \"declared_in\": \"robots.txt (Allow: /api/manifest.json)\",\n"
            "+  \"actual_status\": \"404 NOT_FOUND as of 2026-08-19\",\n"
            "+  \"remediation\": \"Either implement /api/manifest.json or remove the Allow line from robots.txt.\"\n"
            "+}\n"
        ),
    ))

    # === F8: Track record inconsistency ===
    story.extend(build_finding(
        fid='F8', severity='P2',
        title='Track record disclosure inconsistente con landing page',
        description=[
            "El campo <font name='%s'>trust.track_record_disclosure</font> en agent.json "
            "es uno de los mejores elementos del modelo de trust de MarketNow: una "
            "declaración honesta y transparente sobre el estado actual del proyecto. "
            "Dice literalmente: «<i>AliceLabs LLC founded 2025 in Wyoming, USA. MarketNow "
            "launched publicly 2026. Founder Edison Flores is Ecuadorian. No third-party "
            "press coverage yet. No public bug bounty yet. Trust is being built, not "
            "claimed.</i>»" % MONO,
            "El problema es que esta declaración entra en conflicto con el landing HTML, "
            "que dice <b>«Founded 2024 by Edison Flores»</b>. La discrepancia entre "
            "2024 (landing) y 2025 (agent.json.trust.track_record_disclosure) ya fue "
            "documentada en F3, pero F8 documenta específicamente que el campo más "
            "honesto y auto-consciente del modelo de trust también es inconsistente "
            "con el landing — lo que erosiona el valor de la transparencia.",
        ],
        evidence_rows=[
            ('agent.json.trust.track_record_disclosure', '"AliceLabs LLC founded 2025 in Wyoming, USA. MarketNow launched publicly 2026."'),
            ('landing.html', '"Maintained by AliceLabs LLC Founded 2024 by Edison Flores"'),
            ('GitHub org alicelabs-llc.created_at', '2026-03-30 (could be confused with founding date)'),
            ('npm package.created', '2026-06-29 (MarketNow launch, not AliceLabs founding)'),
            ('Distinct dates referenced', '4 (2024, 2025, 2026-03-30, 2026-06-29)'),
        ],
        impact_paragraphs=[
            "<b>Impacto en transparencia</b>: la transparencia solo funciona si es "
            "consistente. El campo <font name='%s'>track_record_disclosure</font> es un "
            "ejemplo positivo de comunicación honesta («no hay cobertura de prensa aún, "
            "no hay bug bounty aún»). Pero esa honestidad se cancela si el landing "
            "contradice la fecha de fundación en 1 año. Un lector cuidadoso notará la "
            "discrepancia y se preguntará: si no pueden ponerse de acuerdo sobre cuándo "
            "se fundaron, ¿cómo confío en sus otras claims de transparencia?" % MONO,
            "<b>Impacto menor que F3</b>: la severidad P2 (vs P1 de F3) refleja que "
            "este hallazgo es esencialmente un subconjunto de F3 — la misma "
            "inconsistencia de fecha, pero específicamente en el campo que más "
            "depende de la consistencia para tener valor.",
        ],
        fix_description=(
            "Se unifica <font name='%s'>track_record_disclosure</font> con la timeline "
            "consolidada: AliceLabs LLC founded 2025 (legal filing), GitHub org created "
            "2026-03-30, MarketNow launched publicly 2026-06-29 (npm 1.5.1). Se añade "
            "el conteo de versiones npm actuales (15) y la fecha del último release "
            "(2026-08-09) para hacer la declaración más concreta." % MONO
        ),
        fix_code=(
            "# agent.json.fixed — trust.track_record_disclosure\n"
            "\"track_record_disclosure\": \"AliceLabs LLC was legally founded in 2025 in Wyoming, USA (founder Edison Flores, Ecuadorian). The GitHub organization github.com/alicelabs-llc was created 2026-03-30. MarketNow was launched publicly on 2026-06-29 (first npm release: marketnow-mcp@1.5.1). As of 2026-08-19: 15 versions published on npm (latest 1.10.0), 9,248 skills indexed, no third-party press coverage yet, no public bug bounty yet. Trust is being built, not claimed.\"\n"
        ),
        before_after=(
            "--- agent.json.trust.track_record_disclosure (original)\n"
            "+++ agent.json.fixed\n"
            "@@ track_record_disclosure @@\n"
            "-AliceLabs LLC founded 2025 in Wyoming, USA. MarketNow launched publicly 2026. Founder Edison Flores is Ecuadorian. No third-party press coverage yet. No public bug bounty yet. Trust is being built, not claimed.\n"
            "+AliceLabs LLC was legally founded in 2025 in Wyoming, USA (founder Edison Flores, Ecuadorian). The GitHub organization github.com/alicelabs-llc was created 2026-03-30. MarketNow was launched publicly on 2026-06-29 (first npm release: marketnow-mcp@1.5.1). As of 2026-08-19: 15 versions published on npm (latest 1.10.0), 9,248 skills indexed, no third-party press coverage yet, no public bug bounty yet. Trust is being built, not claimed.\n"
        ),
    ))

    return story


def build_remediation_plan():
    story = []
    story.append(Paragraph("4. Plan de Remediación", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph(
        "La remediación se organiza en tres oleadas por prioridad. Cada oleada es "
        "autopersistente: se puede deployar sin esperar la siguiente. La semana 1 "
        "cierra los riesgos legales y reputacionales críticos; la semana 2 cierra "
        "las inconsistencias documentales que afectan a agentes automatizados; la "
        "semana 3 cierra los issues de higiene operacional.",
        STYLES['BodyJustify']))

    story.append(Paragraph("Oleada 1 — P0 Críticos (Semana 1)", STYLES['H2']))
    p0_data = [
        [Paragraph('<b>ID</b>', STYLES['Body']), Paragraph('<b>Hallazgo</b>', STYLES['Body']),
         Paragraph('<b>Acción</b>', STYLES['Body']), Paragraph('<b>Entregable</b>', STYLES['Body'])],
        [Paragraph('F1', STYLES['Body']),
         Paragraph('Licencia triple', STYLES['Body']),
         Paragraph('Unificar a MNNC-1.0 en agent.json + package.json + LICENSE', STYLES['Body']),
         Paragraph('agent.json.fixed + package.json.fixed + LICENSE', STYLES['Body'])],
        [Paragraph('F2', STYLES['Body']),
         Paragraph('GitHub URL dual 404', STYLES['Body']),
         Paragraph('Crear repo github.com/alicelabs-llc/marketnow; unificar todas las URLs', STYLES['Body']),
         Paragraph('Repo created + agent.json.fixed + package.json.fixed + README.md', STYLES['Body'])],
        [Paragraph('F5', STYLES['Body']),
         Paragraph('Pricing triple', STYLES['Body']),
         Paragraph('Confirmar modelo B2B seller-side; actualizar landing HTML para eliminar $0.99-$9.99', STYLES['Body']),
         Paragraph('agent.json.fixed (source of truth) + landing.html deploy (TODO)', STYLES['Body'])],
    ]
    t = Table(p0_data, colWidths=[1*cm, 3.5*cm, 7*cm, 4.5*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,0), COLORS['p0_bg']),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    story.append(t)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Oleada 2 — P1 Altos (Semana 2)", STYLES['H2']))
    p1_data = [
        [Paragraph('<b>ID</b>', STYLES['Body']), Paragraph('<b>Hallazgo</b>', STYLES['Body']),
         Paragraph('<b>Acción</b>', STYLES['Body']), Paragraph('<b>Entregable</b>', STYLES['Body'])],
        [Paragraph('F3', STYLES['Body']),
         Paragraph('Fecha fundación triple', STYLES['Body']),
         Paragraph('Unificar a 2025; landing update para eliminar 2024', STYLES['Body']),
         Paragraph('agent.json.fixed + landing update', STYLES['Body'])],
        [Paragraph('F4', STYLES['Body']),
         Paragraph('Conteo skills 5 valores', STYLES['Body']),
         Paragraph('Unificar a 9,248; añadir bloque metrics top-level', STYLES['Body']),
         Paragraph('agent.json.fixed (con metrics block)', STYLES['Body'])],
        [Paragraph('F6', STYLES['Body']),
         Paragraph('Versión drift npm 1.10 vs agent 1.6', STYLES['Body']),
         Paragraph('Sync a 1.10.0; actualizar tools[] a 13 items', STYLES['Body']),
         Paragraph('agent.json.fixed (mcp_server block)', STYLES['Body'])],
    ]
    t = Table(p1_data, colWidths=[1*cm, 3.5*cm, 7*cm, 4.5*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,0), COLORS['p1_bg']),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    story.append(t)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Oleada 3 — P2 Medios (Semana 3)", STYLES['H2']))
    p2_data = [
        [Paragraph('<b>ID</b>', STYLES['Body']), Paragraph('<b>Hallazgo</b>', STYLES['Body']),
         Paragraph('<b>Acción</b>', STYLES['Body']), Paragraph('<b>Entregable</b>', STYLES['Body'])],
        [Paragraph('F7', STYLES['Body']),
         Paragraph('/api/manifest.json 404', STYLES['Body']),
         Paragraph('Implementar endpoint O eliminar línea de robots.txt', STYLES['Body']),
         Paragraph('Endpoint handler OR robots.txt update', STYLES['Body'])],
        [Paragraph('F8', STYLES['Body']),
         Paragraph('Track record inconsistente', STYLES['Body']),
         Paragraph('Unificar con timeline de F3', STYLES['Body']),
         Paragraph('agent.json.fixed (track_record_disclosure)', STYLES['Body'])],
    ]
    t = Table(p2_data, colWidths=[1*cm, 3.5*cm, 7*cm, 4.5*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,0), COLORS['p2_bg']),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    story.append(t)

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "<b>Precondiciones para ejecución</b>: para deployar en Vercel se requiere "
        "(a) un token de Vercel con scope Full Account y expiración ≤ 1 hora (crear "
        "en https://vercel.com/account/tokens), (b) el CLI de Vercel instalado "
        "localmente (<font name='%s'>npm i -g vercel</font>), (c) acceso al código "
        "fuente del proyecto (este paquete) en un directorio local. La cuenta de "
        "GitHub baneada impide el deploy vía GitHub integration, pero Vercel CLI "
        "deploya directamente sin pasar por GitHub." % MONO,
        STYLES['BodyJustify']))

    story.append(PageBreak())
    return story


def build_deploy_guide():
    story = []
    story.append(Paragraph("5. Guía de Deploy (Vercel CLI)", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph(
        "Esta guía asume que (a) la cuenta de GitHub del propietario está baneada "
        "(no se puede git push), (b) el deploy se hace directamente a Vercel desde "
        "el CLI local sin pasar por GitHub, y (c) el token temporal de Vercel "
        "tiene expiración ≤ 1 hora para minimizar el riesgo de exposición.",
        STYLES['BodyJustify']))

    story.append(Paragraph("Paso 1 — Preparar el directorio de deploy", STYLES['H2']))
    story.append(Paragraph(
        "El contenido de este paquete debe copiarse al directorio raíz del proyecto "
        "MarketNow. Si el repo original no existe (caso F2: 404), se debe clonar "
        "de cualquier fork o copia local disponible, o crear el repo nuevo en "
        "<font name='%s'>github.com/alicelabs-llc/marketnow</font> (la organización "
        "ya existe) y subir el código que está en este paquete." % MONO,
        STYLES['BodyJustify']))
    story.append(code_block(
        "# En tu máquina local\n"
        "mkdir marketnow-deploy && cd marketnow-deploy\n"
        "\n"
        "# Descomprime el ZIP de fixes\n"
        "unzip marketnow-fixes.zip\n"
        "\n"
        "# Si tienes una copia del código fuente existente, cópiala aquí.\n"
        "# Si no, usa los archivos .fixed como base y crea el resto del proyecto\n"
        "# alrededor de ellos (package.json, app/, api/, etc.)\n"
        "\n"
        "# Renombra los archivos .fixed a sus nombres finales\n"
        "mv agent.json.fixed agent.json   # solo si tu proyecto sirve agent.json estático\n"
        "mv package.json.fixed package.json\n"
        "\n"
        "# Copia los archivos nuevos\n"
        "cp LICENSE .\n"
        "cp README.md .\n"
        "cp NOTICE .\n"
        "mkdir -p .github && cp .github/SECURITY.md .github/\n"
        "\n"
        "# Verifica que el proyecto sirve /api/agent.json desde el archivo local\n"
        "# (típicamente: el archivo se sirve como static file en /public/api/agent.json)\n"
        "# Si es así, muévelo a la ruta correcta:\n"
        "mkdir -p public/api && cp agent.json public/api/agent.json\n"
    ))

    story.append(Paragraph("Paso 2 — Crear token temporal de Vercel", STYLES['H2']))
    story.append(Paragraph(
        "Antes de generar el token, <b>revoca cualquier token previo</b> que haya sido "
        "compartido en chats, logs, o capturas de pantalla. Los tokens de Vercel son "
        "credenciales de alta sensibilidad y deben tratarse como contraseñas.",
        STYLES['BodyJustify']))
    story.append(code_block(
        "# PASO 1: Revoca tokens previos comprometidos\n"
        "# Ve a: https://vercel.com/account/tokens\n"
        "# Identifica cualquier token creado en las últimas 24h y revócalo.\n"
        "\n"
        "# PASO 2: Crea un token nuevo con expiración de 1 HORA\n"
        "# Name: marketnow-deploy-2026-08-19\n"
        "# Scope: Full Account (necesario para vercel deploy --prod)\n"
        "# Expiration: 1 hour\n"
        "# (NO marques \"No expiration\" — esto sería irresponsable)\n"
        "\n"
        "# PASO 3: Copia el token (empieza con \"vcp_\")\n"
        "# Guárdalo en tu portapapeles. NO lo pegues en chat, logs, o archivos.\n"
    ))

    story.append(Paragraph("Paso 3 — Instalar Vercel CLI", STYLES['H2']))
    story.append(Paragraph(
        "Si aún no tienes el CLI de Vercel instalado, instálalo con npm. La versión "
        "mínima requerida es 32+ (para soporte completo de Next.js 16 y "
        "<font name='%s'>--token</font> flag)." % MONO,
        STYLES['BodyJustify']))
    story.append(code_block(
        "npm install -g vercel\n"
        "vercel --version   # debe mostrar >=32.0.0\n"
    ))

    story.append(Paragraph("Paso 4 — Deploy con token temporal", STYLES['H2']))
    story.append(Paragraph(
        "El comando <font name='%s'>vercel deploy --prod --token=...</font> deploya "
        "directamente a producción sin requerir GitHub. Antes de ejecutarlo, verifica "
        "que el archivo <font name='%s'>vercel.json</font> (si existe) esté "
        "configurado para servir el archivo <font name='%s'>public/api/agent.json</font> "
        "como static file. Si tu proyecto usa Next.js API routes, asegúrate de que el "
        "endpoint <font name='%s'>/api/agent.json</font> lea del archivo local y no "
        "esté hardcoded en el código." % (MONO, MONO, MONO, MONO),
        STYLES['BodyJustify']))
    story.append(code_block(
        "# En el directorio raíz del proyecto\n"
        "cd marketnow-deploy\n"
        "\n"
        "# Verifica la estructura\n"
        "ls -la\n"
        "# Debes ver: package.json, README.md, LICENSE, NOTICE,\n"
        "#            .github/, public/api/agent.json, etc.\n"
        "\n"
        "# Deploy con token temporal (reemplaza TU_TOKEN_AQUI)\n"
        "vercel deploy --prod --token=vcp_TU_TOKEN_AQUI\n"
        "\n"
        "# El deploy tomará 1-3 minutos. Vercel mostrará la URL de producción\n"
        "# al final: https://marketnow-xxx.vercel.app (o tu dominio custom si lo tienes)\n"
    ))

    story.append(Paragraph("Paso 5 — Verificar el deploy", STYLES['H2']))
    story.append(Paragraph(
        "Una vez completado el deploy, verifica que los fixes estén en producción "
        "haciendo requests a los endpoints afectados. Los siguientes checks son "
        "obligatorios:",
        STYLES['BodyJustify']))
    story.append(code_block(
        "# 1. Verifica que agent.json sirve los fixes\n"
        "curl -s https://marketnow.site/api/agent.json | python3 -c \"\n"
        "import json, sys\n"
        "d = json.load(sys.stdin)\n"
        "assert d['license'].startswith('MNNC-1.0'), f'F1 FAIL: license={d[\\\"license\\\"][:50]}'\n"
        "assert d['trust']['github'] == 'https://github.com/alicelabs-llc/marketnow', f'F2 FAIL'\n"
        "assert '2024' not in d['trust'].get('track_record_disclosure', ''), f'F3 FAIL: 2024 still present'\n"
        "assert d['metrics']['skills_indexed'] == 9248, f'F4 FAIL'\n"
        "assert d['pricing']['buyer_pricing']['per_skill_fee'] == 0, f'F5 FAIL'\n"
        "assert d['mcp_server']['version'] == '1.10.0', f'F6 FAIL'\n"
        "assert d['mcp_server']['tools_count'] == 13, f'F6 FAIL: tools_count'\n"
        "print('All 7 checks PASSED')\n"
        "\"\n"
        "\n"
        "# 2. Verifica que npm package.json está actualizado\n"
        "curl -s https://registry.npmjs.org/marketnow-mcp | python3 -c \"\n"
        "import json, sys\n"
        "d = json.load(sys.stdin)\n"
        "v = d['versions'][d['dist-tags']['latest']]\n"
        "assert v['repository']['url'] == 'git+https://github.com/alicelabs-llc/marketnow.git', f'F2 FAIL: repo URL'\n"
        "assert v['license'] == 'MNNC-1.0', f'F1 FAIL: npm license'\n"
        "print('npm metadata OK')\n"
        "\"\n"
        "\n"
        "# 3. (Opcional) Verifica que /api/manifest.json ya no da 404 (si se implementó)\n"
        "curl -s -o /dev/null -w \"%{http_code}\\n\" https://marketnow.site/api/manifest.json\n"
        "# Debe retornar 200 si se implementó, 404 si se eliminó de robots.txt\n"
    ))

    story.append(Paragraph("Paso 6 — Revocar el token temporal", STYLES['H2']))
    story.append(Paragraph(
        "<b>Inmediatamente después de que el deploy y la verificación estén "
        "completos, revoca el token temporal.</b> No esperes a que expire solo. "
        "Ve a https://vercel.com/account/tokens, encuentra el token "
        "«marketnow-deploy-2026-08-19» y haz clic en Delete. Esto cierra el ciclo "
        "de seguridad: el token existió solo durante el tiempo mínimo necesario "
        "para ejecutar un solo comando.",
        STYLES['BodyJustify']))
    story.append(code_block(
        "# PASO FINAL (no opcional)\n"
        "1. Ve a https://vercel.com/account/tokens\n"
        "2. Identifica el token temporal creado en el Paso 2\n"
        "3. Haz clic en \"Delete\" (icono de trash)\n"
        "4. Confirma la eliminación\n"
        "5. Verifica que ya no aparezca en la lista de tokens activos\n"
        "\n"
        "# El token YA NO ES VÁLIDO para futuros deploys. Para el próximo deploy,\n"
        "# crea un token nuevo siguiendo el mismo procedimiento.\n"
    ))

    story.append(PageBreak())
    return story


def build_recommendations():
    story = []
    story.append(Paragraph("6. Recomendaciones Adicionales", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph(
        "Más allá de los 8 hallazgos específicos, la auditoría identificó 5 patrones "
        "sistémicos que, si no se abordan, harán que vuelvan a aparecer inconsistencias "
        "similares en el futuro. Estas recomendaciones son de carácter preventivo y "
        "operacional, no se incluyen como parches en este paquete pero deberían "
        "implementarse en el roadmap post-deploy.",
        STYLES['BodyJustify']))

    story.append(Paragraph("R1 — Establecer source-of-truth único", STYLES['H2']))
    story.append(Paragraph(
        "El problema raíz que causó los 8 hallazgos es la falta de una fuente de "
        "verdad canónica. agent.json debería ser esa fuente — el landing, README, "
        "npm package.json y cualquier material de marketing deberían generarse "
        "automáticamente a partir de agent.json. Implementación recomendada: un "
        "script <font name='%s'>scripts/sync-from-agent.js</font> que lea agent.json "
        "y regenere el landing HTML, README.md y package.json en cada release. "
        "Esto elimina la clase entera de inconsistencias de tipeo manual." % MONO,
        STYLES['BodyJustify']))

    story.append(Paragraph("R2 — CI/CD con validación de consistencia", STYLES['H2']))
    story.append(Paragraph(
        "Agregar un step al pipeline CI que valide consistencia entre agent.json, "
        "package.json, README.md y el landing HTML. Cualquier discrepancia "
        "(conteo de skills, versión, licencia, URL GitHub) debe fallar el build. "
        "Esto puede implementarse con un script <font name='%s'>scripts/audit-consistency.py</font> "
        "que se ejecute en GitHub Actions antes del deploy. Ejemplo: si "
        "<font name='%s'>agent.json.mcp_server.version</font> no coincide con "
        "<font name='%s'>package.json.version</font>, el CI falla." % (MONO, MONO, MONO),
        STYLES['BodyJustify']))

    story.append(Paragraph("R3 — Implementar notify_and_veto mode", STYLES['H2']))
    story.append(Paragraph(
        "El campo <font name='%s'>trust_model.notification_modes.notify_and_veto</font> "
        "está documentado pero marcado como «on roadmap». Esto es un gap crítico: el "
        "modelo de trust promete tres modos, pero solo dos están implementados. "
        "Un agente que lea agent.json podría intentar usar <font name='%s'>notify_and_veto</font> "
        "y recibir un error. Recomendación: implementar en el siguiente release "
        "(v1.11.0) con un endpoint <font name='%s'>POST /api/mandate/:id/veto</font> "
        "que acepte vetos dentro de la ventana de 5 minutos." % (MONO, MONO, MONO),
        STYLES['BodyJustify']))

    story.append(Paragraph("R4 — Publicar el interceptor runtime con su nombre real", STYLES['H2']))
    story.append(Paragraph(
        "El término «interceptor» aparece en el landing HTML («runtime interceptor with "
        "8 enforcement rules») pero no está documentado en agent.json. La auditoría "
        "no pudo verificar si es un componente separado o parte del sandbox gVisor "
        "L2.5. Recomendación: crear una página <font name='%s'>/interceptor</font> "
        "que documente las 8 reglas de enforcement, su orden de aplicación, y los "
        "patrones de prompt injection que detectan. Esto aumentará la transparencia "
        "del runtime trust layer." % MONO,
        STYLES['BodyJustify']))

    story.append(Paragraph("R5 — Anticipar el tercer audit L3 (Q1 2027)", STYLES['H2']))
    story.append(Paragraph(
        "El roadmap declara L3 third-party audit para 2027. Para que esa auditoría "
        "no reproduzca los mismos hallazgos, recomendamos: (a) contratar a un "
        "external auditor (no Z.ai, no AliceLabs) con 6 meses de anticipación, "
        "(b) publicar el scope completo del audit antes de que empiece para "
        "feedback público, (c) implementar el bug bounty program antes del audit "
        "para recibir community findings primero. Una auditoría externa sobre un "
        "proyecto con inconsistencias documentales conocidas no encontraría nada "
        "nuevo — primero se cierran los issues internos, luego se invita a "
        "terceros.",
        STYLES['BodyJustify']))

    story.append(PageBreak())
    return story


def build_appendix():
    story = []
    story.append(Paragraph("Apéndice A — Archivos en este paquete", STYLES['H1']))
    story.append(section_rule())

    story.append(Paragraph(
        "Este paquete de auditoría contiene los siguientes archivos. Todos están "
        "diseñados para ser aplicados sin modificar la lógica de negocio del "
        "proyecto — solo corrigen inconsistencias documentales y de metadata.",
        STYLES['BodyJustify']))

    files = [
        ['agent.json.fixed', 'Versión corregida de agent.json', 'Aplica F1, F2, F3, F4, F5, F6, F8'],
        ['package.json.fixed', 'Versión corregida del npm package.json', 'Aplica F1, F2'],
        ['LICENSE', 'Texto completo de MNNC-1.0', 'Aplica F1'],
        ['NOTICE', 'Archivo de atribución de terceros', 'Aplica F1'],
        ['README.md', 'README unificado del repo GitHub', 'Aplica F1, F2, F5, F6'],
        ['.github/SECURITY.md', 'Política de seguridad completa', 'Nuevo'],
        ['patches/agent.json.patch', 'Unified diff listo para git apply', 'F1, F2, F3, F4, F5, F6, F8'],
        ['patches/package.json.patch', 'Unified diff para package.json', 'F1, F2'],
        ['patches/LICENSE.patch', 'Diff para el nuevo archivo LICENSE', 'F1'],
        ['patches/README.md.patch', 'Diff para el nuevo archivo README.md', 'F1, F2, F5, F6'],
        ['patches/github-SECURITY.md.patch', 'Diff para .github/SECURITY.md', 'Nuevo'],
        ['patches/NOTICE.patch', 'Diff para NOTICE', 'F1'],
        ['REPORT.pdf', 'Este informe', 'Documentación'],
    ]
    file_data = [[Paragraph('<b>Archivo</b>', STYLES['Body']),
                  Paragraph('<b>Propósito</b>', STYLES['Body']),
                  Paragraph('<b>Hallazgos aplicados</b>', STYLES['Body'])]]
    for row in files:
        file_data.append([Paragraph(f'<font name="{MONO}">{row[0]}</font>', STYLES['Body']),
                          Paragraph(row[1], STYLES['Body']),
                          Paragraph(row[2], STYLES['Body'])])
    t = Table(file_data, colWidths=[5*cm, 7*cm, 4*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,0), HexColor('#F1F5F9')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, COLORS['rule']),
        ('BOX', (0,0), (-1,-1), 0.5, COLORS['rule']),
    ]))
    story.append(t)

    story.append(Spacer(1, 12))
    story.append(Paragraph("Apéndice B — Cómo aplicar los parches", STYLES['H2']))
    story.append(Paragraph(
        "Hay dos formas de aplicar los parches, según el estado del repo GitHub:",
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "<b>Opción A</b> — Si el repo <font name='%s'>github.com/alicelabs-llc/marketnow</font> "
        "ya existe y tiene el código fuente:" % MONO,
        STYLES['Body']))
    story.append(code_block(
        "git clone https://github.com/alicelabs-llc/marketnow.git\n"
        "cd marketnow\n"
        "git checkout -b audit-fixes-2026-08-19\n"
        "\n"
        "# Aplica los parches\n"
        "git apply patches/agent.json.patch\n"
        "git apply patches/package.json.patch\n"
        "git apply patches/LICENSE.patch\n"
        "git apply patches/README.md.patch\n"
        "git apply patches/github-SECURITY.md.patch\n"
        "git apply patches/NOTICE.patch\n"
        "\n"
        "# Si git apply falla por diff context mismatch, usa --3way\n"
        "git apply --3way patches/agent.json.patch\n"
        "\n"
        "# Commit y push (requiere cuenta GitHub no baneada)\n"
        "git add -A\n"
        "git commit -m \"fix(audit): apply 8 findings from Z.ai independent audit\\n\\nSee REPORT.pdf for details. Fixes F1-F8.\"\n"
        "git push origin audit-fixes-2026-08-19\n"
    ))
    story.append(Paragraph(
        "<b>Opción B</b> — Si el repo GitHub no existe o la cuenta está baneada (caso actual):",
        STYLES['Body']))
    story.append(code_block(
        "# Crea un directorio nuevo con el contenido del paquete\n"
        "mkdir marketnow-new && cd marketnow-new\n"
        "unzip marketnow-fixes.zip\n"
        "\n"
        "# Renombra los .fixed a sus nombres finales\n"
        "mv agent.json.fixed public/api/agent.json   # o donde tu framework lo sirva\n"
        "mv package.json.fixed package.json\n"
        "\n"
        "# Copia los archivos nuevos\n"
        "cp LICENSE . && cp NOTICE . && cp README.md .\n"
        "mkdir -p .github && cp .github/SECURITY.md .github/\n"
        "\n"
        "# Deploy directo a Vercel (sin GitHub)\n"
        "npm install -g vercel\n"
        "# Crea token temporal en https://vercel.com/account/tokens (1h expiry)\n"
        "vercel deploy --prod --token=vcp_TU_TOKEN_TEMPORAL\n"
        "\n"
        "# IMPORTANTE: revoca el token inmediatamente después del deploy\n"
    ))

    story.append(Spacer(1, 12))
    story.append(Paragraph("Apéndice C — Contacto del auditor", STYLES['H2']))
    story.append(Paragraph(
        "Esta auditoría fue realizada por Z.ai (independiente de AliceLabs LLC) el "
        "<b>19 de agosto de 2026</b>. Para preguntas sobre el contenido del informe, "
        "solicitar clarificaciones sobre hallazgos específicos, o reportar nuevos "
        "issues descubiertos después de aplicar los parches, contactar a través del "
        "canal donde se solicitó originalmente esta auditoría.",
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "Esta auditoría <b>no constituye asesoría legal</b>. Las referencias a "
        "FTC Section 5, EU AI Act, y ley ecuatoriana de defensa del consumidor "
        "son análisis de impacto y no deben interpretarse como dictamen legal. "
        "Para confirmar las implicaciones legales específicas de las inconsistencias "
        "documentales encontradas, AliceLabs LLC debería consultar con un abogado "
        "especializado en derecho tecnológico de Wyoming.",
        STYLES['BodyJustify']))
    story.append(Paragraph(
        "Esta auditoría <b>no verifica la seguridad criptográfica</b> del ATC/1.0, "
        "del Ed25519 (RFC 8032), del JSON Canonicalization Scheme (RFC 8785), ni "
        "del flujo de verificación on-chain en Base (chainId 8453). Una auditoría "
        "criptográfica profunda requeriría acceso al código fuente del MCP server "
        "(que actualmente no es accesible públicamente — ver F2) y excede el alcance "
        "de este encargo.",
        STYLES['BodyJustify']))

    return story


# ============================================================================
# MAIN
# ============================================================================
def main():
    OUTPUT = Path('/home/z/my-project/download/marketnow-fixes/REPORT.pdf')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = AuditDocTemplate(str(OUTPUT))

    story = []
    story.extend(build_cover())
    story.extend(build_executive_summary())
    story.extend(build_methodology())
    story.extend(build_scope())
    story.extend(build_findings())
    story.extend(build_remediation_plan())
    story.extend(build_deploy_guide())
    story.extend(build_recommendations())
    story.extend(build_appendix())

    print(f"Building PDF with {len(story)} flowables...")
    doc.build(story)

    size_kb = OUTPUT.stat().st_size / 1024
    print(f"\nDone: {OUTPUT}")
    print(f"Size: {size_kb:.1f} KB")

    # Get page count
    try:
        from pypdf import PdfReader
        r = PdfReader(str(OUTPUT))
        print(f"Pages: {len(r.pages)}")
    except ImportError:
        pass


if __name__ == '__main__':
    main()
