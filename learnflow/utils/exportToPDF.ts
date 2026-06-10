import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface StudentReport {
  id: string;
  name: string;
  averageScore: number;
  studyTimeFormatted: string;
  testsCompleted: number;
  lastLogin: string;
  trend: 'up' | 'down' | 'neutral';
  isAtRisk: boolean;
}

export interface ClassReport {
  className: string;
  date: string;
  stats: {
    averageScore: number;
    studentsCount: number;
    atRiskCount: number;
  };
  students: StudentReport[];
  problematicConcepts: Array<{ name: string; errorRate: number }>;
}

/**
 * Generează și declanșează descărcarea automată a unui raport PDF pentru o clasă.
 * Folosește jsPDF pentru structură și jspdf-autotable pentru tabele.
 * @param classData Datele structurate ale clasei, incluzând elevii și conceptele problematice.
 */
export const exportReportToPDF = (classData: ClassReport) => {
  const doc = new jsPDF();

  // ----- HEADER -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(`Raport Clasa: ${classData.className}`, 14, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100); // Gri pentru meta
  doc.text(`Data generarii: ${classData.date}`, 14, 30);
  
  // Linie separatoare
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 35, 196, 35);

  // ----- STATISTICI AGREGATE -----
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Statistici Agregate', 14, 45);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Numar total elevi: ${classData.stats.studentsCount}`, 14, 55);
  doc.text(`Scor mediu clasa: ${classData.stats.averageScore}%`, 14, 62);
  
  // Dacă sunt elevi la risc, colorăm textul roșu
  if (classData.stats.atRiskCount > 0) {
    doc.setTextColor(220, 53, 69);
  }
  doc.text(`Elevi la risc: ${classData.stats.atRiskCount}`, 14, 69);
  doc.setTextColor(0, 0, 0);

  let currentY = 85;

  // ----- CONCEPTE PROBLEMATICE -----
  if (classData.problematicConcepts && classData.problematicConcepts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Concepte Problematice Frecvente', 14, currentY);
    currentY += 5;
    
    autoTable(doc, {
      startY: currentY,
      head: [['Concept', 'Rata de eroare']],
      body: classData.problematicConcepts.map(c => [c.name, `${c.errorRate}%`]),
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] }, // Roșu/Rose pentru a sublinia problema
      styles: { fontSize: 10 },
      margin: { top: 10 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 20;
  }

  // ----- TABEL ELEVI -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Tabel Elevi', 14, currentY);
  currentY += 5;

  autoTable(doc, {
    startY: currentY,
    head: [['Nume', 'Scor Mediu', 'Timp Studiu', 'Teste', 'Ultimul Login', 'Stare Risc']],
    body: classData.students.map(s => [
      s.name, 
      `${s.averageScore}%`, 
      s.studyTimeFormatted, 
      s.testsCompleted.toString(), 
      s.lastLogin,
      s.isAtRisk ? 'DA (Atentie)' : 'OK'
    ]),
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // Indigo (asemănător cu UI-ul din dashboard)
    styles: { fontSize: 10 },
    didParseCell: function (data) {
      // Colorăm coloana "Stare Risc" (index 5)
      if (data.section === 'body' && data.column.index === 5) {
        if (data.cell.raw === 'DA (Atentie)') {
          data.cell.styles.textColor = [220, 53, 69]; // Roșu
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129]; // Verde
        }
      }
      // Evidențiem rândurile elevilor la risc complet (opțional)
      if (data.section === 'body' && data.row.raw[5] === 'DA (Atentie)') {
         data.cell.styles.fillColor = [255, 241, 242]; // Fundal roșu foarte deschis
      }
    }
  });

  // Footer cu numărul paginii
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Pagina ${i} din ${pageCount} | Generat din platforma LearnFlow`, 14, 285);
  }

  // ----- DOWNLOAD AUTOMAT -----
  // Construim un nume valid de fișier (fără spații sau caractere ciudate)
  const safeClassName = classData.className.replace(/[^a-zA-Z0-9]/g, '_');
  const safeDate = classData.date.replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `Raport_${safeClassName}_${safeDate}.pdf`;
  
  doc.save(filename);
};
