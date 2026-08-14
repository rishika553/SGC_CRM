import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock,
  FolderKanban,
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
import { clientQueryKeys, fetchClientDirectory, fetchMyClient } from '@/features/clients/clientQueries';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';

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
  subtasks: SubTaskItem[];
}

export interface ProjectModel {
  id: string;
  title: string;
  description?: string;
  clientName: string;
  clientId: string;
  dueDate: string;
  rawDeadline?: string;
  progress: number;
  isExpanded: boolean;
  tasks: TaskItem[];
}

export const ProjectsTasksPage: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projects, setProjects] = useState<ProjectModel[]>([]);

  // Track sub-task input text per parent task ID
  const [subTaskInputs, setSubTaskInputs] = useState<{ [taskId: string]: string }>({});
  // Track new task input text per project ID
  const [newTaskInputs, setNewTaskInputs] = useState<{ [projectId: string]: string }>({});

  // Create Project Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [isSubmittingProject, setIsSubmittingProject] = useState<boolean>(false);

  // Form fields for new project
  const [formClientId, setFormClientId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPriority, setFormPriority] = useState<string>('medium');
  const [formDeadline, setFormDeadline] = useState<string>('');

  // Fetch real projects & tasks from backend
  const fetchProjectsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeClientId = localStorage.getItem('crm_active_client_id');
      const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      const params: any = { page: 1, page_size: 50 };
      if (isUUID(activeClientId)) {
        params.client_id = activeClientId;
      }
      const projRes = await api.get<PaginatedResponse<any>>('/projects', { params });
      
      if (projRes.data.success && projRes.data.data) {
        const rawProjects = projRes.data.data;

        const formattedProjects: ProjectModel[] = rawProjects.map((p: any) => {
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
                subtasks: childSubs,
              };
            });

            // Calculate overall progress
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
              dueDate: p.deadline ? formatDate(p.deadline) : formatDate(p.created_at),
              rawDeadline: p.deadline,
              progress: calcProgress,
              isExpanded: true, // Default expanded for easy access
              tasks: topTasks,
            };
          });

        setProjects(formattedProjects);
      } else {
        setProjects([]);
      }
    } catch (err) {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjectsData();
  }, [fetchProjectsData]);

  // Toggle Project Accordion Expand / Collapse
  const toggleProjectExpand = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isExpanded: !p.isExpanded } : p))
    );
  };

  // Load clients list for Create Project dropdown
  const loadClientsList = async () => {
    try {
      const clients = await queryClient.fetchQuery({
        queryKey: clientQueryKeys.directory,
        queryFn: fetchClientDirectory,
      });
      if (clients.length > 0) {
        setClientsList(clients);
        if (!formClientId) {
          setFormClientId(clients[0].id);
        }
      }
    } catch (err) {
      try {
        const client = await queryClient.fetchQuery({
          queryKey: clientQueryKeys.mine,
          queryFn: fetchMyClient,
        });
        if (client) {
          setClientsList([client]);
          setFormClientId(client.id);
        }
      } catch (meErr) {
        toast('Error', 'Failed to fetch clients profile', 'error');
      }
    }
  };

  const handleOpenCreateModal = () => {
    loadClientsList();
    setIsCreateModalOpen(true);
  };

  // Admin / Client creates new project with Deadline Date
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast('Validation Error', 'Please enter a project name.', 'error');
      return;
    }

    setIsSubmittingProject(true);
    try {
      let targetClientId = formClientId;
      if (!targetClientId) {
        try {
          const client = await queryClient.fetchQuery({
            queryKey: clientQueryKeys.mine,
            queryFn: fetchMyClient,
          });
          if (client) {
            targetClientId = client.id;
          }
        } catch (e) {}
      }

      const payload: any = {
        name: formName.trim(),
        client_id: targetClientId || undefined,
        priority: formPriority,
        status: 'in_progress',
        description: formDescription.trim() || undefined,
        deadline: formDeadline ? new Date(`${formDeadline}T00:00:00Z`).toISOString() : undefined,
      };

      const res = await api.post('/projects', payload);
      if (res.data.success) {
        toast('Project Created', `Project "${formName.trim()}" created successfully.`, 'success');
        setIsCreateModalOpen(false);
        setFormName('');
        setFormDescription('');
        setFormDeadline('');
        await fetchProjectsData();
      }
    } catch (err: any) {
      toast('Creation Failed', err.response?.data?.error?.message || 'Failed to create project.', 'error');
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    if (!confirm(`Are you sure you want to delete project "${projectTitle}"?`)) return;

    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast('Project Deleted', `Project "${projectTitle}" removed successfully.`, 'success');
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to delete project.', 'error');
    }
  };

  // Toggle Task Completion Status
  // Toggle Task Completion Status
  const handleToggleTask = async (projectId: string, taskId: string) => {
    let targetCompleted = false;

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;

        const updatedTasks = p.tasks.map((t) => {
          if (t.id !== taskId) return t;
          targetCompleted = !t.completed;
          return { ...t, completed: targetCompleted };
        });

        // Recalculate progress
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

        return { ...p, tasks: updatedTasks, progress: newProgress };
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
        fetchProjectsData();
      }
    }
  };

  // Toggle Sub-Task Completion Status
  const handleToggleSubTask = async (projectId: string, taskId: string, subTaskId: string) => {
    let targetCompleted = false;

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;

        const updatedTasks = p.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const updatedSubs = t.subtasks.map((st) => {
            if (st.id !== subTaskId) return st;
            targetCompleted = !st.completed;
            return { ...st, completed: targetCompleted };
          });
          return { ...t, subtasks: updatedSubs };
        });

        // Recalculate progress
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

        return { ...p, tasks: updatedTasks, progress: newProgress };
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
        fetchProjectsData();
      }
    }
  };

  // Delete Task
  const handleDeleteTask = async (projectId: string, taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          const updatedTasks = p.tasks.filter((t) => t.id !== taskId);
          return { ...p, tasks: updatedTasks };
        })
      );
      toast('Task Deleted', 'Task removed successfully.', 'success');
    } catch (err: any) {
      toast('Error', 'Failed to delete task.', 'error');
    }
  };

  // Delete Sub-Task
  const handleDeleteSubTask = async (projectId: string, taskId: string, subTaskId: string) => {
    try {
      await api.delete(`/tasks/${subTaskId}`);
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          const updatedTasks = p.tasks.map((t) => {
            if (t.id !== taskId) return t;
            return { ...t, subtasks: t.subtasks.filter((st) => st.id !== subTaskId) };
          });
          return { ...p, tasks: updatedTasks };
        })
      );
    } catch (err: any) {
      toast('Error', 'Failed to delete sub-task.', 'error');
    }
  };

  const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  // Add Top-Level Task to Project
  const handleAddTask = async (projectId: string, clientId?: string) => {
    const text = (newTaskInputs[projectId] || '').trim();
    if (!text) return;

    setNewTaskInputs((prev) => ({ ...prev, [projectId]: '' }));

    try {
      const payload: any = {
        title: text,
        priority: 'medium',
        status: 'todo',
      };
      if (isUUID(projectId)) payload.project_id = projectId;
      if (isUUID(clientId)) payload.client_id = clientId;

      const res = await api.post('/tasks', payload);

      if (res.data.success && res.data.data) {
        const newTaskData = res.data.data;
        const newTask: TaskItem = {
          id: newTaskData.id,
          title: newTaskData.title,
          completed: newTaskData.status === 'completed',
          subtasks: [],
        };

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const updatedTasks = [...p.tasks, newTask];
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
            const newProgress = total > 0 ? Math.round((done / total) * 100) : p.progress;
            return { ...p, tasks: updatedTasks, progress: newProgress };
          })
        );

        toast('Task Added', `Task "${text}" added to project.`, 'success');
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || err.response?.data?.message || 'Failed to add task.', 'error');
    }
  };

  // Add Sub-Task to Parent Task
  const handleAddSubTask = async (projectId: string, clientId: string | undefined, parentTaskId: string) => {
    const text = (subTaskInputs[parentTaskId] || '').trim();
    if (!text) return;

    setSubTaskInputs((prev) => ({ ...prev, [parentTaskId]: '' }));

    try {
      const payload: any = {
        title: text,
        priority: 'medium',
        status: 'todo',
      };
      if (isUUID(projectId)) payload.project_id = projectId;
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

        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const updatedTasks = p.tasks.map((t) => {
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
            const newProgress = total > 0 ? Math.round((done / total) * 100) : p.progress;
            return { ...p, tasks: updatedTasks, progress: newProgress };
          })
        );

        toast('Sub-task Added', `Sub-task "${text}" added.`, 'success');
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to add sub-task.', 'error');
    }
  };

  return (
    <MainLayout clientName="Client Desk" pageTitle="Projects & Tasks">
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects & Tasks</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Create client projects, manage tasks, sub-tasks, and track completion progress.
            </p>
          </div>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleOpenCreateModal}
            leftIcon={<Plus className="w-5 h-5" />}
            className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm w-full sm:w-auto"
          >
            Create Project
          </Button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16 bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs">
            <EmptyState
              icon={<FolderKanban className="w-12 h-12 text-[#5E8C61]" />}
              title="No Projects Found"
              description="Click 'Create Project' at the top right to add a new project."
            />
          </div>
        ) : (
          /* Projects Accordion Stack */
          <div className="space-y-5">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all duration-200"
              >
                {/* Project Header Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white">
                  {/* Left: Expand Button + Project Title & Client */}
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <button
                      onClick={() => toggleProjectExpand(p.id)}
                      className="mt-0.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                      aria-label="Toggle Project Details"
                    >
                      {p.isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                          {p.title}
                        </h2>
                        <button
                          onClick={() => handleDeleteProject(p.id, p.title)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {p.description && (
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Client Tag, Deadline Date, Progress Bar */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start sm:self-center text-xs flex-wrap">
                    {/* Client Name Badge */}
                    <span className="px-2.5 py-1 rounded-lg bg-[#EEF5EF] text-[#2F4F3A] font-semibold border border-[#5E8C61]/20 truncate max-w-[160px] sm:max-w-none">
                      Client: {p.clientName}
                    </span>

                    {/* Target Deadline Date Badge */}
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center gap-1.5 border border-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-[#5E8C61]" />
                      Deadline: {p.dueDate}
                    </span>

                    {/* Progress Bar & Percentage */}
                    <div className="flex items-center gap-2">
                      <div className="w-20 sm:w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                        <div
                          className="h-full bg-[#5E8C61] transition-all duration-300 rounded-full"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-extrabold text-[#2F4F3A] w-8 sm:w-9 text-right">
                        {p.progress}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Section: Tasks & Sub-Tasks */}
                {p.isExpanded && (
                  <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-[#5E8C61]" />
                        <span>Tasks & Sub-tasks</span>
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">
                        {p.tasks.length} tasks
                      </span>
                    </div>

                    {/* List of Tasks */}
                    {p.tasks.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        No tasks added yet. Add a task below to get started.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {p.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3"
                          >
                            {/* Parent Task Header Row */}
                            <div className="flex items-center justify-between gap-3">
                              <div
                                onClick={() => handleToggleTask(p.id, task.id)}
                                className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
                              >
                                {task.completed ? (
                                  <div className="w-5 h-5 rounded-md bg-[#2F4F3A] text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-md border-2 border-slate-300 group-hover:border-[#5E8C61] shrink-0 transition-colors bg-white" />
                                )}

                                <span
                                  className={cn(
                                    'text-sm font-semibold text-slate-800 truncate',
                                    task.completed && 'line-through text-slate-400 font-medium'
                                  )}
                                >
                                  {task.title}
                                </span>
                              </div>

                              <button
                                onClick={() => handleDeleteTask(p.id, task.id)}
                                className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                                title="Delete task"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Sub-Tasks Indented List */}
                            {task.subtasks.length > 0 && (
                              <div className="pl-7 space-y-2 pt-2 border-t border-slate-100">
                                {task.subtasks.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="flex items-center justify-between gap-2 py-0.5 group"
                                  >
                                    <div
                                      onClick={() => handleToggleSubTask(p.id, task.id, sub.id)}
                                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                                    >
                                      <CornerDownRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                      {sub.completed ? (
                                        <div className="w-4 h-4 rounded bg-[#2F4F3A] text-white flex items-center justify-center shrink-0">
                                          <Check className="w-3 h-3 stroke-[3]" />
                                        </div>
                                      ) : (
                                        <div className="w-4 h-4 rounded border-2 border-slate-300 group-hover:border-[#5E8C61] shrink-0 bg-white" />
                                      )}
                                      <span
                                        className={cn(
                                          'text-xs font-medium text-slate-700 truncate',
                                          sub.completed && 'line-through text-slate-400'
                                        )}
                                      >
                                        {sub.title}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteSubTask(p.id, task.id, sub.id)}
                                      className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                      title="Delete sub-task"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Indented Sub-Task Form Input */}
                            <div className="pl-7 pt-1 flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="+ Add a sub-task..."
                                value={subTaskInputs[task.id] || ''}
                                onChange={(e) =>
                                  setSubTaskInputs({ ...subTaskInputs, [task.id]: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubTask(p.id, p.clientId, task.id);
                                  }
                                }}
                                className="flex-1 bg-slate-50 border border-slate-200 focus:border-[#5E8C61] focus:bg-white rounded-lg text-xs px-3 py-1.5 text-slate-800 outline-none transition-all placeholder:text-slate-400"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleAddSubTask(p.id, p.clientId, task.id)}
                                className="text-[11px] px-2.5 py-1.5 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100"
                              >
                                Add Sub-task
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Top-Level Task Input Form */}
                    <div className="pt-2 flex items-center gap-2">
                      <Input
                        placeholder="+ Add a main task to this project..."
                        value={newTaskInputs[p.id] || ''}
                        onChange={(e) =>
                          setNewTaskInputs({ ...newTaskInputs, [p.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTask(p.id, p.clientId);
                          }
                        }}
                        className="bg-white border-slate-200 focus:border-[#5E8C61] rounded-xl text-xs py-2 text-slate-800"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => handleAddTask(p.id, p.clientId)}
                        className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs px-4 py-2 rounded-xl font-semibold shrink-0"
                      >
                        Add Task
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
        description="Fill in the project details and target deadline date."
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
              onClick={handleCreateProjectSubmit}
              disabled={isSubmittingProject}
              className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white text-xs font-semibold px-4 py-2"
            >
              {isSubmittingProject ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateProjectSubmit} className="space-y-4 text-xs">
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

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Project Name / Title <span className="text-red-500">*</span>
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
            <label className="block font-bold text-slate-800 mb-1">Project Description / Scope (Optional)</label>
            <textarea
              rows={3}
              placeholder="Brief description of the project deliverables or notes..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#5E8C61] focus:bg-white rounded-xl text-xs p-3 font-medium text-slate-800 outline-none resize-none"
            />
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};
