const API_BASE_URL =
    (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001';

function normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
}

export interface EmployeePreference {
    id: string;
    name: string;
    amount: string;
    currency: string;
}

export interface SchedulingConfig {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay: string;
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
    last_run_at?: string;
    next_run_at?: string;
    created_at: string;
    updated_at: string;
}

export async function fetchSchedules(organizationId: number): Promise<PayrollSchedule[]> {
    const response = await fetch(`${normalizeBaseUrl(API_BASE_URL)}/api/schedules`, {
        headers: {
            'x-organization-id': organizationId.toString(),
            'Authorization': `Bearer ${localStorage.getItem('token')}` // assuming token is in localStorage
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch schedules (${response.status})`);
    }

    return response.json();
}

export async function saveSchedule(
    organizationId: number,
    config: SchedulingConfig
): Promise<PayrollSchedule> {
    const response = await fetch(`${normalizeBaseUrl(API_BASE_URL)}/api/schedules`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-organization-id': organizationId.toString(),
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
    });

    if (!response.ok) {
        throw new Error(`Failed to save schedule (${response.status})`);
    }

    return response.json();
}

export async function cancelSchedule(
    organizationId: number,
    scheduleId: number
): Promise<{ message: string }> {
    const response = await fetch(`${normalizeBaseUrl(API_BASE_URL)}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
            'x-organization-id': organizationId.toString(),
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to cancel schedule (${response.status})`);
    }

    return response.json();
}
