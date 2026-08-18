'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useRequireRole } from '@/hooks/useRequireRole';

import { motion } from 'framer-motion';
import { ClipboardList, Plus, Pencil, Trash2, CheckCircle2, Circle, RefreshCw, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useApiGet, useApiPost, useApiPut, useApiPatch, useApiDelete } from '@/hooks/useApi';
import { TableSkeleton, EmptyState, ErrorState, PageHeader } from '@/components/tables/data-table';
import { cn } from '@/lib/utils';

interface ProgressRow {
  id: string;
  name: string;
  email: string;
  department: string | null;
  total: number;
  completed: number;
  progress: number | null;
}

interface Assignment {
  id: string;
  employeeId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  notes: string;
  task: { id: string; name: string; description: string; category: string; isRequired: boolean; orderIndex: number };
}

interface TemplateTask {
  id: string;
  name: string;
  description: string;
  category: string;
  isRequired: boolean;
  orderIndex: number;
  active: boolean;
  _count: { assignments: number };
}

const statusVariant: Record<Assignment['status'], any> = { PENDING: 'outline', IN_PROGRESS: 'warning', COMPLETED: 'success' };
const statusLabel: Record<Assignment['status'], string> = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed' };

const emptyTaskForm = { name: '', description: '', category: 'General', isRequired: true };

export default function OnboardingPage() {
  useRequireRole(['Admin', 'HR']);
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<'checklists' | 'templates'>('checklists');
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TemplateTask | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const key = ['onboarding-progress'];
  const assignmentKey = ['onboarding-assignments', selectedId];
  const tasksKey = ['onboarding-tasks'];

  const { data: progress, isLoading, error, refetch } = useApiGet<ProgressRow[]>(key, '/onboarding/progress');
  const { data: assignments } = useApiGet<Assignment[]>(assignmentKey, selectedId ? `/onboarding/assignments?employeeId=${selectedId}` : null);
  const { data: tasks } = useApiGet<TemplateTask[]>(tasksKey, '/onboarding/tasks');

  const createTask = useApiPost<any>([tasksKey, ['onboarding-generate']]);
  const updateTask = useApiPut<any>([tasksKey]);
  const removeTask = useApiDelete([tasksKey]);
  const setStatus = useApiPatch<any>([assignmentKey, key]);
  const generate = useApiPost<any>([assignmentKey, key]);

  const selected = progress?.find((p) => p.id === selectedId) || null;

  const saveTask = async () => {
    if (!taskForm.name.trim()) {
      addToast(t('Title is required'), 'error');
      return;
    }
    try {
      if (editingTask) {
        await updateTask.mutateAsync({ endpoint: `/onboarding/tasks/${editingTask.id}`, data: taskForm });
        addToast(t('Task updated'));
      } else {
        await createTask.mutateAsync({ endpoint: '/onboarding/tasks', data: taskForm });
        addToast(t('Task created'));
      }
      setTaskDialog(false);
    } catch {
      addToast(t('Save failed'), 'error');
    }
  };

  const changeStatus = async (assignment: Assignment, status: Assignment['status']) => {
    try {
      await setStatus.mutateAsync({ endpoint: `/onboarding/assignments/${assignment.id}/status`, data: { status } });
      addToast(t('Stage updated'));
    } catch {
      addToast(t('Action failed'), 'error');
    }
  };

  const generateForSelected = async () => {
    if (!selectedId) return;
    try {
      const res = await generate.mutateAsync({ endpoint: `/onboarding/assignments/generate/${selectedId}`, data: {} });
      addToast((res as any)?.created ? t('Checklist generated') : t('Checklist up to date'));
      refetch();
    } catch {
      addToast(t('Action failed'), 'error');
    }
  };

  const openTaskForm = (task?: TemplateTask) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({ name: task.name, description: task.description, category: task.category, isRequired: task.isRequired });
    } else {
      setEditingTask(null);
      setTaskForm(emptyTaskForm);
    }
    setTaskDialog(true);
  };

  const tabBtn = (key: 'checklists' | 'templates', label: string) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Onboarding')}
        description={t('Checklists for new and existing employees')}
        actions={
          tab === 'templates'
            ? <Button onClick={() => openTaskForm()}>{t('New Task')}</Button>
            : undefined
        }
      />

      <div className="flex gap-1 rounded-xl border p-1 w-fit">
        {tabBtn('checklists', t('Checklists'))}
        {tabBtn('templates', t('Templates'))}
      </div>

      {tab === 'checklists' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('Employee Progress')}</CardTitle>
              <CardDescription>{t('Select an employee to view their checklist')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="max-w-xs">
                  <option value="">{t('Select employee')}</option>
                  {(progress || []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.progress === null ? t('No checklist') : `${p.progress}%`}</option>
                  ))}
                </Select>
                <Button variant="outline" onClick={generateForSelected} disabled={!selectedId}>
                  <RefreshCw className="h-4 w-4" />{t('Generate Checklist')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
                <CardDescription>
                  {selected.progress === null
                    ? t('No checklist generated yet')
                    : t('Completed') + ` ${selected.completed}/${selected.total}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${selected.progress ?? 0}%` }}
                  />
                </div>
                {!assignments || assignments.length === 0 ? (
                  <EmptyState icon={ClipboardList} title={t('No checklist yet')} description={t('Generate a checklist for this employee')} />
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className={cn(a.status === 'COMPLETED' && 'bg-muted/40')}>
                          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {a.status === 'COMPLETED'
                                ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                                : <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />}
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={cn('font-medium', a.status === 'COMPLETED' && 'line-through text-muted-foreground')}>{a.task.name}</p>
                                  {a.task.isRequired && <Badge variant="outline">{t('Required')}</Badge>}
                                  <Badge variant="secondary">{a.task.category}</Badge>
                                </div>
                                {a.task.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.task.description}</p>}
                              </div>
                            </div>
                            <Select className="h-8 w-[150px] text-xs" value={a.status} onChange={(e) => changeStatus(a, e.target.value as Assignment['status'])}>
                              {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
                                <option key={s} value={s}>{t(statusLabel[s])}</option>
                              ))}
                            </Select>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === 'templates' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('Checklist Templates')}</CardTitle>
            <CardDescription>{t('Tasks are assigned to employees when their checklist is generated')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!tasks || tasks.length === 0 ? (
              <EmptyState icon={ListChecks} title={t('No tasks yet')} description={t('Create a template task to get started')} />
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{task.name}</p>
                            {task.isRequired && <Badge variant="outline">{t('Required')}</Badge>}
                            <Badge variant="secondary">{task.category}</Badge>
                            <span className="text-xs text-muted-foreground">{task._count.assignments} {t('assigned')}</span>
                          </div>
                          {task.description && <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openTaskForm(task)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTaskId(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogHeader>
          <DialogTitle>{editingTask ? t('Edit Task') : t('New Task')}</DialogTitle>
          <DialogDescription>{t('Template task details')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>{t('Task Name')}</Label>
            <Input value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('Category')}</Label>
            <Input value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })} placeholder={t('e.g. IT, HR, Legal')} />
          </div>
          <div className="space-y-2">
            <Label>{t('Description')}</Label>
            <Textarea rows={2} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={taskForm.isRequired} onChange={(e) => setTaskForm({ ...taskForm, isRequired: e.target.checked })} className="h-4 w-4 rounded border-input" />
            {t('Required task')}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTaskDialog(false)}>{t('Cancel')}</Button>
          <Button onClick={saveTask}>{t('Save')}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={!!deleteTaskId} onOpenChange={(o) => !o && setDeleteTaskId(null)}>
        <DialogHeader>
          <DialogTitle>{t('Delete Task')}</DialogTitle>
          <DialogDescription>{t('Existing assignments are kept, but new checklists will not include this task')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTaskId(null)}>{t('Cancel')}</Button>
          <Button variant="destructive" onClick={() => removeTask.mutateAsync(`/onboarding/tasks/${deleteTaskId}`).then(() => { addToast(t('Task deleted')); setDeleteTaskId(null); }).catch(() => addToast(t('Delete failed'), 'error'))}>{t('Delete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
