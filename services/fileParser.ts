import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { FileType } from '../types';

// Handle potential ESM interop issues with pdfjs-dist
// In some environments, the module might be on the default export
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize PDF worker safely
if (pdfjs.GlobalWorkerOptions) {
  // Use specific version from unpkg to avoid URL encoding issues with semantic versioning characters (^)
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
} else {
  console.warn("PDF.js GlobalWorkerOptions not accessible. PDF parsing may not work.");
}

export const detectFileType = (fileName: string): FileType => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'csv': return FileType.CSV;
    case 'xlsx':
    case 'xls': return FileType.XLSX;
    case 'docx': return FileType.DOCX;
    case 'pdf': return FileType.PDF;
    case 'txt': return FileType.TXT;
    case 'json': return FileType.JSON;
    default: return FileType.UNKNOWN;
  }
};

export const readFileContent = async (file: File): Promise<string> => {
  const type = detectFileType(file.name);

  switch (type) {
    case FileType.TXT:
    case FileType.CSV:
    case FileType.JSON:
      return await readTextFile(file);
    case FileType.XLSX:
      return await readExcelFile(file);
    case FileType.DOCX:
      return await readDocxFile(file);
    case FileType.PDF:
      return await readPdfFile(file);
    default:
      throw new Error(`Tipo de arquivo não suportado: ${file.name}`);
  }
};

const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const readExcelFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let fullText = `Conteúdo do arquivo Excel: ${file.name}\n`;
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          // Convert sheet to CSV format for better LLM token efficiency compared to JSON
          const csv = XLSX.utils.sheet_to_csv(sheet);
          fullText += `\n--- Planilha: ${sheetName} ---\n${csv}`;
        });
        
        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

const readDocxFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(`Conteúdo do arquivo DOCX: ${file.name}\n\n${result.value}`);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
};

const readPdfFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Use the resolved pdfjs object (handling default export if necessary)
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = `Conteúdo do arquivo PDF: ${file.name}\n\n`;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Página ${i} ---\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (err) {
    console.error("Error reading PDF", err);
    throw new Error("Falha ao ler o arquivo PDF. Verifique se não está corrompido ou protegido por senha.");
  }
};