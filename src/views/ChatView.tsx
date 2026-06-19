import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Message } from '../types';
import { Send, Hash, Users, Network, Search, MessageCircle, Paperclip, FileText, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ChatView({ initialActiveUserId }: { initialActiveUserId?: string }) {
  const { currentUser, users } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [activeChannel, setActiveChannel] = useState<'general' | string>(initialActiveUserId || 'general');
  const [attachment, setAttachment] = useState<{ name: string; data: string; type: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/messages')
      .then(res => res.json())
      .then(data => setMessages(data));

    if (socket) {
      socket.on('message:created', (msg: Message) => {
        setMessages(prev => [...prev, msg]);
      });
    }

    return () => {
      if (socket) socket.off('message:created');
    }
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || !socket || !currentUser) return;
    
    const payload: any = { senderId: currentUser.id, content: input };
    if (activeChannel !== 'general') {
      payload.recipientId = activeChannel;
    }

    if (attachment) {
      payload.fileData = attachment.data;
      payload.fileName = attachment.name;
      payload.fileType = attachment.type;
    }
    
    socket.emit('message:send', payload);
    setInput('');
    setAttachment(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        alert("O tamanho do arquivo excede o limite máximo permitido no chat (800KB).");
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachment({
          name: file.name,
          data: ev.target?.result as string,
          type: file.type
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (activeChannel === 'general') {
      return !msg.recipientId;
    } else {
      return (msg.senderId === currentUser?.id && msg.recipientId === activeChannel) ||
             (msg.senderId === activeChannel && msg.recipientId === currentUser?.id);
    }
  });

  const activeUser = activeChannel !== 'general' ? users.find(u => u.id === activeChannel) : null;

  return (
    <div className="flex h-full bg-white">
      {/* Channels Sidebar */}
      <div className="w-72 border-r border-gray-200 bg-gray-50/50 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Network size={18} className="text-blue-600" />
            Comunicação Interna
          </h2>
        </div>
        <div className="p-3 flex-1 overflow-y-auto space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pl-2">Canais</div>
          <button 
            onClick={() => setActiveChannel('general')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeChannel === 'general' ? "bg-blue-100/50 text-blue-700" : "hover:bg-gray-100 text-gray-700"
            )}
          >
            <Hash size={16} /> # Comunicados Gerais
          </button>
          
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-2 pl-2">Mensagens Diretas</div>
          {users.filter(u => u.id !== currentUser?.id && u.status !== 'DISMISSED').map(u => (
            <button 
              key={u.id}
              onClick={() => setActiveChannel(u.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                activeChannel === u.id ? "bg-blue-100/50 text-blue-700" : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <div className="relative shrink-0">
                  <img src={u.avatarUrl} className="w-6 h-6 rounded-full bg-white" alt="" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border border-white rounded-full"></span>
                </div>
                <span className="truncate max-w-[150px] text-left font-medium">{u.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
             {activeChannel === 'general' ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                    <Hash size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Comunicados Gerais</h3>
                    <p className="text-xs text-gray-500">Para toda a empresa</p>
                  </div>
                </>
             ) : (
                <>
                  <img src={activeUser?.avatarUrl} className="w-8 h-8 rounded-full border border-gray-200" alt="" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{activeUser?.name}</h3>
                    <p className="text-xs text-gray-500">{activeUser?.position} • {activeUser?.department}</p>
                  </div>
                </>
             )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filteredMessages.map(msg => {
            const author = users.find(u => u.id === msg.senderId);
            const isMe = msg.senderId === currentUser?.id;

            return (
              <div key={msg.id} className={cn("flex gap-4 max-w-2xl", isMe ? "ml-auto flex-row-reverse" : "")}>
                <img src={author?.avatarUrl} className="w-8 h-8 rounded-full shadow-sm bg-white" alt="" />
                <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">{author?.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{format(msg.timestamp, "HH:mm")}</span>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-2xl text-sm shadow-sm flex flex-col",
                    isMe ? "bg-blue-600 text-white rounded-tr-sm items-end" : "bg-gray-100 text-gray-800 rounded-tl-sm items-start"
                  )}>
                    {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                    
                    {msg.fileData && (
                      <div className="mt-2">
                        {msg.fileType?.startsWith('image/') ? (
                          <img 
                            src={msg.fileData} 
                            alt={msg.fileName} 
                            referrerPolicy="no-referrer"
                            className="max-w-xs max-h-60 rounded-lg border border-black/10 shadow-inner object-cover" 
                          />
                        ) : msg.fileType?.startsWith('audio/') ? (
                          <audio controls src={msg.fileData} className="max-w-xs h-9 mt-1 focus:outline-none" />
                        ) : (
                          <a 
                            href={msg.fileData} 
                            download={msg.fileName} 
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors",
                              isMe 
                                ? "bg-blue-700 hover:bg-blue-800 text-white border-blue-800" 
                                : "bg-white hover:bg-gray-50 text-gray-800 border-gray-200 animate-fade-in"
                            )}
                          >
                            <FileText size={16} className={isMe ? "text-blue-200 font-bold" : "text-gray-500"} />
                            <span className="truncate max-w-[170px]">{msg.fileName || 'Anexo'}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredMessages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-gray-400">
               <MessageCircle size={48} className="mb-4 opacity-50" />
               <p>Nenhuma mensagem por aqui ainda.</p>
               <p className="text-sm mt-1">Diga olá!</p>
             </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          {attachment && (
            <div className="mb-3 mx-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-xs text-gray-600 animate-slide-up">
              <div className="flex items-center gap-2 truncate">
                <Paperclip size={14} className="text-gray-500 shrink-0" />
                <span className="truncate font-medium">{attachment.name}</span>
                <span className="text-[10px] text-gray-400">({(attachment.data.length / 1.33 / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={send} className="flex gap-2 items-center">
            <label className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full cursor-pointer transition-colors flex items-center justify-center shrink-0">
              <Paperclip size={18} />
              <input type="file" onChange={handleFileChange} className="hidden" />
            </label>
            
            <div className="flex-1 relative flex items-center">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={activeChannel === 'general' ? "Mensagem no #Geral..." : `Mensagem para ${activeUser?.name.split(' ')[0]}...`}
                className="w-full bg-gray-50 border border-gray-300 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <button 
                type="submit" 
                disabled={!input.trim() && !attachment}
                className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
