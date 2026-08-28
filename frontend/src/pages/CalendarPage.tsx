import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Video,
  Phone,
  Users,
  Trash2,
  Edit3,
  X,
  StickyNote,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatDate, cn, formatName } from '@/lib/utils';
import { api } from '@/lib/axios';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/features/auth/AuthContext';
import { clientQueryKeys, fetchMyClient, useMyClient } from '@/features/clients/clientQueries';
import { Client } from '@/types/client';
import { PaginatedResponse } from '@/types';
import { MultiUserSelect } from '@/components/ui/MultiUserSelect';
import { ClientRMSelect } from '@/components/ui/ClientRMSelect';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  location?: string;
  meeting_type: 'in_person' | 'video_call' | 'phone_call' | 'other';
  status: 'scheduled' | 'cancelled' | 'rescheduled';
  start_time: string;
  end_time: string;
  timezone: string;
  client_id: string;
  project_id?: string;
  created_by_id?: string;
  client?: Client;
  project?: { id: string; name: string };
  created_by?: { id: string; first_name: string; last_name: string };
  created_at: string;
  assignees?: { id: string; user_id: string; user?: { id: string; first_name: string; last_name: string } }[];
}

interface Note {
  id: string;
  title: string;
  content: string;
  client_id?: string;
  project_id?: string;
  meeting_id?: string;
  client?: Client;
  project?: { id: string; name: string };
  meeting?: { id: string; title: string; start_time: string };
  created_by?: { id: string; first_name: string; last_name: string };
  created_at: string;
}


const MEETING_TYPE_ICONS: Record<string, React.ReactNode> = {
  in_person: <Users className="w-3.5 h-3.5" />,
  video_call: <Video className="w-3.5 h-3.5" />,
  phone_call: <Phone className="w-3.5 h-3.5" />,
  other: <Clock className="w-3.5 h-3.5" />,
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  rescheduled: 'bg-purple-50 text-purple-700 border-purple-200',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isSameDay(a: string, b: Date) {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}


export const CalendarPage: React.FC = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const roleNameStr = String(currentUser?.role?.name || '').toLowerCase();
  const isClientRole = roleNameStr === 'client' || roleNameStr === 'client_viewer';
  const { data: myClient } = useMyClient(isClientRole);

  const [isLoading, setIsLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [clientList, setClientList] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'calendar' | 'notes'>('calendar');

  // Meeting modal
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    description: '',
    location: '',
    meeting_type: 'in_person' as string,
    start_time: '',
    end_time: '',
    client_id: '',
    project_id: '',
    status: 'scheduled',
    assignee_ids: [] as string[],
  });

  // Note modal
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    client_id: '',
    project_id: '',
    meeting_id: '',
  });

  // Detail modal
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'meeting' | 'note'; id: string } | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);

  // Client RM selection (per-meeting)
  const [selectedRMUserId, setSelectedRMUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const [meetingsRes, notesRes] = await Promise.all([
        api.get('/meetings', { params: { page: 1, page_size: 200, start_date: startOfMonth, end_date: endOfMonth } }),
        api.get('/notes', { params: { page: 1, page_size: 100 } }),
      ]);

      if (meetingsRes.data?.success && Array.isArray(meetingsRes.data.data)) {
        setMeetings(meetingsRes.data.data);
      }
      if (notesRes.data?.success && Array.isArray(notesRes.data.data)) {
        setNotes(notesRes.data.data);
      }
    } catch {
      toast('Error', 'Failed to load calendar data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentDate]);

  const fetchClientList = useCallback(async () => {
    if (isClientRole) {
      try {
        const myClient = await queryClient.fetchQuery({
          queryKey: clientQueryKeys.mine,
          queryFn: fetchMyClient,
        });
        if (myClient) {
          setClientList([myClient]);
        }
      } catch {
        console.error('Failed to fetch own client');
      }
      return;
    }
    try {
      const res = await api.get('/clients', { params: { page: 1, page_size: 100 } });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientList(res.data.data);
      }
    } catch {
      console.error('Failed to fetch client list');
    }
  }, [isClientRole]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchClientList(); }, [fetchClientList]);

  const filteredMeetings = useMemo(() => {
    if (statusFilter === 'all') return meetings;
    return meetings.filter((m) => m.status === statusFilter);
  }, [meetings, statusFilter]);

  const getMeetingsForDay = useCallback(
    (date: Date) => filteredMeetings.filter((m) => isSameDay(m.start_time, date)),
    [filteredMeetings]
  );

  const openCreateMeeting = (date?: Date) => {
    setEditingMeeting(null);
    const start = date || new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
    const defaultClientId = isClientRole && myClient?.id ? myClient.id : '';
    setMeetingForm({
      title: '',
      description: '',
      location: '',
      meeting_type: 'in_person',
      start_time: start.toISOString().slice(0, 16),
      end_time: end.toISOString().slice(0, 16),
      client_id: defaultClientId,
      project_id: '',
      status: 'scheduled',
      assignee_ids: [],
    });
    setIsMeetingModalOpen(true);
    setSelectedRMUserId(null);
  };

  const openEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setMeetingForm({
      title: meeting.title,
      description: meeting.description || '',
      location: meeting.location || '',
      meeting_type: meeting.meeting_type,
      start_time: meeting.start_time.slice(0, 16),
      end_time: meeting.end_time.slice(0, 16),
      client_id: meeting.client_id,
      project_id: meeting.project_id || '',
      status: meeting.status,
      assignee_ids: (meeting.assignees || []).map((a) => a.user_id),
    });
    setIsMeetingModalOpen(true);
    setSelectedMeeting(null);
    const existingAssignees = (meeting.assignees || []).map((a) => a.user_id);
    setSelectedRMUserId(existingAssignees.length > 0 ? existingAssignees[0] : null);
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingMeeting) return;

    if (meetingForm.start_time && meetingForm.end_time) {
      const newStart = new Date(meetingForm.start_time);
      const newEnd = new Date(meetingForm.end_time);
      const conflict = meetings.find((m) => {
        if (editingMeeting && m.id === editingMeeting.id) return false;
        if (!isSameDay(m.start_time, newStart)) return false;
        const existStart = new Date(m.start_time);
        const existEnd = new Date(m.end_time);
        return newStart < existEnd && newEnd > existStart;
      });
      if (conflict) {
        toast('Meeting Already Scheduled', `A meeting "${conflict.title}" already exists during this time slot.`, 'error');
        setIsSubmittingMeeting(false);
        return;
      }
    }

    setIsSubmittingMeeting(true);
    try {
      if (editingMeeting) {
        if (isClientRole) {
          toast('Error', 'You do not have permission to edit meetings.', 'error');
          return;
        }
        const payload = {
          ...meetingForm,
          client_id: meetingForm.client_id || undefined,
          start_time: meetingForm.start_time ? new Date(meetingForm.start_time).toISOString() : undefined,
          end_time: meetingForm.end_time ? new Date(meetingForm.end_time).toISOString() : undefined,
          project_id: meetingForm.project_id || undefined,
          assignee_ids: (() => {
            const base = new Set(meetingForm.assignee_ids);
            if (selectedRMUserId) base.add(selectedRMUserId);
            return base.size > 0 ? Array.from(base) : undefined;
          })(),
        };
        const res = await api.put(`/meetings/${editingMeeting.id}`, payload);
        if (res.data?.success) {
          toast('Meeting Updated', 'Meeting has been updated.', 'success');
          setIsMeetingModalOpen(false);
          fetchData();
        }
      } else {
        if (isClientRole) {
          const clientPayload = {
            title: meetingForm.title,
            description: meetingForm.description || undefined,
            location: meetingForm.location || undefined,
            meeting_type: meetingForm.meeting_type,
            start_time: meetingForm.start_time ? new Date(meetingForm.start_time).toISOString() : undefined,
            end_time: meetingForm.end_time ? new Date(meetingForm.end_time).toISOString() : undefined,
          };
          const res = await api.post('/meetings/client-schedule', clientPayload);
          if (res.data?.success) {
            toast('Meeting Created', 'Meeting has been scheduled.', 'success');
            setIsMeetingModalOpen(false);
            fetchData();
          }
        } else {
          const clientId = meetingForm.client_id;
          if (!clientId) {
            toast('Error', 'Please select a client.', 'error');
            return;
          }
          const payload = {
            ...meetingForm,
            client_id: clientId,
            start_time: meetingForm.start_time ? new Date(meetingForm.start_time).toISOString() : undefined,
            end_time: meetingForm.end_time ? new Date(meetingForm.end_time).toISOString() : undefined,
            project_id: meetingForm.project_id || undefined,
            assignee_ids: (() => {
              const base = new Set(meetingForm.assignee_ids);
              if (selectedRMUserId) base.add(selectedRMUserId);
              return base.size > 0 ? Array.from(base) : undefined;
            })(),
          };
          const res = await api.post('/meetings', payload);
          if (res.data?.success) {
            toast('Meeting Created', 'Meeting has been scheduled.', 'success');
            setIsMeetingModalOpen(false);
            fetchData();
          }
        }
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || err.response?.data?.detail || 'Failed to save meeting', 'error');
    } finally {
      setIsSubmittingMeeting(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const res = await api.delete(`/meetings/${meetingId}`);
      if (res.data?.success) {
        toast('Meeting Deleted', 'Meeting has been deleted.', 'success');
        setSelectedMeeting(null);
        setDeleteTarget(null);
        fetchData();
      }
    } catch (err: any) {
      setDeleteTarget(null);
      toast('Error', err.response?.data?.error?.message || 'Failed to delete meeting', 'error');
    }
  };

  const handleStatusChange = async (meetingId: string, newStatus: string) => {
    try {
      const res = await api.put(`/meetings/${meetingId}`, { status: newStatus });
      if (res.data?.success) {
        toast('Status Updated', `Meeting status changed to ${newStatus}.`, 'success');
        fetchData();
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to update status', 'error');
    }
  };

  // Notes
  const openCreateNote = (defaults?: Partial<Note>) => {
    setEditingNote(null);
    setNoteForm({
      title: '',
      content: '',
      client_id: defaults?.client_id || '',
      project_id: defaults?.project_id || '',
      meeting_id: defaults?.meeting_id || '',
    });
    setIsNoteModalOpen(true);
  };

  const openEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      client_id: note.client_id || '',
      project_id: note.project_id || '',
      meeting_id: note.meeting_id || '',
    });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...noteForm,
        client_id: noteForm.client_id || undefined,
        project_id: noteForm.project_id || undefined,
        meeting_id: noteForm.meeting_id || undefined,
      };

      if (editingNote) {
        const res = await api.put(`/notes/${editingNote.id}`, payload);
        if (res.data?.success) {
          toast('Note Updated', 'Note has been updated.', 'success');
          setIsNoteModalOpen(false);
          fetchData();
        }
      } else {
        const res = await api.post('/notes', payload);
        if (res.data?.success) {
          toast('Note Created', 'Note has been created.', 'success');
          setIsNoteModalOpen(false);
          fetchData();
        }
      }
    } catch (err: any) {
      toast('Error', err.response?.data?.error?.message || 'Failed to save note', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await api.delete(`/notes/${noteId}`);
      if (res.data?.success) {
        toast('Note Deleted', 'Note has been deleted.', 'success');
        setDeleteTarget(null);
        fetchData();
      }
    } catch (err: any) {
      setDeleteTarget(null);
      toast('Error', err.response?.data?.error?.message || 'Failed to delete note', 'error');
    }
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const headerLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // ─── MONTH VIEW ───
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="min-h-[100px] bg-gray-50/50" />);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayMeetings = getMeetingsForDay(date);
      const isToday = date.toDateString() === today.toDateString();

      cells.push(
        <div
          key={day}
          className={cn(
            'min-h-[100px] p-1.5 border border-[#E3E8E3] cursor-pointer hover:bg-[#EEF5EF] transition-colors',
            isToday && 'bg-[#EEF5EF]'
          )}
          onClick={() => setSelectedDayDate(date)}
        >
          <div className={cn('text-xs font-bold mb-1', isToday ? 'text-[#2F4F3A]' : 'text-[#6B7280]')}>
            {isToday ? (
              <span className="bg-[#2F4F3A] text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px]">{day}</span>
            ) : day}
          </div>
          <div className="space-y-0.5">
            {dayMeetings.slice(0, 3).map((m) => (
              <div
                key={m.id}
                onClick={(e) => { e.stopPropagation(); setSelectedMeeting(m); }}
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded truncate cursor-pointer',
                  STATUS_STYLES[m.status] || 'bg-slate-100 text-slate-600'
                )}
              >
                {formatTime(m.start_time)} {m.title}
              </div>
            ))}
            {dayMeetings.length > 3 && (
              <div className="text-[10px] text-[#6B7280] font-medium px-1">+{dayMeetings.length - 3} more</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-bold text-[#6B7280] py-2 bg-[#F1F5F1] border border-[#E3E8E3]">{d}</div>
        ))}
        {cells}
      </div>
    );
  };

  return (
    <MainLayout clientName="Client Desk" pageTitle="Calendar & Notes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
          <div>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              Schedule meetings, manage appointments, and keep track of notes
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              type="button"
              variant="primary"
              onClick={() => activeTab === 'calendar' ? openCreateMeeting() : openCreateNote()}
              leftIcon={<Plus className="w-5 h-5" />}
              className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-6 py-3 rounded-[16px] shadow-xs text-sm font-bold"
            >
              {activeTab === 'calendar' ? 'New Meeting' : 'New Note'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#F1F5F1] p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-lg transition-all',
              activeTab === 'calendar' ? 'bg-white text-[#2F4F3A] shadow-sm' : 'text-[#6B7280] hover:text-[#27332B]'
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5 inline mr-1.5" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-lg transition-all',
              activeTab === 'notes' ? 'bg-white text-[#2F4F3A] shadow-sm' : 'text-[#6B7280] hover:text-[#27332B]'
            )}
          >
            <StickyNote className="w-3.5 h-3.5 inline mr-1.5" />
            Notes ({notes.length})
          </button>
        </div>

        {/* Calendar Toolbar */}
        {activeTab === 'calendar' && (
          <div className="bg-white border border-[#E3E8E3] rounded-[20px] p-3.5 sm:p-4 shadow-[0_6px_20px_rgba(47,79,58,.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="p-2 rounded-xl">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" onClick={goToToday} className="px-3 py-2 text-xs font-bold rounded-xl">
                Today
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(1)} className="p-2 rounded-xl">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold text-[#27332B] ml-2">{headerLabel}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-2.5 py-2 text-xs">
                <Filter className="w-3.5 h-3.5 text-[#5E8C61]" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-none text-[#27332B] font-semibold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Content */}
        {activeTab === 'calendar' && (
          <div className="bg-white border border-[#E3E8E3] rounded-[20px] overflow-hidden shadow-[0_6px_20px_rgba(47,79,58,.05)]">
            {isLoading ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="py-14">
                <EmptyState
                  icon={<CalendarIcon className="w-12 h-12 text-[#5E8C61]" />}
                  title="No Meetings Scheduled"
                  description="Click on a date or 'New Meeting' to schedule your first appointment."
                />
              </div>
            ) : (
              renderMonthView()
            )}
          </div>
        )}

        {/* Notes List */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
            ) : notes.length === 0 ? (
              <div className="bg-white border border-[#E3E8E3] rounded-[20px] py-14 shadow-[0_6px_20px_rgba(47,79,58,.05)]">
                <EmptyState
                  icon={<StickyNote className="w-12 h-12 text-[#5E8C61]" />}
                  title="No Notes Yet"
                  description="Create notes linked to clients, agendas, or meetings."
                />
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="bg-white border border-[#E3E8E3] rounded-[18px] p-4 sm:p-5 shadow-[0_6px_20px_rgba(47,79,58,.05)] hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[#27332B]">{note.title}</h3>
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{note.content}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {note.client && (
                          <span className="text-[10px] font-bold bg-[#EEF5EF] text-[#2F4F3A] px-2 py-0.5 rounded-full">{note.client.name}</span>
                        )}
                        {note.project && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{note.project.name}</span>
                        )}
                        {note.meeting && (
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Meeting: {note.meeting.title}</span>
                        )}
                        <span className="text-[10px] text-[#6B7280]">{formatDate(new Date(note.created_at))}</span>
                        {note.created_by && (
                           <span className="text-[10px] text-[#6B7280]">by {formatName(note.created_by.first_name, note.created_by.last_name)}</span>
                        )}
                      </div>
                    </div>
                    {!isClientRole && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openEditNote(note)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#2F4F3A] hover:bg-[#EEF5EF]">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget({ type: 'note', id: note.id })} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Meeting Detail Modal */}
        {selectedMeeting && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedMeeting(null)} />
            <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-5 sm:p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-[#E3E8E3]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-[#27332B]">{selectedMeeting.title}</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">Meeting Details</p>
                </div>
                <button type="button" onClick={() => setSelectedMeeting(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', STATUS_STYLES[selectedMeeting.status])}>
                    {selectedMeeting.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className="text-xs font-medium text-[#6B7280] flex items-center gap-1">
                    {MEETING_TYPE_ICONS[selectedMeeting.meeting_type]}
                    {selectedMeeting.meeting_type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#F7F9F6] rounded-xl p-3">
                    <div className="font-bold text-[#6B7280] mb-1">Start</div>
                    <div className="font-semibold text-[#27332B]">{new Date(selectedMeeting.start_time).toLocaleString()}</div>
                  </div>
                  <div className="bg-[#F7F9F6] rounded-xl p-3">
                    <div className="font-bold text-[#6B7280] mb-1">End</div>
                    <div className="font-semibold text-[#27332B]">{new Date(selectedMeeting.end_time).toLocaleString()}</div>
                  </div>
                </div>

                {selectedMeeting.location && (
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="font-medium">{selectedMeeting.location}</span>
                  </div>
                )}

                {selectedMeeting.description && (
                  <div className="bg-[#F7F9F6] rounded-xl p-3 text-xs text-[#27332B]">
                    {selectedMeeting.description}
                  </div>
                )}

                {selectedMeeting.client && (
                  <div className="text-xs">
                    <span className="font-bold text-[#6B7280]">Client: </span>
                    <span className="font-semibold text-[#27332B]">{selectedMeeting.client.name}</span>
                  </div>
                )}

                {selectedMeeting.project && (
                  <div className="text-xs">
                    <span className="font-bold text-[#6B7280]">Agenda: </span>
                    <span className="font-semibold text-[#27332B]">{selectedMeeting.project.name}</span>
                  </div>
                )}

                {/* Meeting-linked notes */}
                {notes.filter((n) => n.meeting_id === selectedMeeting.id).length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-[#6B7280] mb-2">Linked Notes</div>
                    {notes.filter((n) => n.meeting_id === selectedMeeting.id).map((n) => (
                      <div key={n.id} className="bg-[#EEF5EF] rounded-xl p-3 mb-2 text-xs">
                        <div className="font-bold text-[#27332B]">{n.title}</div>
                        <div className="text-[#6B7280] mt-0.5 line-clamp-2">{n.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!isClientRole && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[#E3E8E3]">
                    <select
                      value={selectedMeeting.status}
                      onChange={(e) => handleStatusChange(selectedMeeting.id, e.target.value)}
                      className="text-xs font-bold bg-[#F7F9F6] border border-[#E3E8E3] rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="rescheduled">Rescheduled</option>
                    </select>
                    <Button type="button" variant="outline" onClick={() => openEditMeeting(selectedMeeting)} leftIcon={<Edit3 className="w-3.5 h-3.5" />} className="text-xs px-3 py-1.5 rounded-lg">
                      Edit
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { openCreateNote({ meeting_id: selectedMeeting.id }); setSelectedMeeting(null); }} leftIcon={<StickyNote className="w-3.5 h-3.5" />} className="text-xs px-3 py-1.5 rounded-lg">
                      Add Note
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDeleteTarget({ type: 'meeting', id: selectedMeeting.id })} leftIcon={<Trash2 className="w-3.5 h-3.5" />} className="border-red-200 text-red-600 hover:bg-red-50 text-xs px-3 py-1.5 rounded-lg">
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Day Click Popup */}
        {selectedDayDate && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedDayDate(null)} />
            <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-5 sm:p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-[#E3E8E3]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#27332B]">
                    {selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {getMeetingsForDay(selectedDayDate).length} meeting{getMeetingsForDay(selectedDayDate).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedDayDate(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {getMeetingsForDay(selectedDayDate).length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarIcon className="w-10 h-10 text-[#5E8C61] mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-[#6B7280]">No meetings scheduled</p>
                  <p className="text-xs text-[#9CA3AF] mt-1">Create a new meeting for this day</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {getMeetingsForDay(selectedDayDate).map((m) => (
                    <div
                      key={m.id}
                      onClick={() => { setSelectedMeeting(m); setSelectedDayDate(null); }}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer hover:shadow-sm transition-shadow',
                        STATUS_STYLES[m.status]
                      )}
                    >
                      {MEETING_TYPE_ICONS[m.meeting_type]}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{m.title}</div>
                        <div className="text-[10px] opacity-75">{formatTime(m.start_time)} – {formatTime(m.end_time)}</div>
                      </div>
                      {m.client && <span className="text-[10px] font-medium opacity-75">{m.client.name}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end border-t border-[#E3E8E3] pt-4">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => { openCreateMeeting(selectedDayDate); setSelectedDayDate(null); }}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-4 py-2 text-xs font-semibold rounded-xl"
                >
                  New Meeting
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Meeting Modal */}
        {isMeetingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsMeetingModalOpen(false)} />
            <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E3E8E3]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-5">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#27332B]">{editingMeeting ? 'Edit Meeting' : 'New Meeting'}</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">{editingMeeting ? 'Update meeting details' : 'Schedule a new meeting'}</p>
                </div>
                <button type="button" onClick={() => setIsMeetingModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMeeting} className="space-y-4">
                <Input
                  label="Meeting Title *"
                  placeholder="e.g. Q4 Review Meeting"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  required
                />

                {!isClientRole && (
                  <div>
                    <label className="block text-xs font-bold text-[#27332B] mb-1.5">Client *</label>
                    <select
                      value={meetingForm.client_id}
                      onChange={(e) => {
                        setMeetingForm({ ...meetingForm, client_id: e.target.value });
                        setSelectedRMUserId(null);
                      }}
                      className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                      required
                    >
                      <option value="">Select a client...</option>
                      {clientList.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Start Time *"
                    type="datetime-local"
                    value={meetingForm.start_time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, start_time: e.target.value })}
                    required
                  />
                  <Input
                    label="End Time *"
                    type="datetime-local"
                    value={meetingForm.end_time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, end_time: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#27332B] mb-1.5">Meeting Type</label>
                    <select
                      value={meetingForm.meeting_type}
                      onChange={(e) => setMeetingForm({ ...meetingForm, meeting_type: e.target.value })}
                      className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                    >
                      <option value="in_person">In Person</option>
                      <option value="video_call">Video Call</option>
                      <option value="phone_call">Phone Call</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#27332B] mb-1.5">Status</label>
                    <select
                      value={meetingForm.status}
                      onChange={(e) => setMeetingForm({ ...meetingForm, status: e.target.value })}
                      className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="rescheduled">Rescheduled</option>
                    </select>
                  </div>
                </div>

                <Input
                  label="Location"
                  placeholder="e.g. Conference Room A / Zoom link"
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                />

                <div>
                  <label className="block text-xs font-bold text-[#27332B] mb-1.5">Description</label>
                  <textarea
                    value={meetingForm.description}
                    onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61] resize-none"
                    placeholder="Meeting agenda or notes..."
                  />
                </div>

                {!isClientRole && (
                  <>
                    <ClientRMSelect
                      clientId={meetingForm.client_id || null}
                      selectedUserId={selectedRMUserId}
                      onChange={setSelectedRMUserId}
                    />

                    <MultiUserSelect
                      selectedIds={meetingForm.assignee_ids}
                      onChange={(ids) => setMeetingForm({ ...meetingForm, assignee_ids: ids })}
                      placeholder="Assign additional RMs..."
                    />
                  </>
                )}

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E3E8E3]">
                  <Button type="button" variant="outline" onClick={() => setIsMeetingModalOpen(false)} className="px-4 py-2 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmittingMeeting} className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-5 py-2 text-xs font-semibold">
                    {isSubmittingMeeting ? 'Creating...' : (editingMeeting ? 'Update Meeting' : 'Create Meeting')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit Note Modal */}
        {isNoteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsNoteModalOpen(false)} />
            <div className="relative z-10 bg-white rounded-t-[20px] sm:rounded-[20px] p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#E3E8E3]">
              <div className="flex items-center justify-between border-b border-[#E3E8E3] pb-4 mb-5">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#27332B]">{editingNote ? 'Edit Note' : 'New Note'}</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">{editingNote ? 'Update note details' : 'Create a linked note'}</p>
                </div>
                <button type="button" onClick={() => setIsNoteModalOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNote} className="space-y-4">
                <Input
                  label="Title *"
                  placeholder="e.g. Follow-up points from Q4 review"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  required
                />

                <div>
                  <label className="block text-xs font-bold text-[#27332B] mb-1.5">Content *</label>
                  <textarea
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    rows={5}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61] resize-none"
                    placeholder="Write your note here..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#27332B] mb-1.5">Link to Client</label>
                  <select
                    value={noteForm.client_id}
                    onChange={(e) => setNoteForm({ ...noteForm, client_id: e.target.value })}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                  >
                    <option value="">None</option>
                    {clientList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#27332B] mb-1.5">Link to Meeting</label>
                  <select
                    value={noteForm.meeting_id}
                    onChange={(e) => setNoteForm({ ...noteForm, meeting_id: e.target.value })}
                    className="w-full bg-[#F7F9F6] border border-[#E3E8E3] rounded-xl px-3 py-2 text-xs font-bold text-[#27332B] focus:outline-none focus:border-[#5E8C61]"
                  >
                    <option value="">None</option>
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id}>{m.title} ({formatDateShort(m.start_time)})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E3E8E3]">
                  <Button type="button" variant="outline" onClick={() => setIsNoteModalOpen(false)} className="px-4 py-2 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="bg-[#2F4F3A] hover:bg-[#243E2E] text-white px-5 py-2 text-xs font-semibold">
                    {editingNote ? 'Update Note' : 'Create Note'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.type === 'note' ? 'Delete this note?' : 'Delete this meeting?'}
        message={
          <>
            This {deleteTarget?.type === 'note' ? 'note' : 'meeting'} will be removed.
          </>
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'note') handleDeleteNote(deleteTarget.id);
          else handleDeleteMeeting(deleteTarget.id);
        }}
      />
      </div>
    </MainLayout>
  );
};
