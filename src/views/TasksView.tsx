import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Task, User } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  Users, 
  User as UserIcon, 
  Camera, 
  CheckCircle, 
  Activity, 
  Calendar, 
  ListTodo, 
  UploadCloud, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Check, 
  X,
  FileCheck,
  Eye,
  ListPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageIfNeeded } from '../lib/utils';

export function TasksView() {
  const { currentUser, users } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'my-tasks' | 'team-tasks' | 'delegated-tasks'>('my-tasks');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState(new Date(Date.now() + 864 * 100).toISOString().substring(0, 10));
  const [newTaskAssignee, setNewTaskAssignee] = useState(currentUser?.id || '');
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');

  // Upload photo preview state for active tasks
  const [uploadingForTaskId, setUploadingForTaskId] = useState<string | null>(null);

  // Load Tasks live
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tasks'), (snap) => {
      const taskList: Task[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
      setTasks(taskList);
    }, (error) => {
      console.error("Error reading tasks live from Firestore:", error);
    });
    return () => unsub();
  }, []);

  // Filter subordinates and check if user has subordinates
  const activeUsers = users.filter(u => u.status !== 'DISMISSED');
  const subordinates = activeUsers.filter(u => u.superiorId === currentUser?.id);
  const hasSubordinates = subordinates.length > 0;

  // Handler to add a checklist item to the draft form
  const handleAddNewChecklistItem = () => {
    if (!newChecklistItemText.trim()) return;
    setDraftChecklist([...draftChecklist, newChecklistItemText.trim()]);
    setNewChecklistItemText('');
  };

  const handleRemoveDraftChecklistItem = (index: number) => {
    setDraftChecklist(draftChecklist.filter((_, i) => i !== index));
  };

  // Submit new task
  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !currentUser) return;

    // Strict rule validation: can only assign to self or subordinates
    const isAssigningToSelf = newTaskAssignee === currentUser.id;
    const isAssigningToSubordinate = subordinates.some(sub => sub.id === newTaskAssignee);
    
    if (!isAssigningToSelf && !isAssigningToSubordinate) {
      alert("Operação proibida: Você só pode delegar tarefas para si mesmo ou para seus subordinados diretos.");
      return;
    }

    try {
      const assigneeObj = activeUsers.find(u => u.id === newTaskAssignee);
      const payload = {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        assigneeId: newTaskAssignee,
        dueDate: new Date(newTaskDueDate).getTime(),
        delegatorId: currentUser.id,
        status: 'TODO',
        department: assigneeObj?.department || currentUser.department,
        checklist: draftChecklist.map((text, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          text,
          done: false
        }))
      };

      await addDoc(collection(db, 'tasks'), payload);
      alert('Tarefa criada com sucesso!');
      
      // Cleanup
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDueDate(new Date(Date.now() + 864 * 100).toISOString().substring(0, 10));
      setNewTaskAssignee(currentUser.id);
      setDraftChecklist([]);
      setIsCreatingTask(false);
    } catch (err) {
      console.error("Error creating task:", err);
      alert("Ocorreu um erro ao delegar a tarefa.");
    }
  };

  // Toggle singular checklist item status directly in DB
  const handleToggleChecklistItem = async (task: Task, itemId: string) => {
    if (!task.checklist) return;
    
    const updatedChecklist = task.checklist.map(item => {
      if (item.id === itemId) {
        return { ...item, done: !item.done };
      }
      return item;
    });

    try {
      const docRef = doc(db, 'tasks', task.id);
      await updateDoc(docRef, { checklist: updatedChecklist });
    } catch (err) {
      console.error("Error updating task checklist:", err);
    }
  };

  // Upload photo confirmation of completion
  const handleTaskPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, task: Task) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Data = await compressImageIfNeeded(file);
      const docRef = doc(db, 'tasks', task.id);
      await updateDoc(docRef, { 
        completionPhoto: base64Data,
        status: task.status === 'TODO' || task.status === 'IN_PROGRESS' ? 'REVIEW' : task.status 
      });
      setUploadingForTaskId(null);
      alert("Foto de comprovação anexada com sucesso à tarefa!");
    } catch (error: any) {
      console.error(error);
      alert("Erro ao carregar imagem: " + (error.message || ''));
    }
  };

  // Update overall task status
  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      const docRef = doc(db, 'tasks', taskId);
      await updateDoc(docRef, { status });
    } catch (err) {
      console.error("Error update task status:", err);
    }
  };

  // Delete task (delegators or admins only)
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Excluir de forma permanente esta tarefa?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Tasks for the respective active tab
  const getFilteredTasks = () => {
    if (!currentUser) return [];

    switch (activeTab) {
      case 'my-tasks':
        // Individual tasks assigned to me
        return tasks.filter(t => t.assigneeId === currentUser.id);
      
      case 'team-tasks':
        // Tasks assigned to anyone in my department (excluding me) for team transparency
        return tasks.filter(t => t.department === currentUser.department && t.assigneeId !== currentUser.id);
      
      case 'delegated-tasks':
        // Tasks delegated by me to other subordinates
        return tasks.filter(t => t.delegatorId === currentUser.id && t.assigneeId !== currentUser.id);
      
      default:
        return [];
    }
  };

  const activeFilteredTasks = getFilteredTasks();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ListTodo className="text-blue-600" /> Painel de Tarefas & Delegação
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Planeje, delegue e resolva atividades corporativas em formato checklist com comprovantes fotográficos.
          </p>
        </div>
        <button 
          onClick={() => {
            setDraftChecklist([]);
            setNewTaskTitle('');
            setNewTaskDesc('');
            setNewTaskAssignee(currentUser?.id || '');
            setIsCreatingTask(true);
          }}
          className="cursor-pointer bg-gray-950 text-white hover:bg-gray-800 hover:text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-xs"
        >
          <Plus size={16} /> Nova Tarefa
        </button>
      </div>

      {/* Main KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
          <p className="text-xs text-gray-400 uppercase font-black tracking-wider">Suas Tarefas Ativas</p>
          <h2 className="text-3xl font-black text-gray-950 mt-1">
            {tasks.filter(t => t.assigneeId === currentUser?.id && t.status !== 'DONE').length}
          </h2>
          <span className="text-[10px] text-gray-500">Pessoais ainda não finalizadas</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
          <p className="text-xs text-gray-400 uppercase font-black tracking-wider">Aguardando Revisão</p>
          <h2 className="text-3xl font-black text-amber-600 mt-1">
            {tasks.filter(t => t.delegatorId === currentUser?.id && t.status === 'REVIEW').length}
          </h2>
          <span className="text-[10px] text-gray-500">Subordinados aguardando aprovação</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
          <p className="text-xs text-gray-400 uppercase font-black tracking-wider">Sua Equipe</p>
          <h2 className="text-3xl font-black text-blue-605 mt-1">
            {activeUsers.filter(u => u.department === currentUser?.department).length} Colaboradores
          </h2>
          <span className="text-[10px] text-gray-500">No departamento de {currentUser?.department}</span>
        </div>
        <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-xs">
          <p className="text-xs text-gray-400 uppercase font-black tracking-wider">Taxa de Conclusão Global</p>
          {(() => {
            const relevant = tasks.filter(t => t.department === currentUser?.department || t.assigneeId === currentUser?.id);
            const done = relevant.filter(t => t.status === 'DONE').length;
            const percentage = relevant.length > 0 ? (done / relevant.length) * 100 : 0;
            return (
              <>
                <h2 className="text-3xl font-black text-emerald-600 mt-1">{percentage.toFixed(0)}%</h2>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200 pb-2">
        <button 
          onClick={() => setActiveTab('my-tasks')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'my-tasks' 
              ? 'bg-gray-900 text-white shadow-xs' 
              : 'bg-slate-150/70 text-gray-600 hover:bg-slate-200/80 hover:text-gray-900'
          }`}
        >
          Minhas Tarefas ({tasks.filter(t => t.assigneeId === currentUser?.id).length})
        </button>
        <button 
          onClick={() => setActiveTab('team-tasks')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'team-tasks' 
              ? 'bg-gray-900 text-white shadow-xs' 
              : 'bg-slate-150/70 text-gray-600 hover:bg-slate-200/80 hover:text-gray-900'
          }`}
        >
          Histórico da Equipe ({tasks.filter(t => t.department === currentUser?.department && t.assigneeId !== currentUser?.id).length})
        </button>
        {hasSubordinates && (
          <button 
            onClick={() => setActiveTab('delegated-tasks')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'delegated-tasks' 
                ? 'bg-gray-900 text-white shadow-xs' 
                : 'bg-slate-150/70 text-gray-600 hover:bg-slate-200/80 hover:text-gray-900'
            }`}
          >
            Tarefas que Deleguei ({tasks.filter(t => t.delegatorId === currentUser?.id && t.assigneeId !== currentUser?.id).length})
          </button>
        )}
      </div>

      {/* Task Creation Modal */}
      <AnimatePresence>
        {isCreatingTask && (
          <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 overflow-y-auto max-h-[90vh] text-left"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-150">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ListPlus className="text-blue-600" /> Cadastrar & Delegar Atividade
                </h3>
                <button onClick={() => setIsCreatingTask(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateTaskSubmit} className="space-y-5 mt-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Título da Tarefa</label>
                  <input required placeholder="Ex: Conferir inventário do depósito posterior" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Orientações / Descrição</label>
                  <textarea placeholder="Insira intruções claras, links ou metas para a conclusão desta atividade" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-700" rows={3} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Data Limite de Entrega</label>
                    <input type="date" required value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full border-gray-300 border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white font-semibold text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Responsável / Execução</label>
                    <select 
                      value={newTaskAssignee}
                      onChange={e => setNewTaskAssignee(e.target.value)}
                      className="w-full border-gray-300 border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white font-semibold text-gray-800"
                    >
                      <option value={currentUser?.id}>Para mim mesmo (Pessoal)</option>
                      {subordinates.map(sub => (
                        <option key={sub.id} value={sub.id}>Delegar para: {sub.name} ({sub.position})</option>
                      ))}
                    </select>
                    {!hasSubordinates && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> Você não possui subordinados para delegação externa.
                      </p>
                    )}
                  </div>
                </div>

                {/* Subchecklist Draft Constructor */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    <CheckSquare size={13} className="text-slate-600" /> Checklist de Atividades Requeridas
                  </label>
                  <p className="text-[10px] text-slate-500 leading-tight">O responsável precisará marcar cada sub-atividade como concluída antes do fechamento desta tarefa.</p>

                  <div className="flex gap-2">
                    <input 
                      placeholder="Ex: Tirar foto do painel de controle ou conferir fiação..."
                      value={newChecklistItemText} 
                      onChange={e => setNewChecklistItemText(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewChecklistItem(); } }}
                      className="flex-1 border-gray-300 border rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 bg-white" 
                    />
                    <button 
                      type="button" 
                      onClick={handleAddNewChecklistItem}
                      className="bg-slate-350 p-2 px-3 hover:bg-slate-400 font-bold border border-slate-300 rounded-lg text-xs"
                    >
                      Incluir
                    </button>
                  </div>

                  {draftChecklist.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pt-2">
                      {draftChecklist.map((item, index) => (
                        <div key={index} className="flex justify-between items-center bg-white border border-slate-150 p-2 rounded-lg text-xs font-medium text-slate-700">
                          <span className="truncate">{item}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveDraftChecklistItem(index)}
                            className="text-red-500 hover:text-red-700 font-bold px-1.5"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-150">
                  <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors">
                    Confirmar e Publicar Atividade
                  </button>
                  <button type="button" onClick={() => setIsCreatingTask(false)} className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-200">
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Tasks List layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active filtered lists Column (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between text-base">
            <span>Listagem de Atividades</span>
            <span className="text-xs bg-gray-100 text-gray-600 p-1 px-2.5 rounded-full font-semibold">
              {activeFilteredTasks.length} tarefas encontradas
            </span>
          </h3>

          <div className="space-y-4">
            {activeFilteredTasks.map((task) => {
              const assigneeObj = activeUsers.find(u => u.id === task.assigneeId);
              const delegatorObj = activeUsers.find(u => u.id === task.delegatorId);
              
              // Count checklist completion progress range
              const checklistTotal = task.checklist?.length || 0;
              const checklistChecked = task.checklist?.filter(item => item.done).length || 0;
              const checklistPercent = checklistTotal > 0 ? (checklistChecked / checklistTotal) * 100 : 0;

              return (
                <div key={task.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all text-left space-y-4 relative">
                  
                  {/* Task Header info row */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-950 text-base">{task.title}</h4>
                        <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md ${
                          task.status === 'DONE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          task.status === 'REVIEW' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-amber-50 text-amber-700 border border-amber-250'
                        }`}>
                          {task.status === 'DONE' ? 'Concluída' : 
                           task.status === 'REVIEW' ? 'Em Revisão' : 
                           task.status === 'IN_PROGRESS' ? 'Em Progresso' : 'A Fazer'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={13} /> Limite: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                        <span>•</span>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-750">
                          <img src={assigneeObj?.avatarUrl} className="w-4 h-4 rounded-full object-cover border border-slate-200" alt="" />
                          Responsável: {assigneeObj?.name || 'Desconhecido'}
                        </div>
                        {delegatorObj && delegatorObj.id !== task.assigneeId && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] text-gray-400">Delegado por: <strong>{delegatorObj.name.split(' ')[0]}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Exclude task action button for delegators / admins */}
                    {(currentUser?.isSystemAdmin || task.delegatorId === currentUser?.id) && (
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-650 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Deletar tarefa"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Task Description */}
                  {task.description && (
                    <p className="text-xs text-gray-650 bg-slate-55/65 p-3 rounded-lg leading-relaxed">{task.description}</p>
                  )}

                  {/* Interactive Checklist list */}
                  {checklistTotal > 0 && (
                    <div className="space-y-2 border-t border-dashed border-gray-100 pt-4">
                      <div className="flex justify-between items-center text-xs pb-1">
                        <span className="font-bold text-slate-750 flex items-center gap-1.5"><CheckSquare size={13} className="text-slate-505" /> Checklist de Atividades ({checklistChecked}/{checklistTotal})</span>
                        <span className="font-mono text-[10px] font-black text-slate-500">{checklistPercent.toFixed(0)}% finalizado</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 ml-0.5 mb-2.5">
                        <div className="bg-blue-600 h-1 rounded-full transition-all" style={{ width: `${checklistPercent}%` }}></div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1.5">
                        {task.checklist && task.checklist.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={task.assigneeId !== currentUser?.id && task.delegatorId !== currentUser?.id}
                            onClick={() => handleToggleChecklistItem(task, item.id)}
                            className={`flex items-center gap-2.5 p-2 px-3 border rounded-xl text-xs font-semibold text-left transition-all ${
                              item.done 
                                ? 'bg-emerald-50/45 border-emerald-250 text-emerald-805' 
                                : 'bg-slate-50/50 hover:bg-slate-50/90 border-slate-200 text-slate-700'
                            }`}
                          >
                            {item.done ? (
                              <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                            ) : (
                              <Square size={15} className="text-slate-400 shrink-0" />
                            )}
                            <span className={`truncate ${item.done ? 'line-through text-emerald-600 font-medium' : ''}`}>{item.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Photo evidence proof view/box */}
                  {task.completionPhoto && (
                    <div className="border-t border-dashed border-gray-150 pt-4 flex gap-4 items-center">
                      <div className="shrink-0 w-20 h-20 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden relative">
                        <img src={task.completionPhoto} className="w-full h-full object-cover" alt="Comprovação" />
                      </div>
                      <div className="text-left space-y-1">
                        <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Camera size={14} className="text-blue-500" /> Foto de Comprovação de Conclusão de Tarefa
                        </p>
                        <p className="text-[11px] text-gray-500">Documento fotográfico anexado no sistema de auditoria para fins de checklist corporativo.</p>
                      </div>
                    </div>
                  )}

                  {/* Action row bottom */}
                  <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    
                    {/* Status change selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">Estágio:</span>
                      <select
                        value={task.status}
                        onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                        disabled={task.assigneeId !== currentUser?.id && task.delegatorId !== currentUser?.id}
                        className="border border-gray-200 bg-slate-50 font-bold p-1 px-2.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="TODO">A Fazer</option>
                        <option value="IN_PROGRESS">Em Andamento</option>
                        <option value="REVIEW">Em Revisão</option>
                        <option value="DONE">Concluída (Ok)</option>
                      </select>
                    </div>

                    {/* Completion and photo evidence actions */}
                    {task.assigneeId === currentUser?.id && (
                      <div className="flex gap-2">
                        {uploadingForTaskId === task.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => handleTaskPhotoUpload(e, task)} 
                              className="text-[10px] w-48 font-bold border rounded-lg bg-gray-100 file:border-0"
                            />
                            <button 
                              onClick={() => setUploadingForTaskId(null)} 
                              className="text-[10px] uppercase font-black text-red-500 hover:underline p-1"
                            >
                              Voltar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setUploadingForTaskId(task.id)}
                            className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-105 hover:text-blue-750 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all text-left"
                          >
                            <Camera size={13} /> {task.completionPhoto ? 'Substituir Foto' : 'Anexar Comprovante Foto'}
                          </button>
                        )}
                        
                        {task.status !== 'DONE' && (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'DONE')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                          >
                            <CheckCircle2 size={13} /> Marcar Concluída
                          </button>
                        )}
                      </div>
                    )}

                    {/* Approval panel for delegators if task is in REVIEW status */}
                    {task.delegatorId === currentUser?.id && task.assigneeId !== currentUser?.id && task.status === 'REVIEW' && (
                      <div className="flex items-center gap-1 bg-yellow-50/50 border border-yellow-200 rounded-xl p-1 shrink-0 animate-pulse">
                        <p className="text-[10px] font-bold text-yellow-700 px-2 shrink-0">Revisão Requerida:</p>
                        <button 
                          onClick={() => handleUpdateTaskStatus(task.id, 'DONE')} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 px-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                        >
                          <Check size={11} /> Homologar
                        </button>
                        <button 
                          onClick={() => handleUpdateTaskStatus(task.id, 'IN_PROGRESS')} 
                          className="bg-rose-600 hover:bg-rose-700 text-white p-1 px-2 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                        >
                          <X size={11} /> Recusar
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}

            {activeFilteredTasks.length === 0 && (
              <div className="text-center py-16 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
                <AlertCircle className="mx-auto text-slate-300" size={40} />
                <p className="text-sm font-semibold text-slate-500">Nenhuma tarefa cadastrada nesta guia no momento.</p>
                <p className="text-xs text-slate-400">Clique em "Nova Tarefa" acima para iniciar atividades de checklist.</p>
              </div>
            )}
          </div>
        </div>

        {/* Side guidelines details Column (Span 1) */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-xs text-left space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-50 pb-2.5 text-sm uppercase tracking-wider flex items-center gap-1.5"><Activity size={15} className="text-blue-500" /> Diretrizes de Delegação</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              O ecossistema NexusERP emprega segurança de Zero-Trust em seu organograma estrutural:
            </p>
            <ul className="text-xs text-slate-550 space-y-2 list-disc pl-4 leading-relaxed">
              <li>Você pode criar tarefas para si mesmo para controle pessoal de metas.</li>
              <li>A criação de tarefas para terceiros é restrita **somente aos seus subordinados hierárquicos**.</li>
              <li>As atividades delegadas a terceiros entram em status de teste, permitindo que você as homologue ou recuse após a entrega do checklist.</li>
              <li>Se você não tiver subordinados diretos, o sistema funcionará exclusivamente como um gerenciador de atividades pessoais e de transparência para atividades do seu setor.</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-xs text-left space-y-4">
            <h3 className="font-bold text-gray-900 border-b border-gray-50 pb-2.5 text-sm uppercase tracking-wider flex items-center gap-1.5"><Users size={15} className="text-indigo-500" /> Relação de Subordinados ({subordinates.length})</h3>
            <p className="text-xs text-slate-500">Abaixo estão listados os servidores ativos hierarquicamente vinculados à sua gerência:</p>
            <div className="space-y-2.5">
              {subordinates.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 p-2 border border-slate-100 bg-slate-50/50 rounded-xl">
                  <img src={sub.avatarUrl} className="w-8 h-8 rounded-full border border-slate-205" alt="" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 leading-tight">{sub.name}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">{sub.position} • {sub.department}</p>
                  </div>
                </div>
              ))}
              {subordinates.length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhum subordinado hierárquico vinculado à sua gerência.</p>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
