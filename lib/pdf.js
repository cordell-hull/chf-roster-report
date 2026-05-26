import { PDFDocument, rgb, StandardFonts } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { ORG_CONFIG } from '../config/org.js';

const PAGE_WIDTH = 792;   // Landscape
const PAGE_HEIGHT = 612;

export class PDFGenerator {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = null;
    this.currentY = 0;
    this.font = null;
    this.fontBold = null;
    this.margins = { top: 40, bottom: 40, left: 30, right: 30 };
    this.colors = ORG_CONFIG.pdf.colors;
    this.fonts = { ...ORG_CONFIG.pdf.fonts, body: 8, caption: 7, small: 6 };
    this.contentWidth = PAGE_WIDTH - this.margins.left - this.margins.right;
  }

  async init() {
    this.pdfDoc = await PDFDocument.create();
    this.pdfDoc.setTitle('Teacher Roster');
    this.pdfDoc.setAuthor(ORG_CONFIG.pdf.author);
    this.pdfDoc.setCreationDate(new Date());
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.addNewPage();
  }

  addNewPage() {
    this.currentPage = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.currentY = PAGE_HEIGHT - this.margins.top;
  }

  addPageIfNeeded(h) {
    if (this.currentY - h < this.margins.bottom) { this.addNewPage(); return true; }
    return false;
  }

  addSpace(s) { this.currentY -= s; }

  _sanitize(text) { return (text || '').replace(/[\r\n]+/g, ' ').trim(); }

  async drawOrgHeader() {
    let logoBytes = null;
    try {
      const resp = await fetch(ORG_CONFIG.logoPath);
      if (resp.ok) logoBytes = new Uint8Array(await (await resp.blob()).arrayBuffer());
    } catch {}

    if (logoBytes) {
      try {
        let img;
        try { img = await this.pdfDoc.embedPng(logoBytes); }
        catch { img = await this.pdfDoc.embedJpg(logoBytes); }
        const maxH = 40, maxW = 100;
        const aspect = img.width / img.height;
        let w = maxW, h = w / aspect;
        if (h > maxH) { h = maxH; w = h * aspect; }
        this.currentPage.drawImage(img, {
          x: this.margins.left, y: this.currentY - h, width: w, height: h
        });
      } catch {}
    }

    const rightX = PAGE_WIDTH - this.margins.right;
    let textY = this.currentY - 10;
    const nameW = this.fontBold.widthOfTextAtSize(ORG_CONFIG.name, 10);
    this.currentPage.drawText(ORG_CONFIG.name, {
      x: rightX - nameW, y: textY, size: 10, font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= 50;
  }

  drawTitle(title, subtitle, schoolYear) {
    this.addSpace(5);
    const tw = this.fontBold.widthOfTextAtSize(title, 16);
    this.currentPage.drawText(title, {
      x: (PAGE_WIDTH - tw) / 2, y: this.currentY - 16,
      size: 16, font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= 22;

    if (subtitle) {
      const sw = this.fontBold.widthOfTextAtSize(subtitle, 11);
      this.currentPage.drawText(subtitle, {
        x: (PAGE_WIDTH - sw) / 2, y: this.currentY - 11,
        size: 11, font: this.fontBold,
        color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
      });
      this.currentY -= 16;
    }

    if (schoolYear) {
      const yw = this.fontBold.widthOfTextAtSize(`School Year ${schoolYear}`, 10);
      this.currentPage.drawText(`School Year ${schoolYear}`, {
        x: (PAGE_WIDTH - yw) / 2, y: this.currentY - 10,
        size: 10, font: this.font,
        color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
      });
      this.currentY -= 18;
    }
  }

  drawSectionHeading(text) {
    this.addPageIfNeeded(30);
    this.currentY -= 10;
    this.currentPage.drawText(text, {
      x: this.margins.left, y: this.currentY - 11,
      size: 11, font: this.fontBold,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= 14;
    this.currentPage.drawLine({
      start: { x: this.margins.left, y: this.currentY },
      end: { x: PAGE_WIDTH - this.margins.right, y: this.currentY },
      thickness: 1,
      color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
    });
    this.currentY -= 5;
  }

  drawTable(headers, rows, colWidths, fontSize = this.fonts.caption) {
    const rowH = fontSize * 2.2;
    const headerH = fontSize * 2.2;
    const startX = this.margins.left;
    let y = this.currentY;

    const _drawHeader = () => {
      this.currentPage.drawRectangle({
        x: startX, y: y - headerH, width: this.contentWidth, height: headerH,
        color: rgb(this.colors.primary.r, this.colors.primary.g, this.colors.primary.b)
      });
      let hx = startX;
      for (let c = 0; c < headers.length; c++) {
        this.currentPage.drawText(this._sanitize(headers[c]), {
          x: hx + 2, y: y - headerH + 3, size: fontSize, font: this.fontBold,
          color: rgb(1, 1, 1)
        });
        hx += colWidths[c];
      }
      y -= headerH;
    };

    _drawHeader();

    for (let r = 0; r < rows.length; r++) {
      if (y - rowH < this.margins.bottom) {
        this.addNewPage();
        y = this.currentY;
        _drawHeader();
      }

      if (r % 2 === 0) {
        this.currentPage.drawRectangle({
          x: startX, y: y - rowH, width: this.contentWidth, height: rowH,
          color: rgb(this.colors.lightGray.r, this.colors.lightGray.g, this.colors.lightGray.b)
        });
      }

      let x = startX;
      for (let c = 0; c < rows[r].length; c++) {
        const maxChars = Math.floor(colWidths[c] / (fontSize * 0.45)) - 1;
        const cellText = this._sanitize(rows[r][c]).substring(0, Math.max(maxChars, 3));
        this.currentPage.drawText(cellText, {
          x: x + 2, y: y - rowH + 3, size: fontSize, font: this.font,
          color: rgb(this.colors.text.r, this.colors.text.g, this.colors.text.b)
        });
        x += colWidths[c];
      }
      y -= rowH;
    }

    this.currentY = y - 5;
  }

  async generate(report, onProgress = () => {}) {
    onProgress('Initializing PDF...');
    await this.init();
    await this.drawOrgHeader();
    this.drawTitle('TEACHER ROSTER', report.schoolName, report.schoolYear);

    // Teacher table
    onProgress('Building teacher table...');
    this.drawSectionHeading('Teachers');

    const teacherHeaders = ['No', 'Last Name', 'First Name', 'Email', 'M/F', 'Yr', 'DOB', 'Birth City', 'Birth Country', 'Residence', 'Nationality', 'Level', 'State', 'Salary', 'Tenure'];
    const teacherWidths = [22, 65, 55, 100, 25, 22, 55, 50, 55, 50, 50, 45, 30, 45, 63];

    const teacherRows = report.teachers.map((t, i) => [
      String(i + 1),
      t.lastName, t.firstName, t.email, t.gender,
      t.programYear, t.birthDate, t.birthCity, t.birthCountry,
      t.countryOfResidence, t.nationality, t.level, t.state,
      t.yearlySalary,
      `${t.tenureStart || ''} to ${t.tenureEnd || ''}`
    ]);

    this.drawTable(teacherHeaders, teacherRows, teacherWidths, this.fonts.small);

    // Relatives table
    if (report.relatives.length > 0) {
      onProgress('Building relatives table...');
      this.drawSectionHeading('Relatives');

      const relHeaders = ['Last Name', 'First Name', 'Middle', 'Relationship', 'Teacher', 'DOB', 'Birth City', 'Birth Country', 'Residence', 'Nationality'];
      const relWidths = [85, 75, 60, 72, 105, 60, 65, 70, 70, 70];

      const relRows = report.relatives.map(r => {
        const tName = (r.teacherIndex >= 0 && r.teacherIndex < report.teachers.length)
          ? `${report.teachers[r.teacherIndex].firstName} ${report.teachers[r.teacherIndex].lastName}`
          : '';
        return [
          r.lastName, r.firstName, r.middleName, r.relationship, tName,
          r.birthDate, r.birthCity, r.birthCountry, r.countryOfResidence, r.nationality
        ];
      });

      this.drawTable(relHeaders, relRows, relWidths, this.fonts.small);

      this.addSpace(5);
      this.currentPage.drawText(
        'Note: If spouse already has a visa, please note visa type. Children and spouses listed need DS-2019 forms for J-2 visas.',
        { x: this.margins.left, y: this.currentY - this.fonts.caption, size: this.fonts.caption, font: this.font,
          color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b) }
      );
      this.currentY -= this.fonts.caption * 2;
    }

    // Contact + Signature
    onProgress('Adding signature...');
    this.addSpace(15);

    if (report.signature.imageDataUrl) {
      this.addPageIfNeeded(80);
      try {
        const sigData = report.signature.imageDataUrl.split(',')[1];
        const sigBytes = Uint8Array.from(atob(sigData), c => c.charCodeAt(0));
        const sigImage = await this.pdfDoc.embedPng(sigBytes);
        const aspect = sigImage.width / sigImage.height;
        let w = 150, h = w / aspect;
        if (h > 60) { h = 60; w = h * aspect; }
        this.currentPage.drawImage(sigImage, {
          x: this.margins.left, y: this.currentY - h, width: w, height: h
        });
        this.currentY -= h + 5;
      } catch {}
    }

    const sigLine = `${report.signature.signerName || ''} — ${report.signature.signerTitle || ''}`;
    this.currentPage.drawText(this._sanitize(sigLine), {
      x: this.margins.left, y: this.currentY - this.fonts.body,
      size: this.fonts.body, font: this.fontBold,
      color: rgb(this.colors.text.r, this.colors.text.g, this.colors.text.b)
    });
    this.currentY -= this.fonts.body * 1.5;

    const contactLine = `${report.contactFirstName} ${report.contactLastName} — ${report.contactEmail}`;
    this.currentPage.drawText(this._sanitize(contactLine), {
      x: this.margins.left, y: this.currentY - this.fonts.caption,
      size: this.fonts.caption, font: this.font,
      color: rgb(this.colors.secondary.r, this.colors.secondary.g, this.colors.secondary.b)
    });

    // Embed data for import
    onProgress('Finalizing PDF...');
    const dataForEmbed = JSON.parse(JSON.stringify(report));
    delete dataForEmbed.signature.imageDataUrl;
    this.pdfDoc.setSubject(JSON.stringify(dataForEmbed));

    return await this.pdfDoc.save();
  }
}

export async function generatePDF(report, onProgress = () => {}) {
  return await new PDFGenerator().generate(report, onProgress);
}

export function generateFilename(schoolYear, schoolName) {
  const sanitize = (str) => (str || '').replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');
  return `Teacher_Roster_${sanitize(schoolYear)}_${sanitize(schoolName)}.pdf`;
}

export function downloadPDF(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function importReportFromPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer);
  const subject = pdfDoc.getSubject();
  if (!subject) return null;
  try {
    const data = JSON.parse(subject);
    if (!data.schoolName) return null;
    return data;
  } catch { return null; }
}
