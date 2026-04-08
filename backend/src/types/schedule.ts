export interface EmployeePreference {
    id: string;
    name: string;
    amount: string;
    currency: string;
}

export interface SchedulingConfig {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
    timeOfDay: string; // HH:mm format
    preferences: EmployeePreference[];
}

export interface PayrollSchedule {
    id: number;
    organization_id: number;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    day_of_week?: number;
    day_of_month?: number;
    time_of_day: string;
    config: SchedulingConfig;
    status: 'active' | 'paused' | 'cancelled';
    last_run_at?: Date;
    next_run_at?: Date;
    created_at: Date;
    updated_at: Date;
}
