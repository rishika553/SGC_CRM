import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Plus,
  Calendar,
  Loader2,
  Trash2,
  CheckSquare,
  CornerDownRight,
  FolderKanban,
  ChevronsLeft,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
  RotateCcw,
  Search,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/features/auth/AuthContext';
import { clientQueryKeys, fetchClientDirectory, fetchMyClient, resolveClientIdForCurrentUser, useMyClient } from '@/features/clients/clientQueries';
import { Client } from '@/types/client';
import { PaginatedResponse, PaginatedMeta } from '@/types';
import { MultiUserSelect } from '@/components/ui/MultiUserSelect';
import { ClientRMSelect } from '@/components/ui/ClientRMSelect';

export interface SubTaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority?: 'High' | 'Medium' | 'Low';
  recurrence_type?: string;
  subtasks: SubTaskItem[];
}

export interface AgendaModel {
  id: string;
  title: string;
  description?: string;
  clientName: string;
  clientId: string;
  dueDate: string;
  rawDeadline?: string;
  createdAt: string;
  progress: number;
  tasks: TaskItem[];
}

export const ProjectsTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer' || roleNameStr.includes('client');
  const { data: myClient } = useMyClient(isClientRole);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [agendas, setAgendas] = useState<AgendaModel[]>([]);
  const [expandedAgendas, setExpandedAgendas] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Client dropdown filter
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(() => localStorage.getItem('agenda_client_filter') || '');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [isClientListOpen, setIsClientListOpen] = useState<boolean>(false);
  const clientListBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pagination
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, page_size: 10, total_pages: 1, has_next: false, has_previous: false });

  const goToPage = (page: number) => {
    setMeta((prev) => ({ ...prev, page }));
  };

  // Track sub-task input text per parent task ID
  const [subTaskInputs, setSubTaskInputs] = useState<{ [taskId: string]: string }>({});
  // Track new task input text per agenda ID
  const [newTaskInputs, setNewTaskInputs] = useState<{ [agendaId: string]: string }>({});
  // Track recurrence options per agenda ID
  const [taskRecurrence, setTaskRecurrence] = useState<{ [agendaId: string]: { type: string; interval: number } }>({});

  // Track client RM selection per agenda ID
  const [agendaRMSelection, setAgendaRMSelection] = useState<{ [agendaId: string]: string | null }>({});

  // Create Agenda Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSubmittingAgenda, setIsSubmittingAgenda] = useState<boolean>(false);

  // Form fields for new agenda
  const [formClientId, setFormClientId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPriority, setFormPriority] = useState<string>('medium');
  const [formDeadline, setFormDeadline] = useState<string>('');
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]);

  const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  // Load client directory for filter dropdown + create modal
  const loadClientsList = useCallback(async () => {
    try {
      const clients = await queryClient.fetchQuery({
        queryKey: clientQueryKeys.directory,
        queryFn: fetchClientDirectory,
      });
      if (clients.length > 0) {
        setClientsList(clients);
      }
    } catch (err) {
      if (isClientRole) {
        try {
          const client = await queryClient.fetchQuery({
            queryKey: clientQueryKeys.mine,
            queryFn: fetchMyClient,
          });
          if (client) {
            setClientsList([client]);
          }
        } catch (meErr) {
          // silent
        }
      }
    }
  }, [isClientRole]);

  useEffect(() => {
    loadClientsList();
  }, [loadClientsList]);

  // Lock client dropdown for client-role users
  useEffect(() => {
    if (isClientRole && clientsList.length > 0 && !selectedClientId) {
      setSelectedClientId(clientsList[0].id);
    }
  }, [isClientRole, clientsList, selectedClientId]);

  // Pre-fill create-modal client for client role from useMyClient hook
  useEffect(() => {
    if (isClientRole && myClient?.id && !formClientId) {
      setFormClientId(myClient.id);
    }
  }, [isClientRole, myClient, formClientId]);

  // Persist selected client filter
  useEffect(() => {
    if (selectedClientId) {
      localStorage.setItem('agenda_client_filter', selectedClientId);
    } else {
      localStorage.removeItem('agenda_client_filter');
    }
  }, [selectedClientId]);

  // Filtered client list for search
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clientsList;
    const q = clientSearch.toLowerCase();
    return clientsList.filter((c) => c.name.toLowerCase().includes(q));
  }, [clientsList, clientSearch]);

  const selectedClientName = useMemo(() => {
    if (!selectedClientId) return '';
    return clientsList.find((c) => c.id === selectedClientId)?.name || '';
  }, [clientsList, selectedClientId]);

  // Fetch agendas & tasks from backend
  const fetchAgendasData = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeClientId = await resolveClientIdForCurrentUser(isClientRole);
      const params: any = { page: meta.page, page_size: meta.page_size };

      // Use filter dropdown client if set, otherwise use resolved client
      const filterClientId = selectedClientId || activeClientId;
      if (isUUID(filterClientId)) {
        params.client_id = filterClientId;
      }

      const projRes = await api.get<PaginatedResponse<any>>('/agendas', { params });

      if (projRes.data.success && projRes.data.data) {
        if (projRes.data.meta) {
          setMeta(projRes.data.meta);
        }
        const rawProjects = projRes.data.data;

        const formattedAgendas: AgendaModel[] = rawProjects.map((p: any) => {
          const allRawTasks = p.tasks || [];
          const parentTasks = allRawTasks.filter((t: any) => !t.parent_task_id);
          const subTasks = allRawTasks.filter((t: any) => t.parent_task_id);

          const topTasks: TaskItem[] = parentTasks.map((t: any) => {
            const childSubs: SubTaskItem[] = subTasks
              .filter((st: any) => st.parent_task_id === t.id)
              .map((st: any) => ({
                id: st.id,
                title: st.title,
                completed: st.status === 'completed',
              }));

            return {
              id: t.id,
              title: t.title,
              completed: t.status === 'completed',
              priority: t.priority ? (t.priority.charAt(0).toUpperCase() + t.priority.slice(1)) as any : 'Medium',
              recurrence_type: t.recurrence_type || 'none',
              subtasks: childSubs,
            };
          });

          let totalItems = 0;
          let completedItems = 0;
          topTasks.forEach((t) => {
            totalItems += 1;
            if (t.completed) completedItems += 1;
            t.subtasks.forEach((st) => {
              totalItems += 1;
              if (st.completed) completedItems += 1;
            });
          });

          const calcProgress = totalItems > 0
            ? Math.round((completedItems / totalItems) * 100)
            : (p.progress || 0);

          return {
            id: p.id,
            title: p.name,
            description: p.description || '',
            clientName: p.client?.name || 'Client',
            clientId: p.client_id,
            dueDate: p.deadline ? formatDate(p.deadline) : '',
            rawDeadline: p.deadline,
            createdAt: formatDate(p.created_at),
            progress: calcProgress,
            tasks: topTasks,
          };
        });

        setAgendas(formattedAgendas);
      } else {
        setAgendas([]);
      }
    } catch (err) {
      setAgendas([]);
    } finally {
      setIsLoading(false);
    }
  }, [isClientRole, selectedClientId, meta.page, meta.page_size]);

  useEffect(() => {
    fetchAgendasData();
  }, [fetchAgendasData]);

  // Toggle Agenda Expand / Collapse
  const toggleAgendaExpand = (agendaId: string) => {
    setExpandedAgendas((prev) => {
      const next = new Set(prev);
      if (next.has(agendaId)) next.delete(agendaId);
      else next.add(agendaId);
      return next;
    });
  };

  // Toggle Task Expand / Collapse
  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Admin / Client creates new agenda
  const handleOpenCreateModal = () => {
    if (clientsList.length === 0) loadClientsList();
    if (isClientRole && clientsList.length > 0 && !formClientId) {
      setFormClientId(clientsList[0].id);
    }
    setIsCreateModalOpen(true);
  };

  const handleCreateAgendaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast('Validation Error', 'Please enter an agenda name.', 'error');
      return;
    }

    setIsSubmittingAgenda(true);
    try {
      let targetClientId = formClientId;
      if (!targetClientId && myClient?.id) {
        targetClientId = myClient.id;
      }

      if (!targetClientId && !isClientRole) {
        toast('Validation Error', 'Please select a client account.', 'error');
        setIsSubmittingAgenda(false);
        return;
      }

      const payload: any = {
        name: formName.trim(),
        client_id: targetClientId || undefined,
        priority: formPriority,
        status: 'in_progress',
        description: formDescription.trim() || undefined,
        deadline: formDeadline ? new Date(`${formDeadline}T00:00:00Z`).toISOString() : undefined,
        assignee_ids: formAssigneeIds.length > 0 ? formAssigneeIds : undefined,
      };

      const res = await api.post('/agendas', payload);
      if (res.data.success) {
        toast('Agenda Created', `Agenda "${formName.trim()}" created successfully.`, 'success');
        setIsCreateModalOpen(false);
        setFormName('');
        setFormDescription('');
        setFormDeadline('');
        setFormAssigneeIds([]);
        await fetchAgendasData();
      }
    } catch (err: any) {
      toast('Creation Failed', err.response?.data?.error?.message || 'Failed to create agenda.', 'error');
    } finally {
      setIsSubmittingAgenda(false);
    }
  };

  // Delete Agenda
  const handleDeleteAgenda = async (agendaId: string, agendaTitle: string) => {
    if (!confirm(`Are you sure you want to delete agenda "${agendaTitle}"?`)) return;

    try {
      await api.delete(`/agendas/${agendaId}`);
      setAgendas((prev) => prev.filter((a) => a.id !== agendaId));
      setExpandedAgendas((prev) => { const next = new Set(prev); next.delete(agendaId); return next; });
      toast('Agenda Deleted', `Agenda "${agendaTitle}" removed successfully.`, 'success');
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to delete agenda.', 'error');
    }
  };

  // Toggle Task Completion Status
  const handleToggleTask = async (agendaId: string, taskId: string) => {
    let targetCompleted = false;

    setAgendas((prev) =>
      prev.map((a) => {
        if (a.id !== agendaId) return a;

        const updatedTasks = a.tasks.map((t) => {
          if (t.id !== taskId) return t;
          targetCompleted = !t.completed;
          return { ...t, completed: targetCompleted };
        });

        let total = 0;
        let done = 0;
        updatedTasks.forEach((t) => {
          total += 1;
          if (t.completed) done += 1;
          t.subtasks.forEach((st) => {
            total += 1;
            if (st.completed) done += 1;
          });
        });
        const newProgress = total > 0 ? Math.round((done / total) * 100) : 0;

        return { ...a, tasks: updatedTasks, progress: newProgress };
      })
    );

    try {
      await api.patch(`/tasks/${taskId}`, { status: targetCompleted ? 'completed' : 'todo' });
      toast('Task Updated', targetCompleted ? 'Task marked as completed.' : 'Task reopened.', 'success');
    } catch (err) {
      try {
        await api.post(`/tasks/${taskId}/complete`);
        toast('Task Updated', targetCompleted ? 'Task marked as completed.' : 'Task reopened.', 'success');
      } catch (err2) {
        toast('Error', 'Failed to update task status.', 'error');
        fetchAgendasData();
      }
    }
  };

  // Toggle Sub-Task Completion Status
  const handleToggleSubTask = async (agendaId: string, taskId: string, subTaskId: string) => {
    let targetCompleted = false;

    setAgendas((prev) =>
      prev.map((a) => {
        if (a.id !== agendaId) return a;

        const updatedTasks = a.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const updatedSubs = t.subtasks.map((st) => {
            if (st.id !== subTaskId) return st;
            targetCompleted = !st.completed;
            return { ...st, completed: targetCompleted };
          });
          return { ...t, subtasks: updatedSubs };
        });

        let total = 0;
        let done = 0;
        updatedTasks.forEach((t) => {
          total += 1;
          if (t.completed) done += 1;
          t.subtasks.forEach((st) => {
            total += 1;
            if (st.completed) done += 1;
          });
        });
        const newProgress = total > 0 ? Math.round((done / total) * 100) : 0;

        return { ...a, tasks: updatedTasks, progress: newProgress };
      })
    );

    try {
      await api.patch(`/tasks/${subTaskId}`, { status: targetCompleted ? 'completed' : 'todo' });
      toast('Sub-task Updated', targetCompleted ? 'Sub-task marked as completed.' : 'Sub-task reopened.', 'success');
    } catch (err) {
      try {
        await api.post(`/tasks/${subTaskId}/complete`);
        toast('Sub-task Updated', targetCompleted ? 'Sub-task marked as completed.' : 'Sub-task reopened.', 'success');
      } catch (err2) {
        toast('Error', 'Failed to update sub-task status.', 'error');
        fetchAgendasData();
      }
    }
  };

  // Delete Task
  const handleDeleteTask = async (agendaId: string, taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setAgendas((prev) =>
        prev.map((a) => {
          if (a.id !== agendaId) return a;
          const updatedTasks = a.tasks.filter((t) => t.id !== taskId);
          return { ...a, tasks: updatedTasks };
        })
      );
      toast('Task Deleted', 'Task removed successfully.', 'success');
    } catch (err: any) {
      toast('Error', 'Failed to delete task.', 'error');
    }
  };

  // Delete Sub-Task
  const handleDeleteSubTask = async (agendaId: string, taskId: string, subTaskId: string) => {
    try {
      await api.delete(`/tasks/${subTaskId}`);
      setAgendas((prev) =>
        prev.map((a) => {
          if (a.id !== agendaId) return a;
          const updatedTasks = a.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, subtasks: t.subtasks.filter((st) => st.id !== subTaskId) };
          });
          return { ...a, tasks: updatedTasks };
        })
      );
    } catch (err: any) {
      toast('Error', 'Failed to delete sub-task.', 'error');
    }
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const tp = meta.total_pages;
    const cp = meta.page;
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cp > 3) pages.push('...');
      const start = Math.max(2, cp - 1);
      const end = Math.min(tp - 1, cp + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (cp < tp - 2) pages.push('...');
      pages.push(tp);
    }
    return pages;
  }, [meta.total_pages, meta.page]);

  // Add Top-Level Task to Agenda
  const handleAddTask = async (agendaId: string, clientId?: string) => {
    const text = (newTaskInputs[agendaId] || '').trim();
    if (!text) return;

    setNewTaskInputs((prev) => ({ ...prev, [agendaId]: '' }));
    setTaskRecurrence((prev) => ({ ...prev, [agendaId]: { type: 'none', interval: 1 } }));

    const rec = taskRecurrence[agendaId];
    const recurrenceType = rec?.type || 'none';
    const recurrenceInterval = rec?.interval || 1;

    try {
      const payload: any = {
        title: text,
        priority: 'medium',
        status: 'todo',
        recurrence_type: recurrenceType,
        recurrence_interval: recurrenceType !== 'none' ? recurrenceInterval : undefined,
        assignee_ids: agendaRMSelection[agendaId] ? [agendaRMSelection[agendaId]] : undefined,
      };
      if (isUUID(agendaId)) payload.project_id = agendaId;
      if (isUUID(clientId)) payload.client_id = clientId;

      const res = await api.post('/tasks', payload);

      if (res.data.success && res.data.data) {
        const newTaskData = res.data.data;
        const newTask: TaskItem = {
          id: newTaskData.id,
          title: newTaskData.title,
          completed: newTaskData.status === 'completed',
          recurrence_type: recurrenceType,
          subtasks: [],
        };

        setAgendas((prev) =>
          prev.map((a) => {
            if (a.id !== agendaId) return a;
            const updatedTasks = [...a.tasks, newTask];
            let total = 0;
            let done = 0;
            updatedTasks.forEach((t) => {
              total += 1;
              if (t.completed) done += 1;
              t.subtasks.forEach((st) => {
                total += 1;
                if (st.completed) done += 1;
              });
            });
            const newProgress = total > 0 ? Math.round((done / total) * 100) : a.progress;
            return { ...a, tasks: updatedTasks, progress: newProgress };
          })
        );

        toast('Task Added', `Task "${text}" added to agenda.`, 'success');
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || err.response?.data?.message || 'Failed to add task.', 'error');
    }
  };

  // Add Sub-Task to Parent Task
  const handleAddSubTask = async (agendaId: string, clientId: string | undefined, parentTaskId: string) => {
    const text = (subTaskInputs[parentTaskId] || '').trim();
    if (!text) return;

    setSubTaskInputs((prev) => ({ ...prev, [parentTaskId]: '' }));

    try {
      const payload: any = {
        title: text,
        priority: 'medium',
        status: 'todo',
      };
      if (isUUID(agendaId)) payload.project_id = agendaId;
      if (isUUID(clientId)) payload.client_id = clientId;
      if (isUUID(parentTaskId)) payload.parent_task_id = parentTaskId;

      const res = await api.post('/tasks', payload);

      if (res.data.success && res.data.data) {
        const newSubData = res.data.data;
        const newSubTask: SubTaskItem = {
          id: newSubData.id,
          title: newSubData.title,
          completed: newSubData.status === 'completed',
        };

        setAgendas((prev) =>
          prev.map((a) => {
            if (a.id !== agendaId) return a;
            const updatedTasks = a.tasks.map((t) => {
              if (t.id !== parentTaskId) return t;
              return { ...t, subtasks: [...t.subtasks, newSubTask] };
            });
            let total = 0;
            let done = 0;
            updatedTasks.forEach((t) => {
              total += 1;
              if (t.completed) done += 1;
              t.subtasks.forEach((st) => {
                total += 1;
                if (st.completed) done += 1;
              });
            });
            const newProgress = total > 0 ? Math.round((done / total) * 100) : a.progress;
            return { ...a, tasks: updatedTasks, progress: newProgress };
          })
        );

        toast('Sub-task Added', `Sub-task "${text}" added.`, 'success');
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to add sub-task.', 'error');
    }
  };

  const renderExpandedContent = (agenda: AgendaModel, mobile?: boolean) => (
    <div className="bg-slate-50/50 border-t border-slate-100 px-3 sm:px-4 py-4 space-y-3">
      {agenda.description && (
        <p className="text-xs text-slate-600 leading-relaxed pb-2 border-b border-slate-200/60">
          {agenda.description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-[#5E8C61]" />
          <span>Tasks</span>
        </h3>
        <span className="text-[11px] font-semibold text-slate-500">
          {agenda.tasks.length} task{agenda.tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {agenda.tasks.length > 0 && (
        <div className="space-y-2">
          {agenda.tasks.map((task) => (
            <div key={task.id} className="bg-white border border-slate-200 rounded-lg shadow-2xs">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => toggleTaskExpand(task.id)}
                  className="p-0.5 text-slate-300 hover:text-slate-600 transition-colors shrink-0"
                >
                  {expandedTasks.has(task.id) ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <div
                  onClick={() => handleToggleTask(agenda.id, task.id)}
                  className="cursor-pointer shrink-0"
                >
                  {task.completed ? (
                    <div className="w-4 h-4 rounded bg-[#2F4F3A] text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded border-2 border-slate-300 hover:border-[#5E8C61] bg-white transition-colors" />
                  )}
                </div>
                <span
                  onClick={() => handleToggleTask(agenda.id, task.id)}
                  className={cn(
                    'text-xs font-semibold text-slate-800 truncate flex-1 cursor-pointer',
                    task.completed && 'line-through text-slate-400 font-medium'
                  )}
                >
                  {task.title}
                </span>
                {task.recurrence_type && task.recurrence_type !== 'none' && (
                  <span title={`Repeats ${task.recurrence_type}`} className="shrink-0">
                    <RotateCcw size={11} className="text-[#5E8C61]" />
                  </span>
                )}
                <button
                  onClick={() => handleDeleteTask(agenda.id, task.id)}
                  className="text-slate-300 hover:text-rose-600 transition-colors p-0.5 shrink-0"
                  title="Delete task"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {expandedTasks.has(task.id) && (
                <div className="border-t border-slate-100 bg-slate-50/30">
                  {task.subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 pl-8 sm:pl-10 pr-3 py-1.5 group">
                      <CornerDownRight className="w-3 h-3 text-slate-300 shrink-0" />
                      <div
                        onClick={() => handleToggleSubTask(agenda.id, task.id, sub.id)}
                        className="cursor-pointer shrink-0"
                      >
                        {sub.completed ? (
                          <div className="w-3.5 h-3.5 rounded bg-[#2F4F3A] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-3.5 h-3.5 rounded border-2 border-slate-300 group-hover:border-[#5E8C61] bg-white transition-colors" />
                        )}
                      </div>
                      <span
                        onClick={() => handleToggleSubTask(agenda.id, task.id, sub.id)}
                        className={cn(
                          'text-[11px] font-medium text-slate-600 truncate flex-1 cursor-pointer',
                          sub.completed && 'line-through text-slate-400'
                        )}
                      >
                        {sub.title}
                      </span>
                      <button
                        onClick={() => handleDeleteSubTask(agenda.id, task.id, sub.id)}
                        className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                        title="Delete sub-task"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pl-8 sm:pl-10 pr-3 py-1.5">
                    <input
                      type="text"
                      placeholder="+ Add sub-task..."
                      value={subTaskInputs[task.id] || ''}
                      onChange={(e) =>
                        setSubTaskInputs({ ...subTaskInputs, [task.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubTask(agenda.id, agenda.clientId, task.id);
                        }
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 focus:border-[#5E8C61] focus:bg-white rounded-md text-[11px] px-2.5 py-1 text-slate-700 outline-none transition-all placeholder:text-slate-400"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleAddSubTask(agenda.id, agenda.clientId, task.id)}
                      className="text-[10px] px-2 py-1 rounded-md border-slate-200 text-slate-600 hover:bg-slate-100"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {agenda.tasks.length === 0 && (
        <p className="text-[11px] text-slate-400 italic py-1">
          No tasks yet. Add one below.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Input
          id={mobile ? `task-input-m-${agenda.id}` : `task-input-${agenda.id}`}
          placeholder="+ Add a task to this agenda..."
          value={newTaskInputs[agenda.id] || ''}
          onChange={(e) =>
            setNewTaskInputs({ ...newTaskInputs, [agenda.id]: e.target.value })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddTask(agenda.id, agenda.clientId);
            }
          }}
          className="bg-white border-slate-200 focus:border-[#5E8C61] rounded-lg text-xs py-2 text-slate-800"
        />
        <Button
          type="button"
          variant="primary"
          onClick={() => handleAddTask(agenda.id, agenda.clientId)}
          className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs px-3 py-2 rounded-lg font-semibold shrink-0"
        >
          Add
        </Button>
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <RotateCcw size={12} className="text-slate-400" />
        <select
          value={taskRecurrence[agenda.id]?.type || 'none'}
          onChange={(e) => {
            const val = e.target.value;
            setTaskRecurrence((prev) => ({
              ...prev,
              [agenda.id]: { type: val, interval: prev[agenda.id]?.interval || 1 },
            }));
          }}
          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white outline-none"
        >
          <option value="none">No repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom</option>
        </select>
        {(taskRecurrence[agenda.id]?.type && taskRecurrence[agenda.id]?.type !== 'none') && (
          <>
            <span className="text-[11px] text-slate-400">every</span>
            <input
              type="number"
              min={1}
              max={365}
              value={taskRecurrence[agenda.id]?.interval || 1}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setTaskRecurrence((prev) => ({
                  ...prev,
                  [agenda.id]: { type: prev[agenda.id]?.type || 'none', interval: val },
                }));
              }}
              className="w-12 text-[11px] border border-slate-200 rounded-lg px-1.5 py-1 text-center text-slate-600 outline-none"
            />
            <span className="text-[11px] text-slate-400">
              {taskRecurrence[agenda.id]?.type === 'daily' ? 'day(s)' :
               taskRecurrence[agenda.id]?.type === 'weekly' ? 'week(s)' :
               taskRecurrence[agenda.id]?.type === 'monthly' ? 'month(s)' : 'day(s)'}
            </span>
          </>
        )}
        <ClientRMSelect
          clientId={agenda.clientId || null}
          selectedUserId={agendaRMSelection[agenda.id] || null}
          onChange={(userId) => setAgendaRMSelection((prev) => ({ ...prev, [agenda.id]: userId }))}
          className="ml-auto flex-shrink-0"
        />
      </div>
    </div>
  );

  return (
    <MainLayout clientName="Client Desk" pageTitle="Agenda & Task">
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Toolbar: Create button + Client filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleOpenCreateModal}
            leftIcon={<Plus className="w-5 h-5" />}
            className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm w-full sm:w-auto"
          >
            Create Agenda
          </Button>

          {/* Client Filter Search + List */}
          <div className="w-full sm:w-72 relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients..."
                value={isClientListOpen ? clientSearch : selectedClientName || clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  if (!isClientListOpen) setIsClientListOpen(true);
                }}
                onFocus={() => {
                  if (!isClientRole) {
                    setIsClientListOpen(true);
                    setClientSearch('');
                  }
                }}
                onBlur={() => {
                  clientListBlurTimeout.current = setTimeout(() => {
                    setIsClientListOpen(false);
                    setClientSearch('');
                  }, 200);
                }}
                disabled={isClientRole}
                className={cn(
                  "w-full bg-[#F7F9F6] border border-[#E3E8E3] focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-2.5 pl-9 pr-3 font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400",
                  isClientRole && "opacity-60 cursor-not-allowed"
                )}
              />
            </div>
            {isClientListOpen && !isClientRole && (
              <div
                className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-lg"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (clientListBlurTimeout.current) clearTimeout(clientListBlurTimeout.current);
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId('');
                    setMeta((prev) => ({ ...prev, page: 1 }));
                    setIsClientListOpen(false);
                    setClientSearch('');
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors",
                    !selectedClientId ? "text-[#2F4F3A] bg-[#EEF5EF]" : "text-slate-700"
                  )}
                >
                  All Clients
                </button>
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-400 italic">No clients found</div>
                ) : (
                  filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setMeta((prev) => ({ ...prev, page: 1 }));
                        setIsClientListOpen(false);
                        setClientSearch('');
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-2",
                        selectedClientId === c.id ? "text-[#2F4F3A] bg-[#EEF5EF]" : "text-slate-700"
                      )}
                    >
                      {selectedClientId === c.id && <Check className="w-3.5 h-3.5 text-[#5E8C61] shrink-0" />}
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : agendas.length === 0 ? (
          <div className="py-16 bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
            <EmptyState
              icon={<FolderKanban className="w-12 h-12 text-[#5E8C61]" />}
              title={selectedClientId ? "No Matching Agendas" : "No Agendas Found"}
              description={selectedClientId ? "No agendas found for the selected client. Try a different filter." : "Click 'Create Agenda' to add a new agenda."}
            />
          </div>
        ) : (
          <>
            {/* ========== DESKTOP TABLE (sm+) ========== */}
            <div className="hidden sm:block bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="w-10 px-3 py-3" />
                      <th className="px-4 py-3">Agenda</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3 text-center">Tasks</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Deadline</th>
                      <th className="px-4 py-3 w-36">Progress</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agendas.map((agenda) => (
                      <React.Fragment key={agenda.id}>
                        <tr className="hover:bg-slate-50/70 transition-colors duration-150">
                          <td className="px-3 py-3.5">
                            <button
                              onClick={() => toggleAgendaExpand(agenda.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              {expandedAgendas.has(agenda.id) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900 truncate">{agenda.title}</div>
                            </div>
                          </td>
                           <td className="px-4 py-3.5">
                            {isClientRole ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#EEF5EF] text-[#2F4F3A] text-[11px] font-semibold border border-[#5E8C61]/20 truncate max-w-[120px] inline-block">
                                {agenda.clientName}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(`/clients/${agenda.clientId}`)}
                                className="px-2 py-0.5 rounded-md bg-[#EEF5EF] text-[#2F4F3A] text-[11px] font-semibold border border-[#5E8C61]/20 truncate max-w-[120px] inline-block hover:bg-[#DCE9DE] hover:underline underline-offset-2 transition-colors cursor-pointer"
                              >
                                {agenda.clientName}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xs font-semibold text-slate-600">{agenda.tasks.length}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs text-slate-500 whitespace-nowrap">{agenda.createdAt}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            {agenda.dueDate ? (
                              <span className="text-xs text-slate-700 font-medium whitespace-nowrap flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#5E8C61]" />
                                {agenda.dueDate}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                <div
                                  className="h-full bg-[#5E8C61] transition-all duration-300 rounded-full"
                                  style={{ width: `${agenda.progress}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-extrabold text-[#2F4F3A] w-8 text-right">
                                {agenda.progress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (!expandedAgendas.has(agenda.id)) toggleAgendaExpand(agenda.id);
                                  setTimeout(() => {
                                    const el = document.getElementById(`task-input-${agenda.id}`);
                                    if (el) el.focus();
                                  }, 100);
                                }}
                                leftIcon={<Plus className="w-3.5 h-3.5" />}
                                className="text-[11px] px-2.5 py-1 rounded-lg"
                              >
                                Add Task
                              </Button>
                              <button
                                onClick={() => handleDeleteAgenda(agenda.id, agenda.title)}
                                className="text-slate-300 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
                                title="Delete agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedAgendas.has(agenda.id) && (
                          <tr>
                            <td colSpan={8} className="p-0">
                              {renderExpandedContent(agenda)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========== MOBILE CARDS (below sm) ========== */}
            <div className="sm:hidden space-y-3">
              {agendas.map((agenda) => (
                <div
                  key={agenda.id}
                  className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden"
                >
                  <div className="p-3.5">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleAgendaExpand(agenda.id)}
                        className="mt-0.5 p-0.5 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                      >
                        {expandedAgendas.has(agenda.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{agenda.title}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteAgenda(agenda.id, agenda.title)}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1 rounded-lg shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pl-6 mt-2 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isClientRole ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#EEF5EF] text-[#2F4F3A] text-[11px] font-semibold border border-[#5E8C61]/20">
                            {agenda.clientName}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/clients/${agenda.clientId}`)}
                            className="px-2 py-0.5 rounded-md bg-[#EEF5EF] text-[#2F4F3A] text-[11px] font-semibold border border-[#5E8C61]/20 hover:bg-[#DCE9DE] hover:underline underline-offset-2 transition-colors cursor-pointer"
                          >
                            {agenda.clientName}
                          </button>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {agenda.tasks.length} task{agenda.tasks.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">Created:</span> {agenda.createdAt}
                        </span>
                        {agenda.dueDate && (
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Calendar className="w-3 h-3 text-[#5E8C61]" />
                            Due: {agenda.dueDate}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div
                            className="h-full bg-[#5E8C61] transition-all duration-300 rounded-full"
                            style={{ width: `${agenda.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-extrabold text-[#2F4F3A] w-8 text-right">
                          {agenda.progress}%
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!expandedAgendas.has(agenda.id)) toggleAgendaExpand(agenda.id);
                          setTimeout(() => {
                            const el = document.getElementById(`task-input-m-${agenda.id}`);
                            if (el) el.focus();
                          }, 100);
                        }}
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        className="text-[11px] px-2.5 py-1 rounded-lg mt-1"
                      >
                        Add Task
                      </Button>
                    </div>
                  </div>

                  {expandedAgendas.has(agenda.id) && (
                    renderExpandedContent(agenda, true)
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {!isLoading && meta.total > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-200">
            <span className="font-medium">
              Showing {((meta.page - 1) * meta.page_size) + 1}–{Math.min(meta.page * meta.page_size, meta.total)} of {meta.total} agendas
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm" variant="outline"
                disabled={!meta.has_previous}
                onClick={() => goToPage(1)}
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant="outline"
                disabled={!meta.has_previous}
                onClick={() => goToPage(meta.page - 1)}
                leftIcon={<ChevronLeftIcon className="w-3.5 h-3.5" />}
              >
                Prev
              </Button>

              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="px-1.5 text-slate-400">...</span>
                ) : (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === meta.page ? 'primary' : 'outline'}
                    onClick={() => goToPage(p as number)}
                    className={cn(
                      "min-w-[32px] justify-center",
                      p === meta.page && "bg-[#2F4F3A] hover:bg-[#243E2E] text-white"
                    )}
                  >
                    {p}
                  </Button>
                )
              )}

              <Button
                size="sm" variant="outline"
                disabled={!meta.has_next}
                onClick={() => goToPage(meta.page + 1)}
                rightIcon={<ChevronRightIcon className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
              <Button
                size="sm" variant="outline"
                disabled={!meta.has_next}
                onClick={() => goToPage(meta.total_pages)}
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Admin Create Agenda Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Agenda"
        description="Fill in the agenda details and target deadline date."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              className="text-xs font-semibold px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCreateAgendaSubmit}
              disabled={isSubmittingAgenda}
              className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs font-semibold px-4 py-2"
            >
              {isSubmittingAgenda ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                'Create Agenda'
              )}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateAgendaSubmit} className="space-y-4 text-xs">
          {!isClientRole && (
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Select Client Account <span className="text-red-500">*</span>
              </label>
              {clientsList.length === 0 ? (
                <p className="text-xs text-amber-600 font-medium">No clients found. Please create a client account first under Client Desk.</p>
              ) : (
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#5E8C61] focus:bg-white rounded-xl text-xs px-3 py-2 font-medium text-slate-800 outline-none"
                >
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Agenda Name / Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Annual Audit & Tax Filing 2026"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="bg-slate-50 border-slate-200 focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Target Deadline Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white focus:border-[#5E8C61] rounded-xl text-xs py-2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#5E8C61] focus:bg-white rounded-xl text-xs px-3 py-2 font-medium text-slate-800 outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Description / Scope (Optional)</label>
            <textarea
              rows={3}
              placeholder="Brief description of the agenda deliverables or notes..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#5E8C61] focus:bg-white rounded-xl text-xs p-3 font-medium text-slate-800 outline-none resize-none"
            />
          </div>

          <MultiUserSelect
            selectedIds={formAssigneeIds}
            onChange={setFormAssigneeIds}
            placeholder="Assign relationship managers..."
          />
        </form>
      </Modal>
    </MainLayout>
  );
};
