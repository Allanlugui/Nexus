import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { User } from '../types';
import { 
  Users, 
  Mail, 
  MessageCircle, 
  Send, 
  FileText, 
  X, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  Crosshair, 
  RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageIfNeeded } from '../lib/utils';

export function OrgChartView() {
  const { users, currentUser, refreshUsers } = useAuth();
  const activeUsers = users.filter(u => u.status !== 'DISMISSED');
  const { socket } = useSocket();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isMessaging, setIsMessaging] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  const [reportTitle, setReportTitle] = useState('');
  const [reportContent, setReportContent] = useState('');
  
  // Directly edit superior on the spot state
  const [isChangingSuperior, setIsChangingSuperior] = useState(false);
  const [selectedSuperiorId, setSelectedSuperiorId] = useState('');
  const [updatingSuperior, setUpdatingSuperior] = useState(false);

  // Zoom, rotate, pan states for infinite canvas
  const [zoom, setZoom] = useState<number>(0.85);
  const [rotate, setRotate] = useState<number>(0);
  const [panX, setPanX] = useState<number>(100);
  const [panY, setPanY] = useState<number>(80);
  
  // Drag state
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });
  const [hasMovedDuringDrag, setHasMovedDuringDrag] = useState(false);

  // Search/Filter matching users state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Refs for infinite canvas calculations
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedUser) {
      setSelectedSuperiorId(selectedUser.superiorId || '');
    }
  }, [selectedUser]);

  const getSubordinates = (superiorId: string) => {
    if (!superiorId) return [];
    return activeUsers.filter(u => u.superiorId === superiorId);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !socket || !currentUser || !selectedUser) return;
    const payload = {
      senderId: currentUser.id,
      recipientId: selectedUser.id,
      content: messageText
    };
    socket.emit('message:send', payload);
    setMessageText('');
    setIsMessaging(false);
    alert('Mensagem enviada com sucesso!');
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim() || !selectedUser || !currentUser) return;
    
    try {
      const sendData = async (fileData?: string, fileName?: string) => {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            senderId: currentUser.id, 
            recipientId: selectedUser.id, 
            title: reportTitle, 
            content: reportContent,
            fileData,
            fileName 
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        alert('Relatório enviado com sucesso!');
        setIsReporting(false);
        setReportTitle('');
        setReportContent('');
        setReportFile(null);
      };

      if (reportFile) {
        const fileData = await compressImageIfNeeded(reportFile);
        if (fileData.length > 800 * 1024 * 1.33) {
          throw new Error("A imagem ou documento anexo excede o limite do sistema (800KB).");
        }
        await sendData(fileData, reportFile.name);
      } else {
        if (!reportContent.trim()) return alert('Por favor, anexe um documento ou insira um link.');
        await sendData();
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar relatório: ' + (err.message || ''));
    }
  };

  const handleUpdateSuperiorOnSpot = async () => {
    if (!selectedUser) return;
    setUpdatingSuperior(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superiorId: selectedSuperiorId || null })
      });
      if (res.ok) {
        const updatedUser: User = await res.json();
        setSelectedUser(updatedUser);
        refreshUsers();
        setIsChangingSuperior(false);
        alert('Relação hierárquica e subordinação atualizadas com sucesso!');
      } else {
        alert('Erro ao atualizar superior.');
      }
    } catch (err) {
      console.error(err);
      alert('Falha interna ao redefinir hierarquia.');
    } finally {
      setUpdatingSuperior(false);
    }
  };

  // Mathematically focus and center on a particular node using its offset dimensions
  const centerOnUser = (userId: string, targetZoom: number = 1.15) => {
    const container = canvasContainerRef.current;
    const content = canvasContentRef.current;
    const node = document.getElementById(`node-${userId}`);

    if (container && content && node) {
      // Traverse offset parents to find coordinates relative to un-transformed content wrapper
      let cur: HTMLElement | null = node;
      let x = 0;
      let y = 0;
      
      while (cur && cur !== content) {
        x += cur.offsetLeft || 0;
        y += cur.offsetTop || 0;
        cur = cur.offsetParent as HTMLElement | null;
      }

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const nodeWidth = node.offsetWidth || 210;
      const nodeHeight = node.offsetHeight || 120;

      // Coordinate to target (center of the node)
      const targetX = x + nodeWidth / 2;
      const targetY = y + nodeHeight / 2;

      // Focus
      setRotate(0);
      setZoom(targetZoom);
      setPanX(containerWidth / 2 - targetX * targetZoom);
      setPanY(containerHeight / 2 - targetY * targetZoom);
    }
  };

  // Center on currentUser automatically on initial load
  useEffect(() => {
    if (currentUser && activeUsers.length > 0) {
      const timer = setTimeout(() => {
        centerOnUser(currentUser.id, 1.15);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.id, activeUsers.length]);

  // Mouse drag handles
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'SELECT' || 
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('.interactive-modal-action')
    ) {
      return;
    }

    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPan({ x: panX, y: panY });
    setHasMovedDuringDrag(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCanvas) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setHasMovedDuringDrag(true);
    }

    setPanX(initialPan.x + dx);
    setPanY(initialPan.y + dy);
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // Touch drag handles for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'SELECT' || 
      target.tagName === 'TEXTAREA' || 
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('.interactive-modal-action')
    ) {
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDraggingCanvas(true);
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setInitialPan({ x: panX, y: panY });
      setHasMovedDuringDrag(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDraggingCanvas) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.x;
      const dy = touch.clientY - dragStart.y;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setHasMovedDuringDrag(true);
      }

      setPanX(initialPan.x + dx);
      setPanY(initialPan.y + dy);
    }
  };

  // Zoom-to-cursor scaling on wheel scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const scaleFactor = 1.08;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * scaleFactor, 3.0);
    } else {
      newZoom = Math.max(zoom / scaleFactor, 0.2);
    }

    const container = canvasContainerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const cursorX = e.clientX - containerRect.left;
      const cursorY = e.clientY - containerRect.top;

      const zoomRatio = newZoom / zoom;
      setPanX(cursorX - (cursorX - panX) * zoomRatio);
      setPanY(cursorY - (cursorY - panY) * zoomRatio);
    }
    setZoom(newZoom);
  };

  const filteredUsers = searchQuery.trim() === ''
    ? []
    : activeUsers.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  const renderNode = (user: User, level: number = 0, visited: Set<string> = new Set()) => {
    if (visited.has(user.id)) {
      return (
        <div className="bg-red-50 text-red-700 border border-red-200 text-xs px-3 py-2 rounded-lg flex items-center gap-1">
          <AlertCircle size={14} /> Loop de Hierarquia Recorrente ({user.name})
        </div>
      );
    }
    
    // Track visited nodes to avoid stack overflow
    const newVisited = new Set(visited);
    newVisited.add(user.id);

    const subordinates = getSubordinates(user.id);
    
    return (
      <div key={user.id} className="flex flex-col items-center">
        <motion.div 
          id={`node-${user.id}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: Math.min(level * 0.05, 0.4) }}
          onClick={(e) => {
            // Discard clicks if user was actively panning
            if (hasMovedDuringDrag) {
              e.stopPropagation();
              return;
            }
            setSelectedUser(user);
            setIsMessaging(false);
            setIsReporting(false);
            setIsChangingSuperior(false);
            setMessageText('');
            setReportFile(null);
          }}
          className={`relative bg-white border ${
            user.id === currentUser?.id ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-250'
          } rounded-2xl p-4 shadow-sm min-w-[210px] cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all text-center z-10 flex flex-col items-center`}
        >
          {/* Avatar frame */}
          <div className="relative mb-2 shrink-0">
            <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-full border border-gray-150 bg-gray-50 object-cover shadow-sm" />
            {user.id === currentUser?.id && (
              <span className="absolute bottom-0 right-0 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.5 rounded-full uppercase scale-90 border border-white">
                EU
              </span>
            )}
          </div>

          <h4 className="font-bold text-gray-900 text-sm truncate max-w-[190px]">{user.name}</h4>
          <p className="text-xs text-gray-500 font-medium truncate max-w-[190px]">{user.position}</p>
          <div className="mt-2 text-[9px] font-mono tracking-wider font-bold uppercase text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {user.department}
          </div>
        </motion.div>

        {subordinates.length > 0 && (
          <div className="relative flex flex-col items-center mt-6">
            <div className="absolute -top-6 left-1/2 w-px h-6 bg-gray-300 -translate-x-1/2"></div>
            
            {subordinates.length > 1 && (
              <div className="absolute top-0 w-[calc(100%-210px)] h-px bg-gray-300"></div>
            )}
            
            <div className="flex justify-center gap-8 pt-6 relative">
              {subordinates.map((sub) => (
                <div key={sub.id} className="relative">
                  <div className="absolute -top-6 left-1/2 w-px h-6 bg-gray-300 -translate-x-1/2"></div>
                  {renderNode(sub, level + 1, newVisited)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Dynamically find general roots of the company structure
  const getCalculatedRoots = () => {
    const trueRoots = activeUsers.filter(u => {
      if (!u.superiorId || u.superiorId.trim() === '') return true;
      return !activeUsers.some(parent => parent.id === u.superiorId);
    });

    const rendered = new Set<string>();
    const traverse = (userId: string, visited: Set<string> = new Set()) => {
      if (visited.has(userId)) return;
      rendered.add(userId);
      const nextVisited = new Set(visited).add(userId);
      const subs = activeUsers.filter(u => u.superiorId === userId);
      subs.forEach(s => traverse(s.id, nextVisited));
    };

    trueRoots.forEach(r => traverse(r.id));

    // Fallback roots for users stuck in isolated loop components
    const fallbackRoots: User[] = [];
    activeUsers.forEach(u => {
      if (!rendered.has(u.id)) {
        fallbackRoots.push(u);
        traverse(u.id);
      }
    });

    return [...trueRoots, ...fallbackRoots];
  };

  const roots = getCalculatedRoots();

  // Sort roots to make sure CEO appears first, then directors, then others
  const sortedRoots = [...roots].sort((a, b) => {
    if (a.position === 'CEO') return -1;
    if (b.position === 'CEO') return 1;
    if (a.position === 'DIRETOR') return -1;
    if (b.position === 'DIRETOR') return 1;
    return 0;
  });

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2 font-sans">
            Organograma Organizacional
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualização completa da cadeia hierárquica e fluxo corporativo de reporte ({activeUsers.length} colaboradores).
          </p>
        </div>
      </div>

      {/* Dynamic organogram content with interactive infinite zoom/pan canvas */}
      <div 
        ref={canvasContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        className={`flex-1 select-none overflow-hidden bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px] bg-slate-50 border border-gray-200 rounded-3xl min-h-[650px] relative ${
          isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Search Floating Widget */}
        <div className="absolute top-4 right-4 z-20 w-72">
          <div className="relative bg-white/95 backdrop-blur-md rounded-2xl border border-gray-200 shadow-md p-1.5 flex items-center gap-2">
            <Search size={16} className="text-gray-400 ml-2 shrink-0" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full text-xs bg-transparent border-0 ring-0 focus:ring-0 outline-none p-1.5 text-gray-800"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }} 
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 mr-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showSearchResults && filteredUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white/98 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden z-30 divide-y divide-gray-100"
              >
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      centerOnUser(user.id, 1.25);
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-blue-50/55 transition-colors group"
                  >
                    <img src={user.avatarUrl} className="w-8 h-8 rounded-full object-cover border border-gray-100 group-hover:border-blue-200" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate group-hover:text-blue-700">{user.name}</p>
                      <p className="text-[10px] text-gray-450 truncate mt-0.5">{user.position} • <span className="font-mono text-blue-500 font-semibold">{user.department}</span></p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
            
            {showSearchResults && searchQuery.trim() !== '' && filteredUsers.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-gray-200 p-4 rounded-2xl shadow-xl text-center text-xs text-gray-500 z-30"
              >
                Nenhum colaborador encontrado
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating HUD Controller Overlay */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-lg p-1.5 flex items-center gap-1 select-none">
          <button
            onClick={() => setZoom(z => Math.min(z * 1.15, 3.0))}
            title="Aumentar Zoom"
            className="p-2 hover:bg-blue-50 hover:text-blue-600 text-gray-500 rounded-xl transition-colors shrink-0"
          >
            <ZoomIn size={16} />
          </button>
          
          <button
            onClick={() => setZoom(z => Math.max(z / 1.15, 0.2))}
            title="Diminuir Zoom"
            className="p-2 hover:bg-blue-50 hover:text-blue-600 text-gray-500 rounded-xl transition-colors shrink-0"
          >
            <ZoomOut size={16} />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1"></div>

          <button
            onClick={() => setRotate(r => r - 15)}
            title="Rotacionar Anti-horário"
            className="p-2 hover:bg-blue-50 hover:text-blue-600 text-gray-500 rounded-xl transition-colors shrink-0"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => setRotate(r => r + 15)}
            title="Rotacionar Horário"
            className="p-2 hover:bg-blue-50 hover:text-blue-600 text-gray-500 rounded-xl transition-colors shrink-0"
          >
            <RotateCw size={16} />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1"></div>

          {currentUser && (
            <button
              onClick={() => centerOnUser(currentUser.id, 1.2)}
              title="Focar em Mim"
              className="p-2 hover:bg-blue-50 hover:text-blue-600 text-gray-500 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold px-2.5 shrink-0"
            >
              <Crosshair size={15} className="text-blue-600 animate-pulse" />
              <span>Focar em Mim</span>
            </button>
          )}

          <button
            onClick={() => {
              setZoom(0.85);
              setRotate(0);
              const container = canvasContainerRef.current;
              if (container) {
                setPanX(container.clientWidth / 2 - 250);
                setPanY(60);
              } else {
                setPanX(100);
                setPanY(80);
              }
            }}
            title="Redefinir Canvas"
            className="p-2 hover:bg-red-50 hover:text-red-650 text-gray-400 rounded-xl transition-colors shrink-0"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Infinite Panning Content Container */}
        <div 
          ref={canvasContentRef}
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom}) rotate(${rotate}deg)`,
            transformOrigin: '0 0',
            transition: isDraggingCanvas ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="absolute left-0 top-0 pointer-events-auto"
        >
          {activeUsers.length > 0 ? (
            <div className="flex flex-col items-center gap-12 p-32">
              <div className="flex flex-wrap items-start justify-center gap-16">
                {sortedRoots.map(root => (
                  <div key={root.id} className="flex flex-col items-center border border-dashed border-gray-200 p-8 rounded-3xl bg-white/90 backdrop-blur-xs shadow-xs relative">
                    {sortedRoots.length > 1 && (
                      <span className="absolute -top-3 left-6 bg-gray-100 text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded text-gray-500 border border-gray-200">
                        Segmento Auto-independente
                      </span>
                    )}
                    {renderNode(root, 0, new Set())}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-400 m-auto flex flex-col items-center gap-2 p-12">
              <Users size={32} />
              <span className="text-sm">Buscando quadro funcional...</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Panel for personnel details / fast actions */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-8 right-8 bg-white border border-gray-200 p-6 rounded-2xl shadow-xl w-80 z-50 text-left space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img src={selectedUser.avatarUrl} className="w-14 h-14 rounded-full border border-gray-100 object-cover" alt="" />
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">{selectedUser.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedUser.position}</p>
                  <p className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.25 rounded-md inline-block uppercase mt-1">
                    {selectedUser.department}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                <X size={16} />
              </button>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              {/* direct superior section inline */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Cargo de Reporte:</span>
                  <button 
                    onClick={() => {
                      setIsChangingSuperior(!isChangingSuperior);
                      setIsMessaging(false);
                      setIsReporting(false);
                    }}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Alterar
                  </button>
                </div>
                
                {isChangingSuperior ? (
                  <div className="mt-3 space-y-2">
                    <select
                      value={selectedSuperiorId}
                      onChange={e => setSelectedSuperiorId(e.target.value)}
                      className="w-full border border-gray-350 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">Nenhum (Nível de Direção / CEO)</option>
                      {activeUsers
                        .filter(u => u.id !== selectedUser.id) // Exclude self
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.position})</option>
                        ))
                      }
                    </select>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleUpdateSuperiorOnSpot}
                        disabled={updatingSuperior}
                        className="flex-grow bg-blue-600 text-white font-medium py-1 px-2 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50"
                      >
                        {updatingSuperior ? 'Salvando...' : 'Confirmar'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsChangingSuperior(false)}
                        className="flex-grow bg-white border border-gray-250 py-1 px-2 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-900 font-semibold mt-1">
                    {activeUsers.find(u => u.id === selectedUser.superiorId)?.name || 'Sem Superior Cadastrado (Direção Geral)'}
                  </p>
                )}
              </div>

              {/* Direct communication */}
              {isMessaging ? (
                <div className="space-y-2">
                  <textarea 
                    autoFocus
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    className="w-full text-xs border-gray-300 border rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none"
                    rows={3} 
                    placeholder={`Digite sua mensagem para ${selectedUser.name.split(' ')[0]}...`}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSendMessage} className="flex-grow bg-blue-600 text-white rounded-lg py-1.5 text-xs hover:bg-blue-700 flex items-center justify-center gap-1.5 font-medium">
                      <Send size={12} /> Enviar
                    </button>
                    <button onClick={() => setIsMessaging(false)} className="flex-grow bg-gray-100 text-gray-600 rounded-lg py-1.5 text-xs hover:bg-gray-200 font-medium text-center">
                      Recuar
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setIsMessaging(true);
                    setIsReporting(false);
                    setIsChangingSuperior(false);
                  }}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-xs font-semibold flex justify-center items-center gap-2 transition-colors"
                >
                  <MessageCircle size={15} /> Enviar Mensagem Direta
                </button>
              )}

              {/* Fast Reports setup */}
              {isReporting ? (
                <form onSubmit={handleSendReport} className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Título do Relatório</label>
                    <input required value={reportTitle} onChange={e => setReportTitle(e.target.value)} type="text" className="w-full text-xs border border-gray-350 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Conteúdo principal</label>
                    <textarea value={reportContent} onChange={e => setReportContent(e.target.value)} className="w-full text-xs border border-gray-350 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none" rows={2} placeholder="Descreva os fatos ou anexe um arquivo" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Anexo Técnico</label>
                    <input type="file" onChange={e => setReportFile(e.target.files?.[0] || null)} className="w-full text-[11px] text-gray-500 file:mr-3 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-gray-900 text-white rounded-lg py-1.5 text-xs hover:bg-black flex items-center justify-center gap-1 font-semibold">
                      <FileText size={12} /> Entregar
                    </button>
                    <button type="button" onClick={() => setIsReporting(false)} className="flex-1 bg-gray-150 text-gray-600 rounded-lg py-1.5 text-xs hover:bg-gray-200 font-semibold text-center">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button 
                  onClick={() => {
                    setIsReporting(true);
                    setIsMessaging(false);
                    setIsChangingSuperior(false);
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-semibold flex justify-center items-center gap-2 border border-slate-200 transition-colors"
                >
                  <FileText size={15} /> Encaminhar Relatório Rápido
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
