import React, { useEffect, useState } from 'react';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { useAutosave } from '../hooks/useAutosave';
import { useTransactionSimulation } from '../hooks/useTransactionSimulation';
import { TransactionSimulationPanel } from '../components/TransactionSimulationPanel';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { createClaimableBalanceTransaction } from '../services/stellar';
import { useTranslation } from 'react-i18next';
import { Card, Heading, Text, Button, Input, Select } from '@stellar/design-system';
import {
  fetchSchedules,
  saveSchedule,
  cancelSchedule,
  PayrollSchedule,
  SchedulingConfig,
} from '../services/payrollScheduler';
import { SchedulingWizard } from '../components/SchedulingWizard';
import { CountdownTimer } from '../components/CountdownTimer';
import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: 'weekly' | 'monthly';
  startDate: string;
  memo?: string;
}

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface PendingClaim {
  id: string;
  employeeName: string;
  amount: string;
  dateScheduled: string;
  claimantPublicKey: string;
  status: string;
}

const initialFormState: PayrollFormState = {
  employeeName: '',
  amount: '',
  frequency: 'monthly',
  startDate: '',
  memo: '',
};

export default function PayrollScheduler() {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();
  const { unsubscribeFromTransaction } = useSocket();
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState<PayrollSchedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);

  const organizationId = 1;

  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>(() => {
    const saved = localStorage.getItem('pending-claims');
    if (saved) {
      try {
        return JSON.parse(saved) as PendingClaim[];
      } catch {
        return [];
      }
    }
    return [];
  });

  const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
    'payroll-scheduler-draft',
    formData
  );

  const {
    simulate,
    resetSimulation,
    isSimulating,
    result: simulationResult,
    error: simulationProcessError,
    isSuccess: simulationPassed,
  } = useTransactionSimulation();

  useEffect(() => {
    const saved = loadSavedData();
    if (saved) {
      setFormData(saved);
    }
    void refreshSchedules();
  }, [loadSavedData]);

  const refreshSchedules = async () => {
    setIsLoadingSchedules(true);
    try {
      const data = await fetchSchedules(organizationId);
      setActiveSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const handleScheduleComplete = async (config: SchedulingConfig) => {
    try {
      await saveSchedule(organizationId, config);
      setIsWizardOpen(false);
      notifySuccess('Payroll schedule saved!', 'Configuration persisted and automation active.');
      void refreshSchedules();
    } catch (err: any) {
      notifyError('Failed to save schedule', err.message);
    }
  };

  const handleCancelAction = async (scheduleId: number) => {
    try {
      await cancelSchedule(organizationId, scheduleId);
      notifySuccess('Schedule cancelled', 'Automation has been disabled.');
      void refreshSchedules();
    } catch (err: any) {
      notifyError('Failed to cancel schedule', err.message);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInitialize = async () => {
    if (!formData.amount || isNaN(Number(formData.amount))) {
      notifyError('Invalid amount', 'Please enter a valid numeric value.');
      return;
    }

    try {
      const mockRecipientPublicKey = 'GBX3X...';
      const xdrResult = await createClaimableBalanceTransaction(
        '',
        mockRecipientPublicKey,
        formData.amount,
        'USDC'
      );
      void simulate({ envelopeXdr: xdrResult });
    } catch (err: any) {
      notifyError('Simulation failed', err.message);
    }
  };

  const handleBroadcast = async () => {
    setIsBroadcasting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      notifySuccess('Transaction Broadcasted', 'Payroll distribution initiated successfully.');
      resetSimulation();
      setFormData(initialFormState);
    } catch (err) {
      console.error(err);
      notifyError('Broadcast failed', 'Please check your network connection and try again.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleRemoveClaim = (id: string) => {
    unsubscribeFromTransaction(id);
    const updatedClaims = pendingClaims.filter((c) => c.id !== id);
    setPendingClaims(updatedClaims);
    localStorage.setItem('pending-claims', JSON.stringify(updatedClaims));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <Heading as="h1" size="lg" weight="bold" addlClassName="mb-2 tracking-tight">
            {t('payroll.title', 'Workforce')}{' '}
            <span className="text-accent">{t('payroll.titleHighlight', 'Scheduler')}</span>
          </Heading>
          <Text
            as="p"
            size="sm"
            weight="regular"
            addlClassName="text-muted font-mono tracking-wider uppercase"
          >
            {t('payroll.subtitle', 'Automated distribution engine')}
          </Text>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
          <button
            className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg text-accent hover:bg-accent/20 transition-all font-bold text-xs uppercase tracking-widest"
            onClick={() => setIsWizardOpen(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Setup Auto-Payroll
          </button>
        </div>
      </div>

      {activeSchedules.length > 0 && (
        <div className="w-full mb-12 flex flex-col gap-6">
          <Heading as="h2" size="sm" weight="bold">Active Schedules</Heading>
          {activeSchedules.map(schedule => (
            <div key={schedule.id} className="w-full bg-black/20 border border-success/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
              <div>
                <h3 className="text-success font-black text-lg mb-1 flex items-center gap-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Automation Active
                </h3>
                <p className="text-muted text-sm">
                  Scheduled <span className="font-bold text-text capitalize">{schedule.frequency}</span> at{' '}
                  <span className="font-mono text-text">{schedule.time_of_day}</span>
                </p>
                <div className="mt-4">
                  <Button variant="secondary" size="xs" onClick={() => handleCancelAction(schedule.id)}>
                    Cancel Schedule
                  </Button>
                </div>
              </div>
              <div className="bg-bg border border-hi rounded-xl p-4 shadow-inner">
                <span className="block text-[10px] uppercase font-bold text-muted mb-2 tracking-widest text-center">
                  Next Scheduled Run
                </span>
                <CountdownTimer targetDate={schedule.next_run_at ? new Date(schedule.next_run_at) : null} />
                {schedule.last_run_at && (
                  <span className="block text-[10px] text-muted mt-2 text-center">
                    Last run: {formatDate(schedule.last_run_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isWizardOpen ? (
        <SchedulingWizard
          onComplete={handleScheduleComplete}
          onCancel={() => setIsWizardOpen(false)}
        />
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
          {/* Manual Run Form */}
          <div className="lg:col-span-3">
            <form
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault();
                void handleInitialize();
              }}
              className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 card glass noise"
            >
              <div className="md:col-span-2">
                <Heading as="h3" size="xs" weight="bold">Manual Payroll Run</Heading>
                <Text size="xs" addlClassName="text-muted">Initiate a one-time distribution</Text>
              </div>
              <div className="md:col-span-2">
                <Input
                  id="employeeName"
                  fieldSize="md"
                  label={t('payroll.employeeName', 'Employee Name')}
                  name="employeeName"
                  value={formData.employeeName}
                  onChange={handleChange}
                  placeholder="e.g. Satoshi Nakamoto"
                />
              </div>

              <div>
                <Input
                  id="amount"
                  fieldSize="md"
                  label={t('payroll.amountLabel', 'Amount (USD equivalent)')}
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Select
                  id="frequency"
                  fieldSize="md"
                  label={t('payroll.distributionFrequency', 'Distribution Frequency')}
                  name="frequency"
                  value={formData.frequency}
                  onChange={handleChange}
                >
                  <option value="weekly">{t('payroll.frequencyWeekly', 'Weekly')}</option>
                  <option value="monthly">{t('payroll.frequencyMonthly', 'Monthly')}</option>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Input
                  id="startDate"
                  fieldSize="md"
                  label={t('payroll.commencementDate', 'Commencement Date')}
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleChange}
                />
              </div>

              <div className="md:col-span-2 pt-4">
                {!simulationPassed ? (
                  <Button
                    type="submit"
                    disabled={isSimulating}
                    variant="primary"
                    size="md"
                    isFullWidth
                  >
                    {isSimulating
                      ? 'Simulating...'
                      : t('payroll.submit', 'Initialize and Validate')}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      void handleBroadcast();
                    }}
                    disabled={isBroadcasting}
                    variant="primary"
                    size="md"
                    isFullWidth
                  >
                    {isBroadcasting ? 'Broadcasting...' : 'Confirm & Broadcast to Network'}
                  </Button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <TransactionSimulationPanel
              result={simulationResult}
              isSimulating={isSimulating}
              processError={simulationProcessError}
              onReset={resetSimulation}
            />

            <div className="card glass noise h-fit">
              <Heading as="h3" size="xs" weight="bold" addlClassName="mb-4 flex items-center gap-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Pre-flight Validation
              </Heading>
              <Text
                as="p"
                size="xs"
                weight="regular"
                addlClassName="text-muted leading-relaxed mb-4"
              >
                All transactions are simulated via Stellar Horizon before submission.
              </Text>
            </div>
          </div>
        </div>
      )}

      <div className="w-full">
        <BulkPaymentStatusTracker organizationId={1} />
      </div>
    </div>
  );
}
