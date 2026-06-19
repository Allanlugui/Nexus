import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfSection {
  title: string;
  type?: 'text' | 'table';
  content?: string[];
  tableHead?: string[];
  tableBody?: (string | number)[][];
}

export interface PdfOptions {
  title: string;
  generatedBy: string;
  position?: string;
  sections: PdfSection[];
  fileName?: string;
}

export function generateStandardPdf(options: PdfOptions) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = 15;

  const primaryColor: [number, number, number] = [30, 58, 138];
  const secondaryColor: [number, number, number] = [71, 85, 105];
  const lightGray: [number, number, number] = [241, 245, 249];

  // Block Header Setup
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, 0, pageWidth, 35, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(options.title.toUpperCase(), 15, 20);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const byText = `Gerado por: ${options.generatedBy} ${options.position ? `(${options.position})` : ''}`;
  pdf.text(byText, pageWidth - 15, 18, { align: 'right' });
  pdf.text(`Data: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 15, 26, { align: 'right' });

  y = 45;

  options.sections.forEach((section) => {
    if (y > 230) {
      pdf.addPage();
      y = 20;
    }

    if (section.type === 'table' && section.tableHead && section.tableBody) {
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.text(section.title, 15, y);
      y += 8;

      autoTable(pdf, {
        startY: y,
        head: [section.tableHead],
        body: section.tableBody,
        headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9, textColor: 50 },
        alternateRowStyles: { fillColor: lightGray },
        margin: { left: 15, right: 15 }
      });
    } else {
      autoTable(pdf, {
        startY: y,
        head: [[section.title]],
        body: section.content ? section.content.map(text => [text]) : [],
        headStyles: { fillColor: secondaryColor, textColor: 255, fontSize: 11, fontStyle: 'bold', halign: 'left' },
        bodyStyles: { fontSize: 10, textColor: 40, cellPadding: 5 },
        alternateRowStyles: { fillColor: lightGray },
        margin: { left: 15, right: 15 }
      });
    }

    y = (pdf as any).lastAutoTable.finalY + 10;
  });

  const pageCount = (pdf.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Nexus ERP - Relatório Gerencial Confidencial - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  const defaultFileName = `NexusERP_Relatorio_${new Date().getTime()}.pdf`;
  pdf.save(options.fileName || defaultFileName);
}
