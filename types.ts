export enum FileType {
  CSV = 'csv',
  XLSX = 'xlsx',
  DOCX = 'docx',
  PDF = 'pdf',
  TXT = 'txt',
  JSON = 'json',
  UNKNOWN = 'unknown'
}

export type FileCategory = 
  | 'Finanças'
  | 'Educação'
  | 'Desenvolvimento Social'
  | 'Infraestrutura'
  | 'Planejamento'
  | 'Esporte cultura e lazer'
  | 'Saúde'
  | 'Gabinete'
  | 'Geral';

export interface UploadedFile {
  id: string;
  name: string;
  type: FileType;
  content: string; // The extracted text content
  timestamp: number;
  // Metadata added for the "Gonçalinho" context
  description?: string;
  source?: string;
  period?: string;
  caseName?: string;
  category: FileCategory;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: any[];
  // Adjusted to support the "Gonçalinho" schema which uses "label" and "value" by default
  dataKeys?: string[]; 
  xAxisKey?: string; 
  description?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isLoading?: boolean;
  chartData?: ChartData; 
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentTask?: string;
}