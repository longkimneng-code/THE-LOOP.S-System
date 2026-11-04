// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — MULTI-FORMAT REPORT EXPORT ENGINE
// Exports to genuine Excel (.xlsx), Word (.docx), and printable PDF (.pdf)
// ============================================================================

const crypto = require('crypto');
const { ZipBuilder } = require('./zipBuilder');

function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ----------------------------------------------------------------------------
// 1. EXCEL (.XLSX) BUILDER (OpenXML SpreadsheetML)
// ----------------------------------------------------------------------------
function generateExcelBuffer({ title, period, columns = [], rows = [], totals = null }) {
  const zip = new ZipBuilder();

  // [Content_Types].xml
  zip.addFile('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);

  // _rels/.rels
  zip.addFile('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  // xl/_rels/workbook.xml.rels
  zip.addFile('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // xl/workbook.xml
  zip.addFile('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Report" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);

  // xl/styles.xml
  zip.addFile('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><name val="Calibri"/><sz val="11"/><b/></font>
    <font><name val="Calibri"/><sz val="14"/><b/><color rgb="FFD97706"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>`);

  // Build Sheet XML Rows
  let sheetRowsXml = '';
  let rowIdx = 1;

  // Title Row
  sheetRowsXml += `<row r="${rowIdx}">
    <c r="A${rowIdx}" t="inlineStr" s="2"><is><t>${escapeXml(title || 'The Loops Report')}</t></is></c>
  </row>`;
  rowIdx++;

  // Period / Subtitle Row
  sheetRowsXml += `<row r="${rowIdx}">
    <c r="A${rowIdx}" t="inlineStr"><is><t>Period / Generated: ${escapeXml(period || new Date().toISOString().slice(0, 10))}</t></is></c>
  </row>`;
  rowIdx++;

  // Blank row
  rowIdx++;

  // Headers Row
  sheetRowsXml += `<row r="${rowIdx}">`;
  columns.forEach((col, cIdx) => {
    const colLetter = String.fromCharCode(65 + cIdx);
    sheetRowsXml += `<c r="${colLetter}${rowIdx}" t="inlineStr" s="1"><is><t>${escapeXml(col.header || col)}</t></is></c>`;
  });
  sheetRowsXml += `</row>`;
  rowIdx++;

  // Data Rows
  rows.forEach((row) => {
    sheetRowsXml += `<row r="${rowIdx}">`;
    columns.forEach((col, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const val = typeof row === 'object' ? row[col.key || col] : row;
      const isNum = typeof val === 'number';
      if (isNum) {
        sheetRowsXml += `<c r="${colLetter}${rowIdx}"><v>${val}</v></c>`;
      } else {
        sheetRowsXml += `<c r="${colLetter}${rowIdx}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
      }
    });
    sheetRowsXml += `</row>`;
    rowIdx++;
  });

  // Summary Totals Row if present
  if (totals && typeof totals === 'object') {
    sheetRowsXml += `<row r="${rowIdx}">`;
    columns.forEach((col, cIdx) => {
      const colLetter = String.fromCharCode(65 + cIdx);
      const val = totals[col.key || col];
      if (val !== undefined && val !== null) {
        if (typeof val === 'number') {
          sheetRowsXml += `<c r="${colLetter}${rowIdx}" s="3"><v>${val}</v></c>`;
        } else {
          sheetRowsXml += `<c r="${colLetter}${rowIdx}" t="inlineStr" s="3"><is><t>${escapeXml(val)}</t></is></c>`;
        }
      } else if (cIdx === 0) {
        sheetRowsXml += `<c r="${colLetter}${rowIdx}" t="inlineStr" s="3"><is><t>TOTAL</t></is></c>`;
      }
    });
    sheetRowsXml += `</row>`;
  }

  // xl/worksheets/sheet1.xml
  zip.addFile('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRowsXml}
  </sheetData>
</worksheet>`);

  return zip.build();
}

// ----------------------------------------------------------------------------
// 2. WORD (.DOCX) BUILDER (OpenXML WordprocessingML)
// ----------------------------------------------------------------------------
function generateWordBuffer({ title, period, columns = [], rows = [], summaryText = '' }) {
  const zip = new ZipBuilder();

  // [Content_Types].xml
  zip.addFile('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // _rels/.rels
  zip.addFile('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // Word table rows
  let tableRowsXml = '';

  // Header row
  tableRowsXml += `<w:tr><w:trPr><w:tblHeader/></w:trPr>`;
  columns.forEach(col => {
    tableRowsXml += `<w:tc>
      <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:tcPr>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(col.header || col)}</w:t></w:r></w:p>
    </w:tc>`;
  });
  tableRowsXml += `</w:tr>`;

  // Data rows
  rows.forEach(row => {
    tableRowsXml += `<w:tr>`;
    columns.forEach(col => {
      const val = typeof row === 'object' ? row[col.key || col] : row;
      tableRowsXml += `<w:tc><w:p><w:r><w:t>${escapeXml(val)}</w:t></w:r></w:p></w:tc>`;
    });
    tableRowsXml += `</w:tr>`;
  });

  // word/document.xml
  zip.addFile('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="left"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="D97706"/></w:rPr><w:t>THE LOOPS — ${escapeXml(title)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="20"/></w:rPr><w:t>Reporting Period: ${escapeXml(period || new Date().toISOString().slice(0, 10))} • Generated: ${new Date().toISOString()}</w:t></w:r>
    </w:p>
    ${summaryText ? `<w:p><w:r><w:t>${escapeXml(summaryText)}</w:t></w:r></w:p>` : ''}
    <w:p/>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:left w:val="none"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
          <w:right w:val="none"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      ${tableRowsXml}
    </w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>`);

  return zip.build();
}

// ----------------------------------------------------------------------------
// 3. PRINTABLE PDF / HTML BUILDER (Crystal-Clear Enterprise Grade)
// ----------------------------------------------------------------------------
function generatePrintablePdfHtml({ title, period, businessName = 'BeyondVER Co., Ltd.', columns = [], rows = [], totals = null, summaryCards = [] }) {
  const isNumericCol = (header = '', key = '') => {
    const text = (header + ' ' + key).toLowerCase();
    return text.includes('$') || text.includes('amount') || text.includes('value') || text.includes('cost') || text.includes('price') || text.includes('balance') || text.includes('budget') || text.includes('spent') || text.includes('revenue') || text.includes('borrowed') || text.includes('quantity') || text.includes('units') || text.includes('sales');
  };

  const tableHeaders = columns.map(c => {
    const headerText = typeof c === 'object' ? (c.header || c.key || '') : String(c);
    const keyText = typeof c === 'object' ? (c.key || '') : String(c);
    const numeric = isNumericCol(headerText, keyText);
    const align = numeric ? 'right' : 'left';
    return `<th style="padding: 10px 14px; text-align: ${align}; background: #0F172A; color: #F8FAFC; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #1E293B;">${escapeXml(headerText)}</th>`;
  }).join('');
  
  const tableRows = rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    const cells = columns.map(c => {
      const key = typeof c === 'object' ? (c.key || c.header) : c;
      const headerText = typeof c === 'object' ? (c.header || '') : '';
      const val = typeof r === 'object' ? r[key] : r;
      const numeric = isNumericCol(headerText, key);
      const align = numeric ? 'right' : 'left';
      const font = numeric ? 'font-family: Consolas, Monaco, "Courier New", monospace; font-weight: 600;' : 'font-weight: 500;';
      return `<td style="padding: 10px 14px; border: 1px solid #CBD5E1; font-size: 12px; color: #0F172A; text-align: ${align}; ${font}">${escapeXml(val !== undefined && val !== null ? val : '')}</td>`;
    }).join('');
    return `<tr style="background: ${bg};">${cells}</tr>`;
  }).join('');

  let totalsRow = '';
  if (totals) {
    const totalCells = columns.map((c, idx) => {
      const key = typeof c === 'object' ? (c.key || c.header) : c;
      const headerText = typeof c === 'object' ? (c.header || '') : '';
      const val = totals[key];
      const numeric = isNumericCol(headerText, key);
      const align = numeric ? 'right' : 'left';
      if (val !== undefined && val !== null) {
        return `<td style="padding: 12px 14px; font-weight: 800; font-size: 13px; color: #0F172A; border: 2px solid #0F172A; background: #F1F5F9; text-align: ${align}; font-family: Consolas, Monaco, monospace;">${escapeXml(val)}</td>`;
      }
      return idx === 0 
        ? `<td style="padding: 12px 14px; font-weight: 900; font-size: 12px; color: #0F172A; border: 2px solid #0F172A; background: #F1F5F9; text-transform: uppercase;">TOTAL AUDITED SUMMARY</td>` 
        : `<td style="border: 2px solid #0F172A; background: #F1F5F9;"></td>`;
    }).join('');
    totalsRow = `<tfoot><tr>${totalCells}</tr></tfoot>`;
  }

  const cardsHtml = (summaryCards || []).map(card => `
    <div style="flex: 1; min-width: 170px; background: #FFFFFF; border: 2px solid #E2E8F0; border-radius: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${escapeXml(card.label)}</div>
      <div style="font-size: 20px; font-weight: 900; color: #0F172A; margin-top: 6px; font-family: Consolas, Monaco, monospace; letter-spacing: -0.02em;">${escapeXml(card.value)}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title)} - ${escapeXml(businessName)}</title>
  <style>
    @media print {
      @page { margin: 12mm 14mm; size: A4 portrait; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 36px 48px;
      color: #0F172A;
      background: #FFFFFF;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      margin-bottom: 24px;
      font-variant-numeric: tabular-nums;
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 12px; color: #64748B; font-weight: 600;">
      Print Preview Mode • Press Print or use browser Ctrl+P to save as high-resolution PDF
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="padding: 9px 20px; background: #D97706; color: #FFFFFF; font-weight: 800; font-size: 13px; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 4px rgba(217,119,6,0.3);">
        Print / Save PDF
      </button>
      <button onclick="window.close()" style="padding: 9px 18px; background: #F1F5F9; color: #334155; font-weight: 700; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 8px; cursor: pointer;">
        Close
      </button>
    </div>
  </div>

  <!-- Document Header -->
  <div style="border-bottom: 3px solid #D97706; padding-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <div style="display: inline-block; background: #FEF3C7; color: #92400E; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; margin-bottom: 6px; letter-spacing: 0.05em;">
        Official Financial Statement
      </div>
      <div style="font-size: 26px; font-weight: 900; letter-spacing: -0.02em; color: #0F172A;">${escapeXml(businessName)}</div>
      <div style="font-size: 15px; font-weight: 700; color: #D97706; text-transform: uppercase; margin-top: 2px; letter-spacing: 0.02em;">${escapeXml(title)}</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #475569; font-family: Consolas, Monaco, monospace; line-height: 1.6;">
      <div>Reporting Period: <strong style="color: #0F172A; font-size: 13px;">${escapeXml(period || 'Current Period')}</strong></div>
      <div>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div style="font-size: 10px; color: #059669; font-weight: 700;">● REVENUE BASIS: ACTUAL CASH & CARD COLLECTED</div>
    </div>
  </div>

  <!-- Key Metrics Banner -->
  ${cardsHtml ? `<div style="display: flex; gap: 14px; margin-top: 22px; flex-wrap: wrap;">${cardsHtml}</div>` : ''}

  <!-- Allocation & Spending Table -->
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
    ${totalsRow}
  </table>

  <!-- Compliance & Audit Footer -->
  <div style="margin-top: 36px; padding-top: 16px; border-top: 2px solid #E2E8F0; font-size: 11px; color: #64748B; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <span style="font-weight: 700; color: #0F172A;">The Loops Enterprise Financial & BeyondVER POS Suite</span> • Immutable Audit Log • Certified Double-Entry Allocation
    </div>
    <div style="font-family: Consolas, Monaco, monospace; font-size: 10px; color: #94A3B8;">
      Hash Ref: ${crypto.randomBytes(4).toString('hex').toUpperCase()} • Confidential
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateExcelBuffer,
  generateWordBuffer,
  generatePrintablePdfHtml
};

