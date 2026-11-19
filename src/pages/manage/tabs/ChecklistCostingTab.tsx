import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  History,
  FileSpreadsheet,
  Building,
  CreditCard,
  Check,
} from 'lucide-react';
import {
  fetchTasks,
  toggleTask,
  createTask,
  updateTask,
  deleteTask,
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchLogs,
} from '../api';
import {
  BoothTask,
  BoothExpense,
  ExpenseCategory,
  ActivityLog,
  BoothItem,
} from '../types';
import { Modal } from '../Modal';

interface ChecklistCostingTabProps {
  boothId: string;
  booth: BoothItem;
}

export function ChecklistCostingTab({ boothId, booth }: ChecklistCostingTabProps) {
  const [subTab, setSubTab] = useState<'checklist' | 'costing' | 'logs'>('checklist');

  // Checklist State
  const [tasks, setTasks] = useState<BoothTask[]>([]);
  const [totalTasks, setTotalTasks] = useState<number>(10);
  const [completedTasks, setCompletedTasks] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [tasksLoading, setTasksLoading] = useState<boolean>(true);
  const [tasksError, setTasksError] = useState<string>('');

  // Task Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<BoothTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<BoothTask | null>(null);
  const [taskName, setTaskName] = useState<string>('');
  const [taskPhase, setTaskPhase] = useState<string>('Site Execution');
  const [taskNotes, setTaskNotes] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskFormError, setTaskFormError] = useState<string>('');
  const [taskSubmitting, setTaskSubmitting] = useState<boolean>(false);

  // Costing State
  const [expenses, setExpenses] = useState<BoothExpense[]>([]);
  const [totalEstimated, setTotalEstimated] = useState<number>(0);
  const [totalActual, setTotalActual] = useState<number>(0);
  const [variance, setVariance] = useState<number>(0);
  const [costingLoading, setCostingLoading] = useState<boolean>(true);
  const [costingError, setCostingError] = useState<string>('');

  // Costing Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<BoothExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<BoothExpense | null>(null);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('structure');
  const [expDesc, setExpDesc] = useState<string>('');
  const [expEstimated, setExpEstimated] = useState<string>('0');
  const [expActual, setExpActual] = useState<string>('0');
  const [expVendor, setExpVendor] = useState<string>('');
  const [expStatus, setExpStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [expNotes, setExpNotes] = useState<string>('');
  const [expFormError, setExpFormError] = useState<string>('');
  const [expSubmitting, setExpSubmitting] = useState<boolean>(false);

  // Activity Logs State
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  // Load Tasks
  const loadTasksData = async () => {
    try {
      setTasksLoading(true);
      setTasksError('');
      const res = await fetchTasks(boothId);
      setTasks(res.tasks || []);
      setTotalTasks(res.total || 0);
      setCompletedTasks(res.completed || 0);
      setPercentage(res.percentage || 0);
    } catch (err: any) {
      setTasksError(err.message || 'Failed to load checklist tasks.');
    } finally {
      setTasksLoading(false);
    }
  };

  // Load Costing
  const loadCostingData = async () => {
    try {
      setCostingLoading(true);
      setCostingError('');
      const res = await fetchExpenses(boothId);
      setExpenses(res.expenses || []);
      setTotalEstimated(res.total_estimated || 0);
      setTotalActual(res.total_actual || 0);
      setVariance(res.variance || 0);
    } catch (err: any) {
      setCostingError(err.message || 'Failed to load booth expenses.');
    } finally {
      setCostingLoading(false);
    }
  };

  // Load Activity Logs
  const loadLogsData = async () => {
    try {
      setLogsLoading(true);
      const res = await fetchLogs(boothId);
      setLogs(res || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadTasksData();
    loadCostingData();
  }, [boothId]);

  useEffect(() => {
    if (subTab === 'logs') {
      loadLogsData();
    }
  }, [subTab, boothId]);

  // Handle Task Toggle
  const handleToggleTask = async (task: BoothTask) => {
    try {
      const res = await toggleTask(task.id);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
      setTotalTasks(res.total);
      setCompletedTasks(res.completed);
      setPercentage(res.percentage);
    } catch (err: any) {
      alert(err.message || 'Failed to update task.');
    }
  };

  // Task Form Handlers
  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskName('');
    setTaskPhase('Site Execution');
    setTaskNotes('');
    setTaskDueDate('');
    setTaskFormError('');
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (t: BoothTask) => {
    setEditingTask(t);
    setTaskName(t.task_name);
    setTaskPhase(t.phase || 'General');
    setTaskNotes(t.notes || '');
    setTaskDueDate(t.due_date || '');
    setTaskFormError('');
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) {
      setTaskFormError('Please enter a task name.');
      return;
    }
    setTaskSubmitting(true);
    setTaskFormError('');

    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          task_name: taskName.trim(),
          phase: taskPhase.trim() || undefined,
          notes: taskNotes.trim() || undefined,
          due_date: taskDueDate || undefined,
        });
      } else {
        await createTask({
          booth_id: boothId,
          task_name: taskName.trim(),
          phase: taskPhase.trim() || 'General Execution',
          notes: taskNotes.trim() || undefined,
          due_date: taskDueDate || undefined,
        });
      }
      setIsTaskModalOpen(false);
      await loadTasksData();
    } catch (err: any) {
      setTaskFormError(err.message || 'Failed to save task.');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleDeleteTaskConfirm = async () => {
    if (!deletingTask) return;
    try {
      setTaskSubmitting(true);
      await deleteTask(deletingTask.id);
      setDeletingTask(null);
      await loadTasksData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task.');
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Expense Form Handlers
  const openCreateExpenseModal = () => {
    setEditingExpense(null);
    setExpCategory('structure');
    setExpDesc('');
    setExpEstimated('0');
    setExpActual('0');
    setExpVendor('');
    setExpStatus('unpaid');
    setExpNotes('');
    setExpFormError('');
    setIsExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: BoothExpense) => {
    setEditingExpense(exp);
    setExpCategory(exp.category);
    setExpDesc(exp.description);
    setExpEstimated(String(exp.estimated_cost ?? 0));
    setExpActual(String(exp.actual_cost ?? 0));
    setExpVendor(exp.vendor_name || '');
    setExpStatus(exp.payment_status);
    setExpNotes(exp.notes || '');
    setExpFormError('');
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim()) {
      setExpFormError('Please enter an expense description.');
      return;
    }
    const est = parseFloat(expEstimated);
    const act = parseFloat(expActual);
    if (isNaN(est) || est < 0 || isNaN(act) || act < 0) {
      setExpFormError('Costs must be valid non-negative numbers.');
      return;
    }

    setExpSubmitting(true);
    setExpFormError('');

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          category: expCategory,
          description: expDesc.trim(),
          estimated_cost: est,
          actual_cost: act,
          vendor_name: expVendor.trim() || undefined,
          payment_status: expStatus,
          notes: expNotes.trim() || undefined,
        });
      } else {
        await createExpense({
          booth_id: boothId,
          category: expCategory,
          description: expDesc.trim(),
          estimated_cost: est,
          actual_cost: act,
          vendor_name: expVendor.trim() || undefined,
          payment_status: expStatus,
          notes: expNotes.trim() || undefined,
        });
      }
      setIsExpenseModalOpen(false);
      await loadCostingData();
    } catch (err: any) {
      setExpFormError(err.message || 'Failed to save expense.');
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleDeleteExpenseConfirm = async () => {
    if (!deletingExpense) return;
    try {
      setExpSubmitting(true);
      await deleteExpense(deletingExpense.id);
      setDeletingExpense(null);
      await loadCostingData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    } finally {
      setExpSubmitting(false);
    }
  };

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'pending') return t.is_completed === 0;
    if (taskFilter === 'completed') return t.is_completed === 1;
    return true;
  });

  const quotedAmount = booth.quoted_amount || 0;
  const grossProfit = quotedAmount > 0 ? quotedAmount - totalActual : 0;
  const marginPct = quotedAmount > 0 ? Math.round((grossProfit / quotedAmount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Sub-navigation Pills */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('checklist')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === 'checklist'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>10-Step Execution Checklist</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
              {percentage}%
            </span>
          </button>

          <button
            onClick={() => setSubTab('costing')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === 'costing'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Costing & P&L Expenses</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
              ₹{totalActual.toLocaleString('en-IN')}
            </span>
          </button>

          <button
            onClick={() => setSubTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === 'logs'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Activity Audit Trail</span>
          </button>
        </div>

        {subTab === 'checklist' && (
          <button
            onClick={openCreateTaskModal}
            className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Task</span>
          </button>
        )}

        {subTab === 'costing' && (
          <button
            onClick={openCreateExpenseModal}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/10 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense Line</span>
          </button>
        )}
      </div>

      {/* SUBTAB 1: CHECKLIST */}
      {subTab === 'checklist' && (
        <div className="space-y-5">
          {/* Progress Card */}
          <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  Booth Execution Readiness
                  {percentage === 100 && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      100% Handover Complete
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Standard 10-step milestones required for stall handover and sign-off.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold font-mono text-amber-400">
                  {completedTasks}
                  <span className="text-zinc-600 text-sm"> / {totalTasks}</span>
                </span>
                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {percentage}% Done
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  percentage === 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400'
                }`}
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setTaskFilter('all')}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  taskFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All Tasks ({totalTasks})
              </button>
              <button
                onClick={() => setTaskFilter('pending')}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  taskFilter === 'pending'
                    ? 'bg-zinc-800 text-amber-400 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Pending ({totalTasks - completedTasks})
              </button>
              <button
                onClick={() => setTaskFilter('completed')}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  taskFilter === 'completed'
                    ? 'bg-zinc-800 text-emerald-400 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Completed ({completedTasks})
              </button>
            </div>
          </div>

          {tasksError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{tasksError}</span>
            </div>
          )}

          {tasksLoading ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Loading checklist tasks...
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden divide-y divide-zinc-800/60">
              {filteredTasks.map((task, idx) => {
                const isDone = task.is_completed === 1;

                return (
                  <div
                    key={task.id}
                    className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                      isDone ? 'bg-zinc-950/30' : 'hover:bg-zinc-800/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleTask(task)}
                        className={`mt-0.5 p-1 rounded-lg transition-colors shrink-0 ${
                          isDone
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                        title={isDone ? 'Mark Incomplete' : 'Mark Completed'}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              isDone ? 'text-zinc-400 line-through' : 'text-zinc-100'
                            }`}
                          >
                            {task.task_name}
                          </span>
                          {task.phase && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono">
                              {task.phase}
                            </span>
                          )}
                        </div>

                        {task.notes && (
                          <p className="text-[11px] text-zinc-500">{task.notes}</p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 pt-0.5">
                          {isDone && task.completed_at && (
                            <span className="text-emerald-400/90 flex items-center gap-1 font-mono">
                              <Check className="w-3 h-3" />
                              Completed {new Date(task.completed_at).toLocaleDateString()} by {task.completed_by || 'Master'}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              Due: {task.due_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditTaskModal(task)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Edit task"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingTask(task)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: COSTING & EXPENSES */}
      {subTab === 'costing' && (
        <div className="space-y-5">
          {/* Financial KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Client Quoted Amount</span>
              <p className="text-xl font-bold font-mono text-zinc-100 mt-1">
                {quotedAmount > 0 ? `₹ ${quotedAmount.toLocaleString('en-IN')}` : '—'}
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Estimated Cost</span>
              <p className="text-xl font-bold font-mono text-zinc-300 mt-1">
                ₹ {totalEstimated.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Actual Expenses</span>
              <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                ₹ {totalActual.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Cost Variance / Overrun</span>
              <div className="flex items-center gap-1.5 mt-1">
                {variance > 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                )}
                <p
                  className={`text-xl font-bold font-mono ${
                    variance > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {variance > 0 ? `+₹ ${variance.toLocaleString('en-IN')}` : `₹ ${variance.toLocaleString('en-IN')}`}
                </p>
              </div>
            </div>
          </div>

          {/* Profitability Ribbon */}
          {quotedAmount > 0 && (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                Gross Operational Margin: <strong className="text-zinc-100 font-mono">₹ {grossProfit.toLocaleString('en-IN')}</strong>
              </span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                  marginPct >= 25
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                {marginPct}% Margin
              </span>
            </div>
          )}

          {costingError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{costingError}</span>
            </div>
          )}

          {/* Expenses Table */}
          {costingLoading ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Loading expense records...
            </div>
          ) : expenses.length === 0 ? (
            <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center space-y-3">
              <DollarSign className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-sm font-semibold text-zinc-300">No Expenses Recorded</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Track fabrication, print, electrical, transport, and labor costs for accurate booth P&L.
              </p>
              <button
                onClick={openCreateExpenseModal}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add First Expense
              </button>
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800/80">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Category & Description</th>
                      <th className="py-3 px-4 font-semibold text-right">Estimated</th>
                      <th className="py-3 px-4 font-semibold text-right">Actual</th>
                      <th className="py-3 px-4 font-semibold text-right">Diff</th>
                      <th className="py-3 px-4 font-semibold">Vendor / Supplier</th>
                      <th className="py-3 px-4 font-semibold text-center">Payment</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {expenses.map((exp) => {
                      const est = exp.estimated_cost ?? 0;
                      const act = exp.actual_cost ?? 0;
                      const diff = act - est;

                      return (
                        <tr key={exp.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                                {exp.category}
                              </span>
                              <span className="font-semibold text-zinc-100">{exp.description}</span>
                            </div>
                            {exp.notes && (
                              <p className="text-[11px] text-zinc-500 mt-0.5 ml-1">
                                {exp.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-400">
                            ₹ {est.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                            ₹ {act.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs">
                            <span
                              className={
                                diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-zinc-500'
                              }
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-400">
                            {exp.vendor_name || '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                                exp.payment_status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : exp.payment_status === 'partial'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                              }`}
                            >
                              {exp.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditExpenseModal(exp)}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingExpense(exp)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ACTIVITY AUDIT LOGS */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              Activity Audit Trail
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Immutable server-recorded events for this booth (status updates, link approvals, checklist actions, and expenses).
            </p>
          </div>

          {logsLoading ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Loading activity logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-12 text-center text-xs text-zinc-500">
              No activity recorded for this stall yet.
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden divide-y divide-zinc-800/60">
              {logs.map((log) => (
                <div key={log.id} className="p-3.5 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700/60">
                        {log.action_type.replace('_', ' ')}
                      </span>
                      <span className="text-zinc-200 font-medium">{log.description}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Add Custom Task'}
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
          {taskFormError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{taskFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Task Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Confirm VIP delegate pass clearance"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Execution Phase</label>
              <select
                value={taskPhase}
                onChange={(e) => setTaskPhase(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="Pre-Production">Pre-Production</option>
                <option value="Production & Sourcing">Production & Sourcing</option>
                <option value="Site Execution">Site Execution</option>
                <option value="Handover & Sign-off">Handover & Sign-off</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Due Date</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Contact venue hall supervisor at Gate 3"
              value={taskNotes}
              onChange={(e) => setTaskNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={taskSubmitting}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {taskSubmitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Task Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        title="Confirm Task Deletion"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to remove <span className="font-semibold text-zinc-100">{deletingTask?.task_name}</span>?
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setDeletingTask(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={taskSubmitting}
              onClick={handleDeleteTaskConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {taskSubmitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? 'Edit Expense Item' : 'Add Expense Item'}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
          {expFormError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{expFormError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">
                Category <span className="text-amber-500">*</span>
              </label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="structure">Structure & Fabrication</option>
                <option value="printing">Printing & Graphics</option>
                <option value="furniture">Furniture Rental</option>
                <option value="electrical">Electrical & Lighting</option>
                <option value="transport">Transport & Logistics</option>
                <option value="labor">Carpentry & Labor</option>
                <option value="other">Miscellaneous / Other</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Payment Status</label>
              <select
                value={expStatus}
                onChange={(e) => setExpStatus(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial Advance</option>
                <option value="paid">Fully Paid</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">
              Description <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. UV Backlit Fabric Prints for 3x3m Booth"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Estimated Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={expEstimated}
                onChange={(e) => setExpEstimated(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60 font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-300 font-medium mb-1">Actual Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={expActual}
                onChange={(e) => setExpActual(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Vendor / Contractor</label>
            <input
              type="text"
              placeholder="e.g. Apex Printworks Pvt Ltd"
              value={expVendor}
              onChange={(e) => setExpVendor(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-zinc-300 font-medium mb-1">Notes / Bill Reference</label>
            <textarea
              rows={2}
              placeholder="e.g. Bill #1043, 50% paid via NEFT"
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={expSubmitting}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {expSubmitting ? 'Saving...' : editingExpense ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Expense Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        title="Confirm Expense Deletion"
      >
        <div className="space-y-4 text-xs">
          <p className="text-zinc-300">
            Are you sure you want to remove <span className="font-semibold text-zinc-100">{deletingExpense?.description}</span>?
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setDeletingExpense(null)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={expSubmitting}
              onClick={handleDeleteExpenseConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {expSubmitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
