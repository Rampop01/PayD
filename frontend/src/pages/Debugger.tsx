import { useParams } from "react-router-dom";

export default function Debugger() {
    const { contractName } = useParams<{ contractName?: string }>();

    return (
        <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-6xl mx-auto w-full">
            <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
                <div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight">Contract <span className="text-accent2">Debugger</span></h1>
                    <p className="text-muted font-mono text-sm tracking-wider uppercase">Direct ledger interaction portal</p>
                </div>
                {contractName && (
                    <div className="px-4 py-2 glass border-hi text-accent2 font-mono text-xs rounded-lg">
                        TARGET: {contractName}
                    </div>
                )}
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="card glass noise h-fit">
                        <h3 className="text-lg font-bold mb-4">Network Status</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted text-xs uppercase font-bold tracking-widest">Protocol</span>
                                <span className="text-text font-mono text-sm">v21</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted text-xs uppercase font-bold tracking-widest">Horizon</span>
                                <span className="text-success font-mono text-sm">Online</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted text-xs uppercase font-bold tracking-widest">Latency</span>
                                <span className="text-text font-mono text-sm">1.2s</span>
                            </div>
                        </div>
                    </div>

                    <div className="card glass noise h-fit">
                        <h3 className="text-lg font-bold mb-4">Available Tools</h3>
                        <div className="flex flex-col gap-2">
                            <button className="text-left p-3 rounded-lg hover:bg-white/5 transition-all text-sm font-medium border border-transparent hover:border-border-hi">XDR Inspector</button>
                            <button className="text-left p-3 rounded-lg hover:bg-white/5 transition-all text-sm font-medium border border-transparent hover:border-border-hi">Auth Simulator</button>
                            <button className="text-left p-3 rounded-lg hover:bg-white/5 transition-all text-sm font-medium border border-transparent hover:border-border-hi">Event Stream</button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="card glass noise min-h-100 flex flex-col items-center justify-center text-center p-12">
                        <div className="w-16 h-16 rounded-2xl bg-accent2/10 flex items-center justify-center mb-6 border border-accent2/20">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent2">
                                <polyline points="16 18 22 12 16 6" />
                                <polyline points="8 6 2 12 8 18" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-3">No active trace</h2>
                        <p className="text-muted max-w-md">Initialize a contract debug session to view live traces, state updates, and emission logs.</p>
                        <button className="mt-8 px-6 py-3 bg-accent2 text-bg font-bold rounded-xl hover:scale-105 transition-transform">
                            Connect Contract
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
