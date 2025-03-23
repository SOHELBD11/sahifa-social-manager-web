import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { ReportSchedule } from './ReportScheduler';

const COLLECTION_NAME = 'reportSchedules';

export class ReportSchedulerDB {
  static async saveSchedule(schedule: ReportSchedule): Promise<void> {
    const scheduleRef = doc(db, COLLECTION_NAME, schedule.id);
    
    // Convert Date objects to timestamps for Firestore
    const scheduleData = {
      ...schedule,
      lastRun: schedule.lastRun?.toISOString(),
      nextRun: schedule.nextRun?.toISOString()
    };

    await setDoc(scheduleRef, scheduleData);
  }

  static async deleteSchedule(scheduleId: string): Promise<void> {
    const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
    await deleteDoc(scheduleRef);
  }

  static async getSchedules(userId: string): Promise<ReportSchedule[]> {
    const schedulesQuery = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('nextRun', 'asc')
    );

    const snapshot = await getDocs(schedulesQuery);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        lastRun: data.lastRun ? new Date(data.lastRun) : undefined,
        nextRun: data.nextRun ? new Date(data.nextRun) : undefined
      } as ReportSchedule;
    });
  }

  static async getAllSchedules(): Promise<ReportSchedule[]> {
    const schedulesQuery = query(
      collection(db, COLLECTION_NAME),
      orderBy('nextRun', 'asc')
    );

    const snapshot = await getDocs(schedulesQuery);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        lastRun: data.lastRun ? new Date(data.lastRun) : undefined,
        nextRun: data.nextRun ? new Date(data.nextRun) : undefined
      } as ReportSchedule;
    });
  }
} 