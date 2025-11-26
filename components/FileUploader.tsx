import React, { useRef, useState } from 'react';
import { Upload, FileText, X, FileSpreadsheet, FileCode, Loader2 } from 'lucide-react';
import { FileType, UploadedFile } from '../types';
import { readFileContent, detectFileType } from '../services/fileParser';

interface FileUploaderProps {
  onFilesAdded: (files: UploadedFile[]) => void;
  isProcessing: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesAdded, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const processedFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoadingFile(file.name);
      
      try {
        const content = await readFileContent(file);
        processedFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: detectFileType(file.name),
          content: content,
          timestamp: Date.now(),
          category: 'Geral' // Default category added to satisfy type requirement
        });
      } catch (error) {
        console.error(`Error reading ${file.name}`, error);
        alert(`Erro ao ler o arquivo ${file.name}. Verifique se o formato é suportado.`);
      }
    }

    setLoadingFile(null);
    onFilesAdded(processedFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".csv,.xlsx,.xls,.docx,.txt,.json,.pdf"
        onChange={handleChange}
      />
      
      <div
        className={`relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out cursor-pointer group
          ${dragActive 
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' 
            : 'border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/50'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={triggerSelect}
      >
        {loadingFile ? (
          <div className="flex flex-col items-center animate-pulse">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-300">Lendo {loadingFile}...</p>
          </div>
        ) : (
          <>
            <div className="p-4 bg-slate-800 rounded-full mb-4 group-hover:scale-110 transition-transform duration-200">
              <Upload className={`w-8 h-8 text-slate-400 group-hover:text-emerald-400 transition-colors`} />
            </div>
            <p className="mb-2 text-sm text-slate-300 font-medium text-center">
              <span className="font-bold text-emerald-400">Clique para selecionar</span> ou arraste
            </p>
            <p className="text-xs text-slate-500 text-center max-w-[200px]">
              Suporta CSV, XLSX, PDF, DOCX e TXT
            </p>
          </>
        )}
      </div>
    </div>
  );
};