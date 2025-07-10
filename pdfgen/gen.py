import json
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Регистрация шрифта
try:
    pdfmetrics.registerFont(TTFont('Arial', 'Arial.ttf'))
except Exception as e:
    print(f"Ошибка регистрации шрифта Arial: {e}")
    # Можно продолжить без регистрации или выбрать стандартный шрифт

styles = getSampleStyleSheet()

# Создаем стиль для заголовка с шрифтом Arial
title_style = ParagraphStyle(
    'TitleArial',
    parent=styles['Title'],
    fontName='Arial',
    fontSize=14,
    leading=16
)

style_normal = ParagraphStyle(
    'Normal_CYR',
    parent=styles['Normal'],
    fontName='Arial',
    fontSize=8,
    leading=10
)

json_filename = 'address.json'
pdf_filename = 'public_Network_Samara.pdf'
zagolovok_text = "Публичные точки доступа к сети Интернет (Самара)"

try:
    with open(json_filename, 'r', encoding='utf-8') as f:
        dannye = json.load(f)
except Exception as e:
    print(f"Ошибка чтения файла {json_filename}: {e}")
    exit(1)

try:
    # Создаем PDF документ и задаем метаданные
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=18
    )

    # Установка метаданных
    doc.title = "Публичные точки доступа к сети Интернет (Самара)"
    doc.author = "Ваше имя или организация"  # замените при необходимости
    doc.subject = "Отчет по точкам доступа"

    elementy = []

    # Заголовок с использованием собственного стиля
    elementy.append(Paragraph(zagolovok_text, title_style))
    elementy.append(Paragraph(" ", styles['Normal']))  # пустая строка

    # Таблица с заголовками
    dannye_table = [['№', 'Провайдер', 'Адрес', 'Метка']]

    for punkt in dannye:
        nomer = punkt.get('номер', '')
        provayder = punkt.get('оператор', '') 
        adres = punkt.get('адрес', '')
        koord_str = punkt.get('координаты', '').strip()

        # Разделение координат
        koord_split = koord_str.split()
        if len(koord_split) >= 2:
            # В JSON: долгота (dl), широта (sh)
            dl = koord_split[0]
            sh = koord_split[1]
            ssylka_na_kartu_web = f"https://yandex.ru/maps/?ll={sh},{dl}&z=16&pt={sh},{dl}"
            ssylka_na_kartu_app = f"yandexmaps://maps?ll={sh},{dl}&z=16&pt={sh},{dl}"
            html_ssylka = (
                f'<a href="{ssylka_na_kartu_app}">Открыть в приложении</a> / '
                f'<a href="{ssylka_na_kartu_web}">Веб-версия</a>'
            )
            ssylka_paragraph = Paragraph(html_ssylka, style_normal)
        else:
            ssylka_paragraph = Paragraph('Нет координат', style_normal)

        dannye_table.append([
            Paragraph(str(nomer), style_normal),
            Paragraph(str(provayder), style_normal),
            Paragraph(str(adres), style_normal),
            ssylka_paragraph
        ])

    # Ширина колонок
    col_widths = [30, 70, 250, 80]
    tablitsa = Table(dannye_table, colWidths=col_widths)
    tablitsa.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.black),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Arial'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('BACKGROUND', (0,1), (-1,-1), colors.whitesmoke),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
    ]))

    elementy.append(tablitsa)

    # Генерация PDF
    doc.build(elementy)
    print(f"PDF успешно создан: {pdf_filename}")

except Exception as e:
    print(f"Ошибка при создании PDF: {e}")