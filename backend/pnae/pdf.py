import html
import io
from collections import defaultdict
from datetime import date, datetime

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


HEADER_BLUE = colors.HexColor("#133b5c")
ACCENT_BLUE = colors.HexColor("#2f6690")
TEXT_DARK = colors.HexColor("#1f2937")
TEXT_MUTED = colors.HexColor("#52606d")
BORDER = colors.HexColor("#d8e1eb")
SURFACE = colors.HexColor("#f6f8fb")
SURFACE_ALT = colors.HexColor("#edf2f7")
SUCCESS_BG = colors.HexColor("#eaf7ef")
WARNING_BG = colors.HexColor("#fff6e5")


def _safe_text(value) -> str:
    text = "" if value is None else str(value)
    replacements = {
        "\u2011": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2022": "- ",
        "\u00a0": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text.encode("latin-1", "replace").decode("latin-1")


def _markup(value) -> str:
    text = html.escape(_safe_text(value))
    text = text.replace("&lt;br/&gt;", "<br/>")
    text = text.replace("&lt;br /&gt;", "<br/>")
    text = text.replace("&lt;br&gt;", "<br/>")
    return text.replace("\n", "<br/>")


def _date_text(value) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        local_value = timezone.localtime(value) if timezone.is_aware(value) else value
        return local_value.strftime("%d/%m/%Y %H:%M")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return _safe_text(value)


def _number_text(value, decimals: int = 0) -> str:
    if value is None or value == "":
        return "-"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return _safe_text(value)
    formatted = f"{number:,.{decimals}f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def _currency_text(value) -> str:
    return f"R$ {_number_text(value, 2)}"


def _plain(value, fallback: str = "Nao informado.") -> str:
    text = _safe_text(value).strip()
    return text or fallback


class PnaePlanPdfTemplate(BaseDocTemplate):
    def __init__(self, *args, report_title: str, report_reference: str, generated_label: str, **kwargs):
        self.report_title = report_title
        self.report_reference = report_reference
        self.generated_label = generated_label
        self._heading_counter = 0
        super().__init__(*args, **kwargs)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="content")
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self._draw_chrome)])

    def beforeDocument(self):
        self._heading_counter = 0
        super().beforeDocument()

    def _draw_chrome(self, canv, doc):
        if doc.page == 1:
            return
        width, height = A4
        canv.saveState()
        canv.setFillColor(HEADER_BLUE)
        canv.rect(0, height - 1.15 * cm, width, 1.15 * cm, stroke=0, fill=1)
        canv.setFillColor(colors.white)
        canv.setFont("Helvetica-Bold", 10.5)
        canv.drawString(doc.leftMargin, height - 0.75 * cm, _safe_text(self.report_title[:92]))
        canv.setFont("Helvetica", 8.5)
        canv.drawRightString(width - doc.rightMargin, height - 0.75 * cm, _safe_text(self.report_reference[:76]))

        canv.setStrokeColor(BORDER)
        canv.line(doc.leftMargin, 1.35 * cm, width - doc.rightMargin, 1.35 * cm)
        canv.setFillColor(TEXT_MUTED)
        canv.setFont("Helvetica", 8)
        canv.drawString(doc.leftMargin, 0.92 * cm, _safe_text("Documento formal para prestacao de contas do PNAE"))
        canv.drawRightString(width - doc.rightMargin, 0.92 * cm, _safe_text(f"Pagina {doc.page}"))
        canv.restoreState()

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        style_name = getattr(flowable.style, "name", "")
        if style_name not in {"SectionHeading", "SubsectionHeading"}:
            return
        level = 0 if style_name == "SectionHeading" else 1
        text = flowable.getPlainText()
        self._heading_counter += 1
        bookmark = f"heading-{self._heading_counter}"
        self.canv.bookmarkPage(bookmark)
        self.notify("TOCEntry", (level, text, self.page, bookmark))


def _build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="BodySmall",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=TEXT_DARK,
            spaceAfter=0,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13,
            textColor=TEXT_DARK,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyMuted",
            parent=styles["Body"],
            textColor=TEXT_MUTED,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverEyebrow",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=ACCENT_BLUE,
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=HEADER_BLUE,
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=HEADER_BLUE,
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubsectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=ACCENT_BLUE,
            spaceBefore=8,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TocTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=20,
            textColor=HEADER_BLUE,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MetricLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=TEXT_MUTED,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MetricValue",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=HEADER_BLUE,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            parent=styles["BodySmall"],
            fontSize=8,
            leading=10.2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCellRight",
            parent=styles["TableCell"],
            alignment=TA_RIGHT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SignatureLabel",
            parent=styles["BodySmall"],
            fontName="Helvetica-Bold",
            alignment=TA_CENTER,
            textColor=TEXT_DARK,
        )
    )
    return styles


def _section(title: str, styles) -> Paragraph:
    return Paragraph(_markup(title), styles["SectionHeading"])


def _subsection(title: str, styles) -> Paragraph:
    return Paragraph(_markup(title), styles["SubsectionHeading"])


def _body(text: str, styles, style_name: str = "Body") -> Paragraph:
    return Paragraph(_markup(text), styles[style_name])


def _toc(styles) -> TableOfContents:
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            name="TOCLevel0",
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            leftIndent=18,
            firstLineIndent=-18,
            textColor=TEXT_DARK,
            spaceAfter=4,
        ),
        ParagraphStyle(
            name="TOCLevel1",
            fontName="Helvetica",
            fontSize=8.5,
            leading=10.5,
            leftIndent=34,
            firstLineIndent=-14,
            textColor=TEXT_MUTED,
            spaceAfter=3,
        ),
    ]
    return toc


def _metric_table(metrics, doc_width, styles):
    cells = []
    row = []
    for index, (label, value) in enumerate(metrics, start=1):
        row.append(
            Table(
                [[Paragraph(_markup(label), styles["MetricLabel"])], [Paragraph(_markup(value), styles["MetricValue"])]],
                colWidths=[doc_width / 4 - 8],
                rowHeights=[0.85 * cm, 1.15 * cm],
            )
        )
        if index % 4 == 0:
            cells.append(row)
            row = []
    if row:
        while len(row) < 4:
            row.append("")
        cells.append(row)
    table = Table(cells, colWidths=[doc_width / 4] * 4, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _rich_table(rows, col_widths, styles, right_align_columns=(), header_background=HEADER_BLUE):
    table = LongTable(rows, colWidths=col_widths, repeatRows=1)
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), header_background),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("LEADING", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
        ("GRID", (0, 0), (-1, -1), 0.6, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for column in right_align_columns:
        style_commands.append(("ALIGN", (column, 1), (column, -1), "RIGHT"))
        style_commands.append(("ALIGN", (column, 0), (column, 0), "RIGHT"))
    table.setStyle(TableStyle(style_commands))
    return table


def _info_box(text: str, doc_width, styles, background=SURFACE_ALT):
    table = Table([[Paragraph(_markup(text), styles["Body"])]], colWidths=[doc_width])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def _signature_table(plan, doc_width, styles):
    responsible = _plain(getattr(plan.responsible_nutritionist, "name", "") or getattr(plan.created_by, "name", ""), "-")
    responsible_role = "Responsavel tecnico"
    if getattr(plan.responsible_nutritionist, "crn", ""):
        responsible = f"{responsible} - CRN {plan.responsible_nutritionist.crn}"
    institutional_name = _plain(
        getattr(plan.approved_by, "name", "")
        or getattr(plan.submitted_by, "name", "")
        or getattr(plan.created_by, "name", ""),
        "-",
    )
    institutional_role = "Gestao / aprovacao institucional"
    rows = [
        [
            Paragraph(_markup("<br/><br/>________________________________________"), styles["SignatureLabel"]),
            Paragraph(_markup("<br/><br/>________________________________________"), styles["SignatureLabel"]),
        ],
        [
            Paragraph(_markup(f"{responsible}<br/>{responsible_role}"), styles["SignatureLabel"]),
            Paragraph(_markup(f"{institutional_name}<br/>{institutional_role}"), styles["SignatureLabel"]),
        ],
    ]
    table = Table(rows, colWidths=[doc_width / 2 - 6, doc_width / 2 - 6])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def build_pnae_plan_pdf(plan, operational, *, generated_by=None) -> bytes:
    buffer = io.BytesIO()
    styles = _build_styles()
    generated_at = timezone.localtime(timezone.now())
    month_label = operational["selected_month_label"]
    municipality_name = _plain(
        getattr(getattr(plan.school, "municipality", None), "name", "") or getattr(plan, "city", ""),
        "-",
    )
    report_title = _plain(plan.title or f"Plano PNAE {plan.school.name} {plan.year}")
    report_reference = f"{plan.school.name} | {month_label} | {plan.year}"
    doc = PnaePlanPdfTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.7 * cm,
        rightMargin=1.7 * cm,
        topMargin=2.0 * cm,
        bottomMargin=1.7 * cm,
        title=report_title,
        author="OpenEats / SEMED",
        report_title=report_title,
        report_reference=report_reference,
        generated_label=generated_at.strftime("%d/%m/%Y %H:%M"),
    )
    doc.pageCompression = 0

    annual_summary = operational["annual_summary"]
    detail = operational["detail"]
    estimated_budget = sum(float(item.estimated_amount or 0) for item in plan.budget_items.all())
    executed_budget = sum(float(item.executed_amount or 0) for item in plan.budget_items.all())
    budget_progress = (executed_budget / estimated_budget * 100) if estimated_budget else 0
    completed_actions = sum(1 for action in plan.actions.all() if action.status == action.Status.COMPLETED)
    open_executions = sum(
        1
        for execution in plan.monthly_executions.all()
        if execution.status != execution.Status.COMPLETED
    )
    metrics = [
        ("Itens projetados", _number_text(annual_summary.get("projected_items", 0))),
        ("Porcoes anuais", _number_text(annual_summary.get("projected_servings", 0))),
        ("Custo anual estimado", _currency_text(annual_summary.get("estimated_cost", 0))),
        ("Faltas de estoque", _number_text(annual_summary.get("supplies_with_shortage", 0))),
        ("Metas cadastradas", _number_text(plan.goals.count())),
        ("Acoes concluidas", f"{completed_actions}/{plan.actions.count()}"),
        ("Execucoes em aberto", _number_text(open_executions)),
        ("Execucao orcamentaria", f"{_number_text(budget_progress, 1)}%"),
    ]

    story = []
    cover_meta_rows = [
        ["Municipio", municipality_name],
        ["Escola", plan.school.name],
        ["Ano de referencia", str(plan.year)],
        ["Status", plan.get_status_display()],
        ["Mes operacional em foco", month_label],
        ["Responsavel tecnico", _plain(getattr(plan.responsible_nutritionist, "name", "") or getattr(plan.created_by, "name", ""), "-")],
        ["Orgao executor", _plain(plan.executing_agency, "Secretaria Municipal de Educacao")],
        ["Emitido em", generated_at.strftime("%d/%m/%Y %H:%M")],
    ]
    if generated_by is not None:
        cover_meta_rows.append(["Emitido por", _plain(getattr(generated_by, "name", "") or getattr(generated_by, "email", ""), "-")])

    cover_table = Table(
        [[Paragraph(_markup(label), styles["TableCell"]), Paragraph(_markup(value), styles["Body"])] for label, value in cover_meta_rows],
        colWidths=[doc.width * 0.28, doc.width * 0.72],
    )
    cover_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.9, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    story.extend(
        [
            Spacer(1, 3.2 * cm),
            Paragraph(_markup("Programa Nacional de Alimentacao Escolar"), styles["CoverEyebrow"]),
            Paragraph(_markup(report_title), styles["CoverTitle"]),
            Paragraph(
                _markup("Documento formal para prestacao de contas, acompanhamento gerencial e arquivo institucional."),
                styles["CoverSubtitle"],
            ),
            Spacer(1, 0.6 * cm),
            cover_table,
            Spacer(1, 0.7 * cm),
            _info_box(
                "Este documento consolida os registros do plano anual, suas metas, a execucao mensal, a projecao operacional do periodo selecionado e o historico de tramitacao para fins de acompanhamento tecnico e prestacao de contas.",
                doc.width,
                styles,
                background=SURFACE_ALT,
            ),
            Spacer(1, 0.45 * cm),
            Paragraph(
                _markup(f"Referencia operacional: {month_label}. Documento gerado automaticamente pela plataforma OpenEats / Merenda SEMED."),
                styles["BodyMuted"],
            ),
            PageBreak(),
            Paragraph(_markup("Sumario"), styles["TocTitle"]),
            _toc(styles),
            PageBreak(),
            _section("1. Identificacao do plano", styles),
            _body(
                "Quadro de identificacao institucional do plano anual, utilizado como folha de rosto administrativa para consulta, auditoria e conferencia documental.",
                styles,
            ),
        ]
    )

    metadata_rows = [
        [Paragraph(_markup("Campo"), styles["TableCell"]), Paragraph(_markup("Informacao"), styles["TableCell"])],
        [Paragraph(_markup("Plano"), styles["TableCell"]), Paragraph(_markup(report_title), styles["TableCell"])],
        [Paragraph(_markup("Escola"), styles["TableCell"]), Paragraph(_markup(plan.school.name), styles["TableCell"])],
        [Paragraph(_markup("Municipio"), styles["TableCell"]), Paragraph(_markup(municipality_name), styles["TableCell"])],
        [Paragraph(_markup("Status"), styles["TableCell"]), Paragraph(_markup(plan.get_status_display()), styles["TableCell"])],
        [Paragraph(_markup("Responsavel tecnico"), styles["TableCell"]), Paragraph(_markup(_plain(getattr(plan.responsible_nutritionist, "name", "") or getattr(plan.created_by, "name", ""), "-")), styles["TableCell"])],
        [Paragraph(_markup("Criado por"), styles["TableCell"]), Paragraph(_markup(_plain(getattr(plan.created_by, "name", ""), "-")), styles["TableCell"])],
        [Paragraph(_markup("Criado em"), styles["TableCell"]), Paragraph(_markup(_date_text(plan.created_at)), styles["TableCell"])],
        [Paragraph(_markup("Submetido em"), styles["TableCell"]), Paragraph(_markup(_date_text(plan.submitted_at)), styles["TableCell"])],
        [Paragraph(_markup("Aprovado em"), styles["TableCell"]), Paragraph(_markup(_date_text(plan.approved_at)), styles["TableCell"])],
        [Paragraph(_markup("Reprovado em"), styles["TableCell"]), Paragraph(_markup(_date_text(plan.rejected_at)), styles["TableCell"])],
        [Paragraph(_markup("Ultima atualizacao"), styles["TableCell"]), Paragraph(_markup(_date_text(plan.updated_at)), styles["TableCell"])],
        [Paragraph(_markup("Locais de execucao"), styles["TableCell"]), Paragraph(_markup(_plain(plan.execution_locations)), styles["TableCell"])],
    ]
    story.extend([_rich_table(metadata_rows, [doc.width * 0.28, doc.width * 0.72], styles), Spacer(1, 0.25 * cm)])

    story.extend(
        [
            _section("2. Resumo executivo", styles),
            _body(
                "Painel sintetico com os principais indicadores do exercicio, permitindo leitura rapida do volume planejado, da cobertura operacional e do andamento da execucao.",
                styles,
            ),
            _metric_table(metrics, doc.width, styles),
            Spacer(1, 0.25 * cm),
            _info_box(
                f"No periodo de referencia ({month_label}), o plano projeta {_number_text(detail['summary']['projected_servings'])} porcoes, custo estimado de {_currency_text(detail['summary']['estimated_cost'])} e {_number_text(detail['summary']['supplies_with_shortage'])} itens com necessidade de reposicao na escola.",
                doc.width,
                styles,
                background=SUCCESS_BG,
            ),
            _section("3. Diretrizes e fundamentacao", styles),
            _subsection("3.1 Justificativa", styles),
            _body(_plain(plan.justification), styles),
            _subsection("3.2 Diagnostico da situacao atual", styles),
            _body(_plain(plan.diagnosis_summary), styles),
            _subsection("3.3 Objetivos gerais", styles),
            _body(_plain(plan.general_objectives), styles),
            _subsection("3.4 Estrategia operacional", styles),
            _body(_plain(plan.operational_strategy), styles),
            _subsection("3.5 Arranjo de execucao e registro financeiro", styles),
            _body(
                f"Orgao executor: {_plain(plan.executing_agency, 'Nao informado.')}<br/>"
                f"Locais de execucao: {_plain(plan.execution_locations)}<br/>"
                f"Observacoes financeiras: {_plain(plan.financial_schedule_notes)}",
                styles,
            ),
        ]
    )
    if _plain(plan.notes, "").strip():
        story.extend([_subsection("3.6 Observacoes complementares", styles), _body(_plain(plan.notes), styles)])

    story.extend([_section("4. Metas e indicadores", styles)])
    if plan.goals.exists():
        goal_rows = [
            [
                Paragraph(_markup("Meta"), styles["TableCell"]),
                Paragraph(_markup("Indicador"), styles["TableCell"]),
                Paragraph(_markup("Meta"), styles["TableCellRight"]),
                Paragraph(_markup("Atual"), styles["TableCellRight"]),
                Paragraph(_markup("Prazo"), styles["TableCell"]),
            ]
        ]
        for goal in plan.goals.all():
            goal_rows.append(
                [
                    Paragraph(_markup(goal.title), styles["TableCell"]),
                    Paragraph(_markup(_plain(goal.indicator, "-")), styles["TableCell"]),
                    Paragraph(_markup(_number_text(goal.target_value, 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_number_text(goal.current_value, 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_date_text(goal.due_date)), styles["TableCell"]),
                ]
            )
            if _plain(goal.description, "").strip():
                goal_rows.append(
                    [
                        Paragraph(_markup("Descricao"), styles["TableCell"]),
                        Paragraph(_markup(_plain(goal.description)), styles["TableCell"]),
                        "",
                        "",
                        "",
                    ]
                )
        story.append(_rich_table(goal_rows, [doc.width * 0.26, doc.width * 0.31, doc.width * 0.12, doc.width * 0.12, doc.width * 0.19], styles, right_align_columns=(2, 3)))
    else:
        story.append(_info_box("Nao ha metas cadastradas neste plano.", doc.width, styles))

    story.extend([Spacer(1, 0.2 * cm), _section("5. Plano de acao e cronograma", styles), _subsection("5.1 Acoes previstas", styles)])
    if plan.actions.exists():
        action_rows = [
            [
                Paragraph(_markup("Acao"), styles["TableCell"]),
                Paragraph(_markup("Responsavel"), styles["TableCell"]),
                Paragraph(_markup("Inicio"), styles["TableCell"]),
                Paragraph(_markup("Fim"), styles["TableCell"]),
                Paragraph(_markup("Status"), styles["TableCell"]),
                Paragraph(_markup("Descricao"), styles["TableCell"]),
            ]
        ]
        for action in plan.actions.all():
            action_rows.append(
                [
                    Paragraph(_markup(action.title), styles["TableCell"]),
                    Paragraph(_markup(_plain(action.responsible_sector, "-")), styles["TableCell"]),
                    Paragraph(_markup(_date_text(action.start_date)), styles["TableCell"]),
                    Paragraph(_markup(_date_text(action.end_date)), styles["TableCell"]),
                    Paragraph(_markup(action.get_status_display()), styles["TableCell"]),
                    Paragraph(_markup(_plain(action.description, "-")), styles["TableCell"]),
                ]
            )
        story.append(_rich_table(action_rows, [doc.width * 0.21, doc.width * 0.18, doc.width * 0.11, doc.width * 0.11, doc.width * 0.12, doc.width * 0.27], styles))
    else:
        story.append(_info_box("Nao ha acoes registradas para este plano.", doc.width, styles))

    story.extend([Spacer(1, 0.2 * cm), _subsection("5.2 Cronograma mensal", styles)])
    if plan.schedule_entries.exists():
        schedule_rows = [
            [
                Paragraph(_markup("Mes"), styles["TableCell"]),
                Paragraph(_markup("Atividade"), styles["TableCell"]),
                Paragraph(_markup("Resultado esperado"), styles["TableCell"]),
            ]
        ]
        for entry in plan.schedule_entries.all():
            schedule_rows.append(
                [
                    Paragraph(_markup(f"{entry.month:02d}"), styles["TableCell"]),
                    Paragraph(_markup(entry.activity), styles["TableCell"]),
                    Paragraph(_markup(_plain(entry.expected_result, "-")), styles["TableCell"]),
                ]
            )
        story.append(_rich_table(schedule_rows, [doc.width * 0.12, doc.width * 0.43, doc.width * 0.45], styles))
    else:
        story.append(_info_box("Nao ha cronograma mensal cadastrado.", doc.width, styles))

    story.append(_section("6. Planejamento alimentar anual", styles))
    items_by_month = defaultdict(list)
    for item in plan.items.all():
        items_by_month[item.month].append(item)
    if items_by_month:
        for month in sorted(items_by_month):
            story.extend(
                [
                    _subsection(f"6.{month} Planejamento de {month:02d}/{plan.year}", styles),
                    _body(
                        f"Distribuicao mensal por etapa, modalidade, refeicao e receita para o mes {month:02d}/{plan.year}.",
                        styles,
                    ),
                ]
            )
            item_rows = [
                [
                    Paragraph(_markup("Etapa"), styles["TableCell"]),
                    Paragraph(_markup("Modalidade"), styles["TableCell"]),
                    Paragraph(_markup("Refeicao"), styles["TableCell"]),
                    Paragraph(_markup("Receita"), styles["TableCell"]),
                    Paragraph(_markup("Frequencia"), styles["TableCellRight"]),
                    Paragraph(_markup("Porcoes"), styles["TableCellRight"]),
                ]
            ]
            for item in items_by_month[month]:
                item_rows.append(
                    [
                        Paragraph(_markup(item.education_stage.name), styles["TableCell"]),
                        Paragraph(_markup(item.education_modality.name), styles["TableCell"]),
                        Paragraph(_markup(item.get_meal_type_display()), styles["TableCell"]),
                        Paragraph(_markup(_plain(getattr(item.recipe, "name", ""), "-")), styles["TableCell"]),
                        Paragraph(_markup(_number_text(item.weekly_frequency)), styles["TableCellRight"]),
                        Paragraph(_markup(_number_text(item.servings_planned)), styles["TableCellRight"]),
                    ]
                )
            story.append(_rich_table(item_rows, [doc.width * 0.2, doc.width * 0.2, doc.width * 0.17, doc.width * 0.27, doc.width * 0.08, doc.width * 0.08], styles, right_align_columns=(4, 5)))
            notes = [item.notes.strip() for item in items_by_month[month] if item.notes.strip()]
            if notes:
                story.append(Spacer(1, 0.12 * cm))
                story.append(_info_box("Observacoes do mes: " + " | ".join(_safe_text(note) for note in notes), doc.width, styles))
            story.append(Spacer(1, 0.15 * cm))
    else:
        story.append(_info_box("Nao ha itens operacionais cadastrados para o planejamento alimentar.", doc.width, styles))

    story.extend([_section("7. Orcamento e execucao financeira", styles)])
    story.append(
        _info_box(
            f"Valor estimado no plano: {_currency_text(estimated_budget)} | Valor executado informado: {_currency_text(executed_budget)} | Percentual de execucao: {_number_text(budget_progress, 1)}%",
            doc.width,
            styles,
            background=SUCCESS_BG,
        )
    )
    if plan.budget_items.exists():
        budget_rows = [
            [
                Paragraph(_markup("Categoria"), styles["TableCell"]),
                Paragraph(_markup("Fonte"), styles["TableCell"]),
                Paragraph(_markup("Estimado"), styles["TableCellRight"]),
                Paragraph(_markup("Executado"), styles["TableCellRight"]),
                Paragraph(_markup("Descricao"), styles["TableCell"]),
            ]
        ]
        for item in plan.budget_items.all():
            budget_rows.append(
                [
                    Paragraph(_markup(item.category), styles["TableCell"]),
                    Paragraph(_markup(_plain(item.funding_source, "-")), styles["TableCell"]),
                    Paragraph(_markup(_currency_text(item.estimated_amount)), styles["TableCellRight"]),
                    Paragraph(_markup(_currency_text(item.executed_amount)), styles["TableCellRight"]),
                    Paragraph(_markup(_plain(item.description, "-")), styles["TableCell"]),
                ]
            )
        story.append(_rich_table(budget_rows, [doc.width * 0.19, doc.width * 0.19, doc.width * 0.14, doc.width * 0.14, doc.width * 0.34], styles, right_align_columns=(2, 3)))
    else:
        story.append(_info_box("Nao ha itens orcamentarios cadastrados.", doc.width, styles))

    story.extend([_section("8. Instrumentos de avaliacao", styles)])
    if plan.evaluation_tools.exists():
        tool_rows = [
            [
                Paragraph(_markup("Instrumento"), styles["TableCell"]),
                Paragraph(_markup("Frequencia"), styles["TableCell"]),
                Paragraph(_markup("Publico"), styles["TableCell"]),
                Paragraph(_markup("Descricao"), styles["TableCell"]),
            ]
        ]
        for tool in plan.evaluation_tools.all():
            tool_rows.append(
                [
                    Paragraph(_markup(tool.name), styles["TableCell"]),
                    Paragraph(_markup(_plain(tool.frequency, "-")), styles["TableCell"]),
                    Paragraph(_markup(_plain(tool.target_audience, "-")), styles["TableCell"]),
                    Paragraph(_markup(_plain(tool.description, "-")), styles["TableCell"]),
                ]
            )
        story.append(_rich_table(tool_rows, [doc.width * 0.24, doc.width * 0.16, doc.width * 0.22, doc.width * 0.38], styles))
    else:
        story.append(_info_box("Nao ha instrumentos avaliativos cadastrados.", doc.width, styles))

    story.extend([_section("9. Execucao mensal e evidencias", styles)])
    if plan.monthly_executions.exists():
        execution_rows = [
            [
                Paragraph(_markup("Mes"), styles["TableCell"]),
                Paragraph(_markup("Status"), styles["TableCell"]),
                Paragraph(_markup("Planejado"), styles["TableCellRight"]),
                Paragraph(_markup("Executado"), styles["TableCellRight"]),
                Paragraph(_markup("Progresso"), styles["TableCellRight"]),
                Paragraph(_markup("Registro"), styles["TableCell"]),
            ]
        ]
        for execution in plan.monthly_executions.all():
            notes = []
            if _plain(execution.execution_notes, "").strip():
                notes.append(f"Execucao: {_plain(execution.execution_notes)}")
            if _plain(execution.deviation_notes, "").strip():
                notes.append(f"Desvios: {_plain(execution.deviation_notes)}")
            if execution.evidence_links:
                notes.append("Evidencias: " + " | ".join(_safe_text(link) for link in execution.evidence_links))
            execution_rows.append(
                [
                    Paragraph(_markup(f"{execution.month:02d}"), styles["TableCell"]),
                    Paragraph(_markup(execution.get_status_display()), styles["TableCell"]),
                    Paragraph(_markup(_number_text(execution.planned_servings)), styles["TableCellRight"]),
                    Paragraph(_markup(_number_text(execution.executed_servings)), styles["TableCellRight"]),
                    Paragraph(_markup(f"{_number_text(execution.progress_percent, 0)}%"), styles["TableCellRight"]),
                    Paragraph(_markup("<br/>".join(notes) if notes else "-"), styles["TableCell"]),
                ]
            )
        story.append(_rich_table(execution_rows, [doc.width * 0.08, doc.width * 0.16, doc.width * 0.12, doc.width * 0.12, doc.width * 0.1, doc.width * 0.42], styles, right_align_columns=(2, 3, 4)))
    else:
        story.append(_info_box("Nao ha acompanhamentos mensais registrados.", doc.width, styles))

    story.extend(
        [
            _section("10. Projecao operacional do periodo", styles),
            _body(
                f"Secao dedicada ao mes de referencia {month_label}, com detalhamento das porcoes previstas, custo estimado e necessidades de reposicao para suportar a operacao da escola.",
                styles,
            ),
            _subsection("10.1 Indicadores do mes de referencia", styles),
        ]
    )
    month_metrics = [
        ("Mes selecionado", month_label),
        ("Itens projetados", _number_text(detail["summary"]["projected_items"])),
        ("Ocorrencias", _number_text(detail["summary"]["projected_occurrences"])),
        ("Porcoes", _number_text(detail["summary"]["projected_servings"])),
        ("Custo estimado", _currency_text(detail["summary"]["estimated_cost"])),
        ("Faltas na escola", _number_text(detail["summary"]["supplies_with_shortage"])),
        ("Faltas centrais", _number_text(detail["summary"]["supplies_uncovered_centrally"])),
        ("Itens de compra", _number_text(len(detail["procurement"]))),
    ]
    story.append(_metric_table(month_metrics, doc.width, styles))

    story.extend([Spacer(1, 0.2 * cm), _subsection("10.2 Visao consolidada por mes", styles)])
    overview_rows = [
        [
            Paragraph(_markup("Mes"), styles["TableCell"]),
            Paragraph(_markup("Itens"), styles["TableCellRight"]),
            Paragraph(_markup("Ocorrencias"), styles["TableCellRight"]),
            Paragraph(_markup("Porcoes"), styles["TableCellRight"]),
            Paragraph(_markup("Custo"), styles["TableCellRight"]),
            Paragraph(_markup("Faltas"), styles["TableCellRight"]),
        ]
    ]
    for item in operational["monthly_overview"]:
        overview_rows.append(
            [
                Paragraph(_markup(item["month_label"]), styles["TableCell"]),
                Paragraph(_markup(_number_text(item["projected_items"])), styles["TableCellRight"]),
                Paragraph(_markup(_number_text(item["projected_occurrences"])), styles["TableCellRight"]),
                Paragraph(_markup(_number_text(item["projected_servings"])), styles["TableCellRight"]),
                Paragraph(_markup(_currency_text(item["estimated_cost"])), styles["TableCellRight"]),
                Paragraph(_markup(_number_text(item["supplies_with_shortage"])), styles["TableCellRight"]),
            ]
        )
    story.append(_rich_table(overview_rows, [doc.width * 0.19, doc.width * 0.11, doc.width * 0.16, doc.width * 0.16, doc.width * 0.22, doc.width * 0.16], styles, right_align_columns=(1, 2, 3, 4, 5)))

    story.extend([Spacer(1, 0.2 * cm), _subsection("10.3 Necessidades de abastecimento", styles)])
    if detail["procurement"]:
        procurement_rows = [
            [
                Paragraph(_markup("Insumo"), styles["TableCell"]),
                Paragraph(_markup("Unid."), styles["TableCell"]),
                Paragraph(_markup("Necessario"), styles["TableCellRight"]),
                Paragraph(_markup("Saldo escola"), styles["TableCellRight"]),
                Paragraph(_markup("Saldo central"), styles["TableCellRight"]),
                Paragraph(_markup("Falta escola"), styles["TableCellRight"]),
                Paragraph(_markup("Falta central"), styles["TableCellRight"]),
                Paragraph(_markup("Custo"), styles["TableCellRight"]),
            ]
        ]
        for item in detail["procurement"]:
            procurement_rows.append(
                [
                    Paragraph(_markup(item["supply_name"]), styles["TableCell"]),
                    Paragraph(_markup(item["unit"]), styles["TableCell"]),
                    Paragraph(_markup(_number_text(item["qty_needed"], 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_number_text(item["school_stock_available"], 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_number_text(item["central_stock_available"], 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_number_text(item["school_shortage"], 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_number_text(item["central_shortage"], 2)), styles["TableCellRight"]),
                    Paragraph(_markup(_currency_text(item["estimated_cost"])), styles["TableCellRight"]),
                ]
            )
        story.append(
            _rich_table(
                procurement_rows,
                [
                    doc.width * 0.24,
                    doc.width * 0.07,
                    doc.width * 0.1,
                    doc.width * 0.1,
                    doc.width * 0.1,
                    doc.width * 0.1,
                    doc.width * 0.1,
                    doc.width * 0.19,
                ],
                styles,
                right_align_columns=(2, 3, 4, 5, 6, 7),
            )
        )
    else:
        story.append(_info_box("Nao ha necessidade de compra ou reposicao para o mes selecionado.", doc.width, styles, background=SUCCESS_BG))

    if detail.get("warnings"):
        story.extend([Spacer(1, 0.2 * cm), _subsection("10.4 Alertas operacionais", styles)])
        for warning in detail["warnings"]:
            story.append(_info_box(_safe_text(warning), doc.width, styles, background=WARNING_BG))
            story.append(Spacer(1, 0.08 * cm))

    story.extend([_section("11. Tramitacao, pareceres e historico", styles)])
    workflow_rows = [
        [
            Paragraph(_markup("Data"), styles["TableCell"]),
            Paragraph(_markup("Acao"), styles["TableCell"]),
            Paragraph(_markup("Responsavel"), styles["TableCell"]),
            Paragraph(_markup("Transicao"), styles["TableCell"]),
            Paragraph(_markup("Comentario"), styles["TableCell"]),
        ]
    ]
    for event in plan.workflow_events.all():
        transition = f"{_plain(event.from_status, '-')} -> {_plain(event.to_status, '-')}"
        workflow_rows.append(
            [
                Paragraph(_markup(_date_text(event.created_at)), styles["TableCell"]),
                Paragraph(_markup(event.get_action_display()), styles["TableCell"]),
                Paragraph(_markup(_plain(getattr(event.actor, "name", ""), "-")), styles["TableCell"]),
                Paragraph(_markup(transition), styles["TableCell"]),
                Paragraph(_markup(_plain(event.comment, "-")), styles["TableCell"]),
            ]
        )
    story.append(_rich_table(workflow_rows, [doc.width * 0.16, doc.width * 0.18, doc.width * 0.18, doc.width * 0.18, doc.width * 0.3], styles))
    story.append(Spacer(1, 0.15 * cm))
    story.append(
        _info_box(
            "Ultimo parecer registrado: " + _plain(plan.last_review_comment, "Nao ha parecer consolidado registrado."),
            doc.width,
            styles,
            background=SURFACE_ALT,
        )
    )

    story.extend(
        [
            _section("12. Declaracao final", styles),
            _body(
                "Declara-se que este documento consolida as informacoes atualmente registradas na plataforma para fins de acompanhamento tecnico, auditoria interna e organizacao da prestacao de contas do PNAE.",
                styles,
            ),
            Spacer(1, 0.45 * cm),
            _signature_table(plan, doc.width, styles),
        ]
    )

    doc.multiBuild(story)
    return buffer.getvalue()
