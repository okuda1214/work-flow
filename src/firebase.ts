import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  getDocFromServer 
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { Task, TaikinRecord, CalendarEvent } from "./types";
import { auth } from "./auth";

const isPlaceholder = firebaseConfig.apiKey === "PLACEHOLDER";
const app = isPlaceholder 
  ? null 
  : (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig));

export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null;

// Error Handling according to firebase-integration guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on initialization
export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test passed.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();

// Task Helper Operations
export async function fetchUserTasks(userId: string): Promise<Task[]> {
  if (!db) return [];
  const colPath = "tasks";
  try {
    const q = query(collection(db, colPath), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const tasks: Task[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      tasks.push({
        id: data.id,
        title: data.title,
        priority: data.priority,
        estimatedMinutes: data.estimatedMinutes,
        category: data.category,
        status: data.status,
        createdAt: data.createdAt,
      });
    });
    return tasks;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colPath);
    return [];
  }
}

export async function saveUserTask(userId: string, task: Task): Promise<void> {
  if (!db) return;
  const colPath = "tasks";
  try {
    const docRef = doc(db, colPath, task.id);
    await setDoc(docRef, {
      ...task,
      userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${colPath}/${task.id}`);
  }
}

export async function deleteUserTask(userId: string, taskId: string): Promise<void> {
  if (!db) return;
  const colPath = "tasks";
  try {
    const docRef = doc(db, colPath, taskId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath}/${taskId}`);
  }
}

// TaikinRecord Helper Operations
export async function fetchUserTaikinRecords(userId: string): Promise<TaikinRecord[]> {
  if (!db) return [];
  const colPath = "taikinRecords";
  try {
    const q = query(collection(db, colPath), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const list: TaikinRecord[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: data.id,
        date: data.date,
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        workMinutes: data.workMinutes,
        overtimeMinutes: data.overtimeMinutes,
        breakMinutes: data.breakMinutes,
        isManual: data.isManual || false,
        isEdited: data.isEdited || false,
        originalClockIn: data.originalClockIn || undefined,
        originalClockOut: data.originalClockOut || undefined,
        note: data.note || "",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });
    // Sort descending by date or id
    return list.sort((a, b) => b.id.localeCompare(a.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colPath);
    return [];
  }
}

export async function saveUserTaikinRecord(userId: string, record: TaikinRecord): Promise<void> {
  if (!db) return;
  const colPath = "taikinRecords";
  try {
    const docRef = doc(db, colPath, record.id);
    await setDoc(docRef, {
      ...record,
      userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${colPath}/${record.id}`);
  }
}

export async function deleteUserTaikinRecord(userId: string, recordId: string): Promise<void> {
  if (!db) return;
  const colPath = "taikinRecords";
  try {
    const docRef = doc(db, colPath, recordId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath}/${recordId}`);
  }
}

// Custom CalendarEvent Helper Operations
export async function fetchUserCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  if (!db) return [];
  const colPath = "customCalendarEvents";
  try {
    const q = query(collection(db, colPath), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const list: CalendarEvent[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: data.id,
        summary: data.summary,
        description: data.description || "",
        location: data.location || "",
        start: data.start,
        end: data.end,
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, colPath);
    return [];
  }
}

export async function saveUserCalendarEvent(userId: string, event: CalendarEvent): Promise<void> {
  if (!db) return;
  const colPath = "customCalendarEvents";
  try {
    const docRef = doc(db, colPath, event.id);
    await setDoc(docRef, {
      ...event,
      userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${colPath}/${event.id}`);
  }
}

export async function deleteUserCalendarEvent(userId: string, eventId: string): Promise<void> {
  if (!db) return;
  const colPath = "customCalendarEvents";
  try {
    const docRef = doc(db, colPath, eventId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${colPath}/${eventId}`);
  }
}
