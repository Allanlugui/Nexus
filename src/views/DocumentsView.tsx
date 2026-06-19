import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { VfsFolder, VfsFile, User } from '../types';
import { FileCode, FileImage, FileText, File as FileIcon, UploadCloud, Search, Download, Folder, Plus, ChevronRight, Eye, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { compressImageIfNeeded } from '../lib/utils';

export function DocumentsView() {
  const { currentUser } = useAuth();
  const [folders, setFolders] = useState<VfsFolder[]>([]);
  const [files, setFiles] = useState<VfsFile[]>([]);
  
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVFS = async () => {
    try {
      const [fRes, filesRes] = await Promise.all([
        fetch('/api/vfs/folders'),
        fetch('/api/vfs/files')
      ]);
      setFolders(await fRes.json());
      setFiles(await filesRes.json());
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadVFS();
  }, []);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await fetch('/api/vfs/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: currentFolderId,
          name: newFolderName.trim(),
          ownerId: currentUser?.id
        })
      });
      setNewFolderName('');
      setIsCreatingFolder(false);
      loadVFS();
    } catch(err) {
      console.error(err);
      alert('Erro ao criar pasta');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const base64Data = await compressImageIfNeeded(file);
      if (base64Data.length > 800 * 1024 * 1.33) {
        alert("O tamanho do arquivo excede o limite do sistema (800KB). Por favor otimize o arquivo e tente novamente.");
        setIsUploading(false);
        return;
      }

      await fetch('/api/vfs/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: currentFolderId,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          uploaderId: currentUser?.id,
          base64Data
        })
      });
      loadVFS();
      setIsUploading(false);
    } catch(err: any) {
      console.error(err);
      alert('Erro ao fazer upload: ' + (err.message || ''));
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if(!confirm("Tem certeza que deseja excluir este arquivo?")) return;
    try {
      await fetch(`/api/vfs/files/${id}`, { method: 'DELETE' });
      loadVFS();
    } catch(err) {
      alert("Erro ao excluir arquivo");
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <img src="https://img.icons8.com/color/48/pdf.png" className="w-8 h-8" alt="PDF" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('sheet')) return <img src="https://img.icons8.com/color/48/ms-excel.png" className="w-8 h-8" alt="Excel" />;
    if (mimeType.includes('document') || mimeType.includes('word')) return <img src="https://img.icons8.com/color/48/ms-word.png" className="w-8 h-8" alt="Word" />;
    if (mimeType.includes('image')) return <FileImage className="text-blue-500 w-8 h-8" />;
    return <FileIcon size={32} className="text-gray-400" />;
  };

  const handlePreview = (file: VfsFile) => {
    if (!file.base64Data) return alert('O arquivo não possui dados de visualização.');
    const newWindow = window.open();
    if (newWindow) {
      if (file.type.includes('pdf') || file.type.includes('image')) {
        newWindow.document.write(`<iframe src="${file.base64Data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      } else {
         // Para word/excel não renderizaveis no iframe base64 facilmente, mostrar botao centralizado baixar
         newWindow.document.write(`
           <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
             <h2 style="color:#333;">Pré-visualização Indisponível</h2>
             <p style="color:#666;">Este tipo de formato não pode ser visualizado diretamente no navegador.</p>
             <a href="${file.base64Data}" download="${file.name}" style="padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:5px; margin-top:20px;">Baixar Arquivo Seguramente</a>
           </div>
         `);
      }
    }
  };

  // Navegação de Pão Caseiro (Breadcrumbs)
  const getBreadcrumbs = () => {
    const path = [];
    let currentId = currentFolderId;
    while (currentId !== 'root') {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId || 'root';
      } else {
        break;
      }
    }
    return [ { id: 'root', name: 'Início' }, ...path ];
  };

  const currentFolderFiles = files.filter(f => f.folderId === currentFolderId && f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentSubfolders = folders.filter(f => f.parentId === currentFolderId && f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Cofre de Documentos e Relatórios</h1>
          <p className="text-sm text-gray-500 mt-1">Armazenamento organizado com VFS NexusCloud.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
             onClick={() => setIsCreatingFolder(!isCreatingFolder)}
             className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
             <Folder size={16} /> Nova Pasta
          </button>
          <label className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            <UploadCloud size={16} /> {isUploading ? 'Enviando...' : 'Carregar Arquivo'}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} ref={fileInputRef} />
          </label>
        </div>
      </div>

      {isCreatingFolder && (
         <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex items-center gap-4">
           <Folder className="text-blue-500" size={24} />
           <form onSubmit={handleCreateFolder} className="flex-1 flex gap-2">
             <input required autoFocus value={newFolderName} onChange={e=>setNewFolderName(e.target.value)} type="text" placeholder="Nome da nova pasta..." className="flex-1 border-gray-300 rounded-lg p-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none" />
             <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Criar</button>
             <button type="button" onClick={() => setIsCreatingFolder(false)} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
           </form>
         </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4 flex-wrap">
           <div className="flex items-center gap-2 text-sm font-medium text-gray-600 overflow-x-auto whitespace-nowrap">
             {getBreadcrumbs().map((b, idx, arr) => (
                <React.Fragment key={b.id}>
                  <button 
                     onClick={() => setCurrentFolderId(b.id)} 
                     className={`hover:text-blue-600 transition-colors ${idx === arr.length -1 ? 'text-gray-900 pointer-events-none' : ''}`}
                  >
                     {b.name}
                  </button>
                  {idx < arr.length - 1 && <ChevronRight size={14} className="text-gray-400" />}
                </React.Fragment>
             ))}
           </div>

          <div className="relative flex-1 max-w-sm ml-auto">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               type="text" 
               placeholder="Buscar pastas e arquivos..." 
               className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
             />
          </div>
        </div>

        <div className="divide-y divide-gray-100 min-h-[400px]">
          {currentSubfolders.map(folder => (
              <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="shrink-0 flex items-center justify-center w-12 h-12">
                   <img src="https://img.icons8.com/color/48/folder-invoices--v1.png" className="w-10 h-10" alt="Pasta" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{folder.name}</h4>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{format(new Date(folder.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
          ))}

          {currentFolderFiles.map(file => (
              <div key={file.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors group">
                <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{file.name}</h4>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    {file.size && <span>{(file.size / 1024).toFixed(1)} KB • </span>}
                    <span>{format(new Date(file.uploadDate), "dd 'de' MMM, yyyy HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => handlePreview(file)}
                     className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                   >
                     <Eye size={16} /> Abrir/Visualizar
                   </button>
                   {file.base64Data && (
                     <a 
                       href={file.base64Data} download={file.name}
                       className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                     >
                       <Download size={16} />
                     </a>
                   )}
                   <button onClick={() => handleDeleteFile(file.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                   </button>
                </div>
              </div>
          ))}
          
          {currentSubfolders.length === 0 && currentFolderFiles.length === 0 && (
             <div className="text-center py-20">
               <img src="https://img.icons8.com/color/96/opened-folder.png" className="mx-auto opacity-50 mb-4" alt="Empty" />
               <p className="text-gray-500 text-sm">Esta pasta está vazia.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
