export interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
  category: string;
  status: "not_started" | "in_progress" | "completed";
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: "female" | "male";
  description: string;
}

export interface TaikinRecord {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string;
  workMinutes: number;
  overtimeMinutes: number;
  breakMinutes?: number;
  isManual?: boolean;
  isEdited?: boolean;
  originalClockIn?: string;
  originalClockOut?: string;
  note?: string;
  createdAt?: number;
  updatedAt?: number;
}
