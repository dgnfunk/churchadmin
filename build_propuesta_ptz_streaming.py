from pathlib import Path
from datetime import date

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image as RLImage,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUT = Path("outputs/ptz_stream")
OUT.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT / "propuesta_ptz_streaming_iglesia.pdf"
DIAGRAM_PATH = OUT / "diagrama_ptz_streaming.png"

BLUE = colors.HexColor("#2E74B5")
DARK_BLUE = colors.HexColor("#1F4E79")
INK = colors.HexColor("#202020")
MUTED = colors.HexColor("#606060")
LIGHT_BLUE = colors.HexColor("#EAF2F8")
LIGHT_GREEN = colors.HexColor("#EAF7EA")
LIGHT_GOLD = colors.HexColor("#FFF4CC")
LIGHT_GRAY = colors.HexColor("#F4F6F9")
GRID = colors.HexColor("#D9E2EC")


def load_font(name="Arial.ttf", size=22):
    candidates = [
        f"/System/Library/Fonts/Supplemental/{name}",
        f"/Library/Fonts/{name}",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def draw_box(draw, xy, fill, outline, text, title_size=26, body_size=20):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=16, fill=fill, outline=outline, width=3)
    title_font = load_font("Arial Bold.ttf", title_size)
    body_font = load_font("Arial.ttf", body_size)
    lines = text.split("\n")
    heights = []
    widths = []
    for idx, line in enumerate(lines):
        font = title_font if idx == 0 else body_font
        box = draw.textbbox((0, 0), line, font=font)
        widths.append(box[2] - box[0])
        heights.append(box[3] - box[1])
    total_h = sum(heights) + (len(lines) - 1) * 8
    y = y1 + ((y2 - y1) - total_h) / 2
    for idx, line in enumerate(lines):
        font = title_font if idx == 0 else body_font
        w = widths[idx]
        draw.text((x1 + (x2 - x1 - w) / 2, y), line, font=font, fill=(32, 32, 32))
        y += heights[idx] + 8


def draw_arrow(draw, start, end, color, width=7, label=None, label_offset=-26):
    draw.line([start, end], fill=color, width=width)
    import math

    x1, y1 = start
    x2, y2 = end
    angle = math.atan2(y2 - y1, x2 - x1)
    length = 22
    for delta in (2.55, -2.55):
        x = x2 - length * math.cos(angle + delta)
        y = y2 - length * math.sin(angle + delta)
        draw.line([(x2, y2), (x, y)], fill=color, width=width)
    if label:
        font = load_font("Arial.ttf", 17)
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2 + label_offset
        label_w = max(104, draw.textbbox((0, 0), label, font=font)[2] + 22)
        draw.rounded_rectangle(
            (mx - label_w / 2, my - 17, mx + label_w / 2, my + 17),
            radius=8,
            fill=(255, 255, 255),
            outline=(220, 220, 220),
            width=1,
        )
        box = draw.textbbox((0, 0), label, font=font)
        draw.text((mx - (box[2] - box[0]) / 2, my - 10), label, font=font, fill=(70, 70, 70))


def make_diagram():
    img = Image.new("RGB", (1700, 1000), "white")
    d = ImageDraw.Draw(img)
    title = load_font("Arial Bold.ttf", 34)
    subtitle = load_font("Arial.ttf", 22)
    d.text((55, 38), "Ubicacion propuesta para PTZ y luces", font=title, fill=(30, 30, 30))
    d.text((55, 82), "Templo aproximado 18 m de ancho x 35 m de largo - vista superior simplificada, no a escala", font=subtitle, fill=(80, 80, 80))

    room = (70, 145, 1630, 910)
    d.rounded_rectangle(room, radius=22, outline=(170, 170, 170), width=4, fill=(250, 250, 250))
    d.rectangle((70, 145, 1630, 265), fill=(255, 248, 224), outline=(210, 160, 40), width=3)
    d.text((95, 165), "Escenario / pulpito", font=load_font("Arial Bold.ttf", 27), fill=(80, 60, 20))
    d.text((780, 112), "18 m ancho", font=load_font("Arial Bold.ttf", 20), fill=(95, 95, 95))
    d.text((1520, 520), "35 m largo", font=load_font("Arial Bold.ttf", 20), fill=(95, 95, 95))

    # Main physical locations
    draw_box(d, (720, 178, 980, 250), (255, 255, 235), (180, 130, 30), "Pulpito\ncentro", 24, 17)
    draw_box(d, (645, 445, 1055, 535), (217, 239, 255), (46, 116, 181), "Camara PTZ 20x\ncentro arriba - aprox. 2 m altura", 25, 17)
    draw_box(d, (540, 735, 1160, 875), (232, 242, 252), (46, 116, 181), "Cabina / control\nPC streaming + OBS | Switch PoE | Mackie ProFX16v3", 25, 17)

    # Light positions and beams
    draw_box(d, (470, 315, 690, 392), (255, 255, 215), (210, 160, 40), "LED frontal izq.\n45 grados", 22, 16)
    draw_box(d, (1010, 315, 1230, 392), (255, 255, 215), (210, 160, 40), "LED frontal der.\n45 grados", 22, 16)
    d.polygon([(690, 354), (720, 205), (720, 248)], fill=(255, 232, 100), outline=(215, 175, 40))
    d.polygon([(1010, 354), (980, 205), (980, 248)], fill=(255, 232, 100), outline=(215, 175, 40))
    d.arc((660, 185, 1040, 420), start=200, end=340, fill=(215, 175, 40), width=3)
    d.text((455, 405), "MINIMO: 2 LED frontales con dimmer | OPCIONAL: 2 LED laterales de relleno", font=load_font("Arial Bold.ttf", 18), fill=(90, 80, 40))

    # Camera/network path only. Audio and ProPresenter flow are explained in the table.
    d.line([(850, 535), (850, 735)], fill=(55, 150, 75), width=8)
    draw_arrow(d, (850, 650), (850, 735), (55, 150, 75), label="Cat6 + PoE a switch", label_offset=-42)

    # Distance markers
    d.line([(1160, 805), (1385, 805)], fill=(120, 120, 120), width=3)
    d.text((1185, 775), "aprox. 10 m cabina a camara", font=load_font("Arial.ttf", 18), fill=(90, 90, 90))

    # Notes
    note_font = load_font("Arial.ttf", 18)
    d.rounded_rectangle((70, 930, 1630, 980), radius=14, fill=(244, 246, 249), outline=(220, 226, 235))
    d.text(
        (92, 948),
        "Audio Mackie y letras de ProPresenter van a la PC de streaming en cabina; no se dibujan sobre el templo para evitar cruces confusos.",
        font=note_font,
        fill=(45, 45, 45),
    )

    img.save(DIAGRAM_PATH)


def styles():
    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="TitleBlue",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=DARK_BLUE,
            alignment=TA_LEFT,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="Subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=MUTED,
            spaceAfter=12,
        )
    )
    base.add(
        ParagraphStyle(
            name="H1Blue",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=BLUE,
            spaceBefore=12,
            spaceAfter=7,
        )
    )
    base.add(
        ParagraphStyle(
            name="H2Dark",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=DARK_BLUE,
            spaceBefore=8,
            spaceAfter=5,
        )
    )
    base.add(
        ParagraphStyle(
            name="Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.8,
            leading=13.2,
            textColor=INK,
            spaceAfter=6,
        )
    )
    base.add(
        ParagraphStyle(
            name="Small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.5,
            textColor=MUTED,
            spaceAfter=4,
        )
    )
    base.add(
        ParagraphStyle(
            name="Cell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.6,
            leading=9.3,
            textColor=INK,
        )
    )
    base.add(
        ParagraphStyle(
            name="CellBold",
            parent=base["Cell"],
            fontName="Helvetica-Bold",
            textColor=INK,
            alignment=TA_CENTER,
        )
    )
    return base


def para(text, style):
    return Paragraph(text, style)


def bullet(text, style):
    return Paragraph(f"- {text}", style)


def build_table(data, widths, header_fill=LIGHT_GRAY):
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_fill),
                ("TEXTCOLOR", (0, 0), (-1, 0), INK),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(inch, 0.45 * inch, "Propuesta PTZ y streaming - documento de referencia para cotizacion")
    canvas.drawRightString(7.5 * inch, 0.45 * inch, f"Pagina {doc.page}")
    canvas.restoreState()


def build_pdf():
    make_diagram()
    s = styles()
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.7 * inch,
    )
    story = []

    story.append(Paragraph("Propuesta para camara PTZ, grabacion y streaming", s["TitleBlue"]))
    story.append(
        Paragraph(
            f"Iglesia pequena | ProPresenter separado de streaming | Fecha: {date.today().isoformat()}",
            s["Subtitle"],
        )
    )
    story.append(
        Paragraph(
            "Objetivo: agregar una camara PTZ para transmitir principalmente a YouTube en 1080p30, grabar servicios y recibir audio limpio desde la Mackie ProFX16v3, sin poner en riesgo la PC que opera ProPresenter, pantallas y Stage Display.",
            s["Body"],
        )
    )

    meta = [
        [para("Dato", s["CellBold"]), para("Configuracion asumida", s["CellBold"])],
        [para("Dimensiones del templo", s["Cell"]), para("Aprox. 18 m de ancho x 35 m de largo. El diagrama es una vista superior simplificada, no plano arquitectonico.", s["Cell"])],
        [para("Distancias", s["Cell"]), para("Cabina a camara: aprox. 10 m. Camara a pulpito: aprox. 11-12 m.", s["Cell"])],
        [para("Ubicacion de camara", s["Cell"]), para("Centro arriba, aprox. 2 m de altura.", s["Cell"])],
        [para("Audio", s["Cell"]), para("Mackie ProFX16v3 con salida USB o salida auxiliar hacia PC de streaming.", s["Cell"])],
        [para("Resolucion objetivo", s["Cell"]), para("YouTube 1080p30. No se requiere enviar camara a pantallas internas por ahora.", s["Cell"])],
        [para("Condicion critica", s["Cell"]), para("Iluminacion actual pobre; se necesita luz frontal pareja antes o junto con la PTZ.", s["Cell"])],
    ]
    story.append(build_table(meta, [1.7 * inch, 5.3 * inch]))
    story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph("Diagrama de ubicacion y senales", s["H1Blue"]))
    story.append(RLImage(str(DIAGRAM_PATH), width=7.0 * inch, height=4.12 * inch))
    story.append(Spacer(1, 0.08 * inch))
    story.append(
        Paragraph(
            "Las luces LED deben quedar delante del pulpito, una a izquierda y una a derecha, apuntando al rostro a unos 45 grados y con altura mayor que la cara del predicador. Evitar iluminar solo desde arriba o desde atras, porque eso causa sombras, ruido en la imagen y peor auto-tracking. Para un escenario ancho conviene dejar preparada una segunda pareja de luces laterales de relleno.",
            s["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Arquitectura recomendada", s["H1Blue"]))
    for item in [
        "Mantener la PC de ProPresenter dedicada a pantallas, proyectores/TVs y Stage Display.",
        "Usar una segunda PC para OBS, camara PTZ, audio, grabacion y transmision a YouTube.",
        "Conectar la PTZ por Cat6 a un switch PoE dedicado; evitar HDMI largo para la camara.",
        "Llevar el audio de la Mackie ProFX16v3 por USB directo o por salida AUX/Matrix a una interfaz.",
        "Llevar letras/slides de ProPresenter a OBS por NDI/red o por una salida HDMI/capturadora si NDI no es estable.",
        "Agregar iluminacion frontal como parte de la Fase 1. En esta iglesia no es un extra estetico: es necesario para que la camara y el auto-tracking funcionen bien.",
    ]:
        story.append(bullet(item, s["Body"]))

    story.append(Paragraph("Flujo de senales", s["H2Dark"]))
    signal_rows = [
        [para("Origen", s["CellBold"]), para("Conexion", s["CellBold"]), para("Destino", s["CellBold"]), para("Proposito", s["CellBold"])],
        [para("Camara PTZ", s["Cell"]), para("Cat6 + PoE", s["Cell"]), para("Switch PoE / red", s["Cell"]), para("Video de camara y control PTZ.", s["Cell"])],
        [para("Switch PoE / red", s["Cell"]), para("Ethernet", s["Cell"]), para("PC streaming", s["Cell"]), para("OBS recibe camara por red.", s["Cell"])],
        [para("Mackie ProFX16v3", s["Cell"]), para("USB directo o AUX a interfaz", s["Cell"]), para("PC streaming", s["Cell"]), para("Audio limpio para YouTube y grabacion.", s["Cell"])],
        [para("PC ProPresenter", s["Cell"]), para("NDI por red o captura HDMI", s["Cell"]), para("PC streaming", s["Cell"]), para("Letras/slides como fuente separada en OBS.", s["Cell"])],
        [para("PC streaming", s["Cell"]), para("Ethernet a internet", s["Cell"]), para("YouTube Live", s["Cell"]), para("Transmision 1080p30 y grabacion local.", s["Cell"])],
    ]
    story.append(build_table(signal_rows, [1.45 * inch, 1.65 * inch, 1.55 * inch, 2.35 * inch]))

    story.append(Paragraph("PC de streaming recomendada", s["H1Blue"]))
    story.append(
        Paragraph(
            "Como la Mac mini M4 Pro sube bastante el presupuesto, la recomendacion principal cambia a una PC nueva armada o prearmada, no de segunda mano. Para 1080p30 con una PTZ, audio, ProPresenter por NDI/captura, grabacion local y YouTube, una PC moderna de gama media es suficiente si tiene buen SSD, 16-32 GB de RAM, Ethernet estable y buena ventilacion.",
            s["Body"],
        )
    )
    story.append(
        Paragraph(
            "La Mac mini M4 Pro sigue siendo una opcion excelente, pero no es necesaria para esta meta. Una PC nueva con Ryzen 5 o Intel Core i5 moderno evita riesgos de equipos viejos y mantiene compatibilidad amplia con OBS, capturadoras, controladores PTZ, software DMX y herramientas de voluntarios.",
            s["Body"],
        )
    )

    mac_table = [
        [para("Opcion PC streaming", s["CellBold"]), para("Costo referencia", s["CellBold"]), para("Evaluacion", s["CellBold"])],
        [
            para("PC nueva armada - recomendada", s["Cell"]),
            para("$16,000-$26,000 MXN aprox.", s["Cell"]),
            para("Ryzen 5 5600/7600/8600G o Intel i5 moderno, 16-32 GB RAM, SSD 1 TB, Ethernet. Mejor balance para presupuesto limitado.", s["Cell"]),
        ],
        [
            para("PC nueva con NVIDIA", s["Cell"]),
            para("$24,000-$36,000 MXN aprox.", s["Cell"]),
            para("Agregar RTX 3050/4060 ayuda con codificacion NVENC y da mas margen si despues agregan otra camara o mas escenas.", s["Cell"]),
        ],
        [
            para("Mac mini M4 Pro", s["Cell"]),
            para("$33,000-$45,000 MXN aprox.", s["Cell"]),
            para("Muy robusta, silenciosa y sobrada, pero cara para 1080p30. Mantener como opcion premium, no como base.", s["Cell"]),
        ],
    ]
    story.append(build_table(mac_table, [1.9 * inch, 1.65 * inch, 3.45 * inch]))

    story.append(PageBreak())
    story.append(Paragraph("Control y automatizacion de luces", s["H2Dark"]))
    story.append(
        Paragraph(
            "Si se quiere controlar luces desde ProPresenter, lo correcto es usar luces compatibles con DMX o un sistema de control intermedio. ProPresenter no debe alimentar luces directamente; puede disparar escenas/cues hacia un software o controlador de luces mediante MIDI/OSC/atajos, y ese sistema controla las luces por DMX, Art-Net o adaptadores compatibles.",
            s["Body"],
        )
    )
    lighting_control = [
        [para("Nivel", s["CellBold"]), para("Como funciona", s["CellBold"]), para("Costo ref.", s["CellBold"]), para("Comentario", s["CellBold"])],
        [
            para("Manual simple", s["Cell"]),
            para("Luces con perillas/app; se dejan fijas antes del servicio.", s["Cell"]),
            para("$0 extra", s["Cell"]),
            para("Mas barato y suficiente para empezar si solo hay una escena de culto.", s["Cell"]),
        ],
        [
            para("Automatizado basico", s["Cell"]),
            para("ProPresenter dispara una escena en software de luces; luces DMX responden con brillo/preset.", s["Cell"]),
            para("$2k-$8k extra", s["Cell"]),
            para("Requiere interfaz DMX/Art-Net y configuracion inicial.", s["Cell"]),
        ],
        [
            para("Automatizado comodo", s["Cell"]),
            para("Stream Deck/Companion o controlador dedicado activa escenas de OBS, PTZ y luces.", s["Cell"]),
            para("$4k-$12k extra", s["Cell"]),
            para("Mejor para voluntarios; reduce pasos durante el servicio.", s["Cell"]),
        ],
    ]
    story.append(build_table(lighting_control, [1.2 * inch, 3.1 * inch, 1.0 * inch, 1.7 * inch]))

    story.append(PageBreak())
    story.append(Paragraph("Equipo recomendado y precios de referencia", s["H1Blue"]))
    story.append(
        Paragraph(
            "Precios en MXN aproximados para planeacion. Deben cotizarse antes de comprar porque Amazon Mexico y proveedores AV cambian disponibilidad, importacion y envio.",
            s["Small"],
        )
    )
    rows = [
        [
            para("Concepto", s["CellBold"]),
            para("Recomendacion", s["CellBold"]),
            para("Precio ref.", s["CellBold"]),
            para("Prioridad", s["CellBold"]),
            para("Notas", s["CellBold"]),
        ],
        [
            para("Camara PTZ 20x", s["Cell"]),
            para("PTZOptics Move SE 20x con NDI-HX, PoE y auto-tracking", s["Cell"]),
            para("$35k-$50k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("20x es ideal para 11-12 m. Auto-tracking util, pero mantener presets manuales.", s["Cell"]),
        ],
        [
            para("Montaje PTZ", s["Cell"]),
            para("Soporte de pared/techo compatible con la camara", s["Cell"]),
            para("$700-$2k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("Debe quedar firme y permitir mantenimiento.", s["Cell"]),
        ],
        [
            para("Switch PoE", s["Cell"]),
            para("TP-Link/Netgear gigabit PoE, 5-8 puertos", s["Cell"]),
            para("$900-$2.5k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("Dedicado a camara/video; dejar puertos libres para crecimiento.", s["Cell"]),
        ],
        [
            para("Cableado red", s["Cell"]),
            para("Cat6 cobre solido, patch cords, conectores, canaleta", s["Cell"]),
            para("$1.5k-$3.5k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("De cabina a camara y red; etiquetar ambos extremos.", s["Cell"]),
        ],
        [
            para("PC streaming", s["Cell"]),
            para("PC nueva armada/prearmada Ryzen 5 o Intel i5 moderno", s["Cell"]),
            para("$16k-$26k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("Nueva, no reacondicionada. 16-32 GB RAM, SSD 1 TB, Ethernet. GPU NVIDIA opcional.", s["Cell"]),
        ],
        [
            para("Iluminacion pulpito", s["Cell"]),
            para("2 luces COB LED frontales: Godox SL60IID/SL100D, amaran 100d S, Nanlite FS-150B", s["Cell"]),
            para("$5k-$18k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("Colocar a 45 grados hacia el pulpito. Preferir CRI alto, dimmer y misma temperatura.", s["Cell"]),
        ],
        [
            para("Relleno de luz", s["Cell"]),
            para("2 luces adicionales: Godox/Neewer/Nanlite/amaran, segun presupuesto", s["Cell"]),
            para("$3k-$12k", s["Cell"]),
            para("Recom.", s["Cell"]),
            para("Usarlas si hay sombras fuertes, varias personas en plataforma o alabanza amplia.", s["Cell"]),
        ],
        [
            para("Control de luces", s["Cell"]),
            para("DMX/Art-Net + software de luces o Stream Deck/Companion", s["Cell"]),
            para("$2k-$12k", s["Cell"]),
            para("Opcional", s["Cell"]),
            para("Permite automatizar escenas; ProPresenter puede disparar cues hacia el controlador.", s["Cell"]),
        ],
        [
            para("Audio a OBS", s["Cell"]),
            para("USB desde Mackie o interfaz USB si se usa AUX/Matrix", s["Cell"]),
            para("$300-$2.5k", s["Cell"]),
            para("Critico", s["Cell"]),
            para("USB directo puede bastar; interfaz sirve como respaldo o mezcla dedicada.", s["Cell"]),
        ],
        [
            para("UPS", s["Cell"]),
            para("UPS para PC streaming, switch PoE y modem/router", s["Cell"]),
            para("$2k-$5k", s["Cell"]),
            para("Recom.", s["Cell"]),
            para("Reduce cortes por microapagones.", s["Cell"]),
        ],
        [
            para("SSD grabacion", s["Cell"]),
            para("SSD externo 1 TB USB-C/USB 3", s["Cell"]),
            para("$1.2k-$2.5k", s["Cell"]),
            para("Recom.", s["Cell"]),
            para("Separar grabaciones del disco interno.", s["Cell"]),
        ],
        [
            para("Control PTZ", s["Cell"]),
            para("Joystick PTZ o Stream Deck", s["Cell"]),
            para("$2.5k-$15k", s["Cell"]),
            para("Opcional", s["Cell"]),
            para("Al inicio se puede operar con software/presets.", s["Cell"]),
        ],
        [
            para("Herramientas", s["Cell"]),
            para("Probador de red, ponchadora, RJ45, velcro, etiquetas", s["Cell"]),
            para("$800-$2k", s["Cell"]),
            para("Recom.", s["Cell"]),
            para("Necesarias para instalacion voluntaria ordenada.", s["Cell"]),
        ],
    ]
    story.append(build_table(rows, [1.05 * inch, 1.95 * inch, 0.9 * inch, 0.78 * inch, 2.32 * inch]))

    story.append(Spacer(1, 0.12 * inch))
    story.append(
        Paragraph(
            "Subtotal de planeacion con PC nueva y 2 luces frontales: aprox. $65,000-$105,000 MXN, dependiendo de camara, luces y configuracion de PC. Si se agregan 2 luces laterales de relleno, sumar aprox. $3,000-$12,000 MXN. Si se agrega automatizacion DMX/Stream Deck, sumar aprox. $2,000-$12,000 MXN. Estos rangos no incluyen mano de obra porque la instalacion la harian voluntarios.",
            s["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Fases sugeridas", s["H1Blue"]))
    phases = [
        [
            para("Fase", s["CellBold"]),
            para("Compra/Trabajo", s["CellBold"]),
            para("Resultado", s["CellBold"]),
        ],
        [
            para("Fase 1 - base estable", s["Cell"]),
            para("PTZ 20x, switch PoE, cableado Cat6, audio Mackie a OBS, PC streaming nueva dedicada, minimo 2 luces frontales.", s["Cell"]),
            para("Streaming 1080p30 estable a YouTube con grabacion local y menor riesgo para ProPresenter.", s["Cell"]),
        ],
        [
            para("Fase 2 - operacion comoda", s["Cell"]),
            para("Joystick PTZ o Stream Deck, SSD dedicado, UPS, presets refinados, plantilla de OBS, control basico de luces.", s["Cell"]),
            para("Operacion mas sencilla para voluntarios y menos errores durante el servicio.", s["Cell"]),
        ],
        [
            para("Fase 3 - crecimiento", s["Cell"]),
            para("Segunda camara lateral o plano general, mejor internet, luces adicionales.", s["Cell"]),
            para("Produccion mas dinamica para eventos y servicios especiales.", s["Cell"]),
        ],
    ]
    story.append(build_table(phases, [1.25 * inch, 3.15 * inch, 2.6 * inch]))

    story.append(Paragraph("Notas tecnicas", s["H1Blue"]))
    for item in [
        "Probar velocidad real de subida en horario de servicio. Para YouTube 1080p30 conviene tener 15-20 Mbps reales de subida como minimo practico.",
        "Configurar OBS a 1080p30, H.264, bitrate inicial 6-8 Mbps si la subida es estable.",
        "Crear escenas en OBS: camara completa, camara + letras, solo letras, pantalla de espera y pantalla final.",
        "Hacer prueba privada de YouTube antes del primer servicio publico.",
        "Guardar presets de PTZ y no depender totalmente del auto-tracking, especialmente con poca luz o varias personas en escenario.",
    ]:
        story.append(bullet(item, s["Body"]))

    story.append(Paragraph("Fuentes y enlaces para cotizacion", s["H1Blue"]))
    sources = [
        "PTZOptics Move SE: https://ptzoptics.com/move-se/",
        "Apple Mac mini especificaciones: https://www.apple.com/mx/mac-mini/specs/",
        "Apple Mac mini compra Mexico: https://www.apple.com/mx/shop/buy-mac/mac-mini",
        "Mackie ProFX16v3: https://mackie.com/en/products/mixers/profxv3-series/ProFX16v3.html",
        "OBS Studio: https://obsproject.com/",
        "NDI Tools: https://ndi.video/tools/",
        "YouTube encoder settings: https://support.google.com/youtube/answer/2853702?hl=es-419",
        "Busqueda Amazon Mexico PC streaming Ryzen 5: https://www.amazon.com.mx/s?k=pc+gamer+ryzen+5+16gb+ssd",
        "Busqueda Amazon Mexico PC streaming Intel i5: https://www.amazon.com.mx/s?k=pc+intel+i5+16gb+ssd",
        "Busqueda Amazon Mexico PTZ 20x NDI: https://www.amazon.com.mx/s?k=camara+PTZ+20x+NDI",
        "Busqueda Amazon Mexico switch PoE: https://www.amazon.com.mx/s?k=switch+poe+gigabit",
        "Busqueda Amazon Mexico Godox SL60IID: https://www.amazon.com.mx/s?k=Godox+SL60IID",
        "Busqueda Amazon Mexico amaran 100d S: https://www.amazon.com.mx/s?k=amaran+100d+S",
        "Busqueda Amazon Mexico Nanlite FS-150B: https://www.amazon.com.mx/s?k=Nanlite+FS-150B",
        "Busqueda Amazon Mexico DMX interface: https://www.amazon.com.mx/s?k=dmx+usb+interface",
        "Bitfocus Companion: https://bitfocus.io/companion",
        "QLC+ software de luces: https://www.qlcplus.org/",
    ]
    for source in sources:
        story.append(Paragraph(source, s["Small"]))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return PDF_PATH


if __name__ == "__main__":
    print(build_pdf())
