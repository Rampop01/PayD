import React, { useEffect, useState } from "react";
import { AutosaveIndicator } from "../components/AutosaveIndicator";
import { useAutosave } from "../hooks/useAutosave";
import { useTransactionSimulation } from "../hooks/useTransactionSimulation";
import { TransactionSimulationPanel } from "../components/TransactionSimulationPanel";
import { useNotification } from "../providers/NotificationProvider";

interface PayrollFormState {
    employeeName: string;
    amount: string;
    frequency: "weekly" | "monthly";
    startDate: string;
    memo?: string;
}

const initialFormState: PayrollFormState = {
    employeeName: "",
    amount: "",
    frequency: "monthly",
    startDate: "",
    memo: "",
};

export default function PayrollScheduler() {
    const { notify } = useNotification();
    const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
        "payroll-scheduler-draft",
        formData
    );

    const {
        simulate,
        resetSimulation,
        isSimulating,
        result: simulationResult,
        error: simulationProcessError,
        isSuccess: simulationPassed
    } = useTransactionSimulation();

    useEffect(() => {
        const saved = loadSavedData();
        if (saved) {
            setFormData(saved);
        }
    }, [loadSavedData]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Reset simulation if form changes
        if (simulationResult) resetSimulation();
    };

    /**
     * Step 1: Initialize & Simulate
     */
    const handleInitialize = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employeeName || !formData.amount) {
            notify("Please fill in all required fields.");
            return;
        }

        // Mock XDR for simulation demonstration
        // In a real app, this would be built using the Stellar SDK from formData
        const mockXdr = "AAAAAgAAAABmF8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        await simulate({ envelopeXdr: mockXdr });
    };

    /**
     * Step 2: Final Broadcast (only available if simulation passes)
     */
    const handleBroadcast = async () => {
        setIsBroadcasting(true);
        try {
            // Simulate a brief delay for network broadcast
            await new Promise(resolve => setTimeout(resolve, 1500));
            notify("Payroll stream successfully broadcasted to Stellar network!");
            resetSimulation();
            setFormData(initialFormState);
        } catch (err) {
            notify("Broadcast failed. Please check your connection.");
        } finally {
            setIsBroadcasting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-4xl mx-auto w-full">
            <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
                <div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight">Payroll <span className="text-accent">Scheduler</span></h1>
                    <p className="text-muted font-mono text-sm tracking-wider uppercase">Automated distribution engine</p>
                </div>
                <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-3">
                    <form onSubmit={handleInitialize} className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 card glass noise">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Employee Name
                            </label>
                            <input
                                type="text"
                                name="employeeName"
                                value={formData.employeeName}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-medium"
                                placeholder="e.g. Satoshi Nakamoto"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Amount (USD equivalent)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono">$</span>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    className="w-full bg-black/20 border border-hi rounded-xl p-4 pl-8 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Distribution Frequency
                            </label>
                            <select
                                name="frequency"
                                value={formData.frequency}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all appearance-none cursor-pointer"
                            >
                                <option value="weekly" className="bg-surface">Weekly</option>
                                <option value="monthly" className="bg-surface">Monthly</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Commencement Date
                            </label>
                            <input
                                type="date"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                                Transaction Memo (Optional)
                            </label>
                            <textarea
                                name="memo"
                                value={formData.memo}
                                onChange={handleChange}
                                className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-medium resize-none h-24"
                                placeholder="e.g. Feb 2026 Salary"
                            />
                        </div>

                        <div className="md:col-span-2 pt-4">
                            {!simulationPassed ? (
                                <button
                                    type="submit"
                                    disabled={isSimulating}
                                    className="w-full py-4 bg-accent text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-accent/10 uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                                >
                                    {isSimulating ? "Simulating..." : "Initialize and Validate"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleBroadcast}
                                    disabled={isBroadcasting}
                                    className="w-full py-4 bg-success text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-success/10 uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                                >
                                    {isBroadcasting ? "Broadcasting..." : "Confirm & Broadcast to Network"}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Simulation & Info Side Panel */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <TransactionSimulationPanel
                        result={simulationResult}
                        isSimulating={isSimulating}
                        processError={simulationProcessError}
                        onReset={resetSimulation}
                    />

                    <div className="card glass noise h-fit">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            Pre-flight Validation
                        </h3>
                        <p className="text-xs text-muted leading-relaxed mb-4">
                            All transactions are simulated via Stellar Horizon before submission. This catches common errors like:
                        </p>
                        <ul className="text-xs text-muted space-y-2 list-disc pl-4 font-medium">
                            <li>Insufficient XLM balance for fees</li>
                            <li>Invalid sequence numbers</li>
                            <li>Missing trustlines for tokens</li>
                            <li>Account eligibility status</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

