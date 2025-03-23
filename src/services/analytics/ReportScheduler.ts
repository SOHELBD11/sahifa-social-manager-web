import { ExportService } from './ExportService';
import { EmailAnalytics } from '@/services/notifications/EmailAnalytics';
import { NotificationService } from '@/services/notifications/NotificationService';
import { ReportSchedulerDB } from './ReportSchedulerDB';

export interface ReportSchedule {
  id: string;
  userId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly reports
  dayOfMonth?: number; // 1-31 for monthly reports
  time: string; // HH:mm in 24-hour format
  format: 'csv' | 'json';
  recipients: string[];
  includeMetrics: boolean;
  includeAlerts: boolean;
  includePlatformData: boolean;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export class ReportScheduler {
  private static schedules: Map<string, NodeJS.Timeout> = new Map();

  private static calculateNextRun(schedule: ReportSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    let next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    switch (schedule.frequency) {
      case 'daily':
        break;
      case 'weekly':
        while (next.getDay() !== schedule.dayOfWeek) {
          next.setDate(next.getDate() + 1);
        }
        break;
      case 'monthly':
        next.setDate(schedule.dayOfMonth || 1);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
    }

    return next;
  }

  private static async generateAndSendReport(schedule: ReportSchedule): Promise<void> {
    try {
      const now = new Date();
      let startDate: Date;
      
      // Calculate date range based on frequency
      switch (schedule.frequency) {
        case 'daily':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      // Generate report
      const exportResult = await ExportService.exportData(schedule.userId, {
        startDate,
        endDate: now,
        format: schedule.format,
        includeMetrics: schedule.includeMetrics,
        includeAlerts: schedule.includeAlerts,
        includePlatformData: schedule.includePlatformData
      });

      // Send report to recipients
      await Promise.all(schedule.recipients.map(recipient =>
        NotificationService.sendEmailWithAttachment(
          recipient,
          `${schedule.name} - ${schedule.frequency} Report`,
          `Please find attached your ${schedule.frequency.toLowerCase()} email analytics report.`,
          [{
            filename: exportResult.filename,
            content: exportResult.data,
            contentType: exportResult.mimeType
          }]
        )
      ));

      // Update schedule with last run time
      await this.updateSchedule({
        ...schedule,
        lastRun: now,
        nextRun: this.calculateNextRun(schedule)
      });
    } catch (error) {
      console.error(`Error generating report for schedule ${schedule.id}:`, error);
      // Notify admin or log to monitoring system
    }
  }

  private static scheduleNext(schedule: ReportSchedule): void {
    const nextRun = this.calculateNextRun(schedule);
    const delay = nextRun.getTime() - Date.now();

    // Clear existing timeout if any
    const existingTimeout = this.schedules.get(schedule.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule next run
    const timeout = setTimeout(() => {
      this.generateAndSendReport(schedule).catch(console.error);
      this.scheduleNext(schedule); // Schedule next run after completion
    }, delay);

    this.schedules.set(schedule.id, timeout);
  }

  static async createSchedule(schedule: Omit<ReportSchedule, 'id'>): Promise<ReportSchedule> {
    const newSchedule: ReportSchedule = {
      ...schedule,
      id: crypto.randomUUID(),
      nextRun: this.calculateNextRun(schedule as ReportSchedule)
    };

    // Save to database
    await this.saveSchedule(newSchedule);

    if (newSchedule.enabled) {
      this.scheduleNext(newSchedule);
    }

    return newSchedule;
  }

  static async updateSchedule(schedule: ReportSchedule): Promise<void> {
    // Save to database
    await this.saveSchedule(schedule);

    // Update scheduling
    if (schedule.enabled) {
      this.scheduleNext(schedule);
    } else {
      const existingTimeout = this.schedules.get(schedule.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.schedules.delete(schedule.id);
      }
    }
  }

  static async deleteSchedule(scheduleId: string): Promise<void> {
    // Clear scheduling
    const existingTimeout = this.schedules.get(scheduleId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.schedules.delete(scheduleId);
    }

    // Remove from database
    await this.deleteScheduleFromDB(scheduleId);
  }

  static async getSchedules(userId: string): Promise<ReportSchedule[]> {
    // Retrieve from database
    const schedules = await this.getSchedulesFromDB(userId);
    return schedules;
  }

  static async initializeSchedules(): Promise<void> {
    // Load all schedules from database
    const allSchedules = await this.getAllSchedulesFromDB();
    
    // Set up scheduling for enabled schedules
    allSchedules.forEach(schedule => {
      if (schedule.enabled) {
        this.scheduleNext(schedule);
      }
    });
  }

  // Database operations
  private static async saveSchedule(schedule: ReportSchedule): Promise<void> {
    await ReportSchedulerDB.saveSchedule(schedule);
  }

  private static async deleteScheduleFromDB(scheduleId: string): Promise<void> {
    await ReportSchedulerDB.deleteSchedule(scheduleId);
  }

  private static async getSchedulesFromDB(userId: string): Promise<ReportSchedule[]> {
    return ReportSchedulerDB.getSchedules(userId);
  }

  private static async getAllSchedulesFromDB(): Promise<ReportSchedule[]> {
    return ReportSchedulerDB.getAllSchedules();
  }
} 