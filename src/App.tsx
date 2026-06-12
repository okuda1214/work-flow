import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Square, 
  Plus, 
  Trash2, 
  Sparkles, 
  Calendar, 
  ChevronUp, 
  ChevronDown, 
  Clock, 
  CheckCircle, 
  Circle, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Layers, 
  LogOut, 
  HelpCircle,
  FileText,
  User as UserIcon,
  AlertCircle,
  Timer,
  History,
  Award,
  Coffee
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { initAuth, googleSignIn, logout } from "./auth";
import { Task, CalendarEvent, VoiceOption, TaikinRecord } from "./types";
import {
  fetchUserTasks,
  saveUserTask,
  deleteUserTask,
  fetchUserTaikinRecords,
  saveUserTaikinRecord,
  deleteUserTaikinRecord,
  fetchUserCalendarEvents,
  saveUserCalendarEvent,
  deleteUserCalendarEvent
} from "./firebase";

const PREBUILT_VOICES: VoiceOption[] = [
  { id: "Kore", name: "日本語 自然なAIお姉さん (Kore)", gender: "female", description: "標準的で親しみやすい女性の音声" },
  { id: "Aoede", name: "日本語 知的なAIお姉さん (Aoede)", gender: "female", description: "落ち着いていて専門的な女性の音声" },
  { id: "Puck", name: "日本語 AIお兄さん (Puck)", gender: "male", description: "聞き取りやすくて明るい男性の音声" },
];

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Core App states
  const [rawText, setRawText] = useState<string>(() => {
    const saved = localStorage.getItem("daily_briefing_raw_text");
    return saved || "1. 10:00から会議の資料作成を行う。優先度高。\n2. クライアントの奥田様にメール返信をする。15分で終わらせる。\n3. プロジェクト進捗報告の準備。夕方までに提出。";
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("daily_briefing_tasks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      { id: "t1", title: "会議の資料作成", priority: "high", estimatedMinutes: 60, category: "Work", status: "not_started", createdAt: Date.now() },
      { id: "t2", title: "クライアントへのメール返信", priority: "medium", estimatedMinutes: 15, category: "Email", status: "in_progress", createdAt: Date.now() + 1 },
      { id: "t3", title: "プロジェクト進捗報告の準備", priority: "high", estimatedMinutes: 30, category: "Planning", status: "not_started", createdAt: Date.now() + 2 }
    ];
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem("daily_briefing_events");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    // Default sample calendar events to experience the "dream app" immediately
    return [
      { id: "e1", summary: "【定例】朝会・進捗共有", start: { dateTime: new Date(new Date().setHours(9, 30, 0)).toISOString() }, end: { dateTime: new Date(new Date().setHours(10, 0, 0)).toISOString() }, location: "第1会議室 / Meet" },
      { id: "e2", summary: "クライアント定例打ち合わせ", start: { dateTime: new Date(new Date().setHours(14, 0, 0)).toISOString() }, end: { dateTime: new Date(new Date().setHours(15, 0, 0)).toISOString() }, location: "オンライン" },
    ];
  });

  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem("daily_briefing_username") || "奥田";
  });

  // App UI states
  const [isTimeExpanded, setIsTimeExpanded] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Audio briefing states
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem("daily_briefing_selected_voice") || "Kore";
  });
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string>("");
  
  // Real-time Clock states
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Audio playback references
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [audioWaves, setAudioWaves] = useState<number[]>(Array.from({ length: 15 }, () => 15));

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"tasks" | "taikin">("tasks");

  // Taikin Timer states
  const [isClockedIn, setIsClockedIn] = useState<boolean>(() => {
    return localStorage.getItem("taikin_is_clocked_in") === "true";
  });
  
  const [isClockedOut, setIsClockedOut] = useState<boolean>(() => {
    return localStorage.getItem("taikin_is_clocked_out") === "true";
  });

  const [clockInTime, setClockInTime] = useState<string>(() => {
    return localStorage.getItem("taikin_clock_in") || "09:00";
  });

  const [targetClockOutTime, setTargetClockOutTime] = useState<string>(() => {
    return localStorage.getItem("taikin_target_clock_out") || "18:00";
  });

  const [actualClockInTime, setActualClockInTime] = useState<string | null>(() => {
    return localStorage.getItem("taikin_actual_clock_in") || null;
  });

  const [actualClockOutTime, setActualClockOutTime] = useState<string | null>(() => {
    return localStorage.getItem("taikin_actual_clock_out") || null;
  });

  const [breakMinutes, setBreakMinutes] = useState<number>(() => {
    const saved = localStorage.getItem("taikin_break_minutes");
    return saved ? Number(saved) : 60;
  });

  const [taikinHistory, setTaikinHistory] = useState<TaikinRecord[]>(() => {
    const saved = localStorage.getItem("taikin_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Sync Taikin states to local storage
  useEffect(() => {
    localStorage.setItem("taikin_is_clocked_in", String(isClockedIn));
  }, [isClockedIn]);

  useEffect(() => {
    localStorage.setItem("taikin_is_clocked_out", String(isClockedOut));
  }, [isClockedOut]);

  useEffect(() => {
    localStorage.setItem("taikin_clock_in", clockInTime);
  }, [clockInTime]);

  useEffect(() => {
    localStorage.setItem("taikin_target_clock_out", targetClockOutTime);
  }, [targetClockOutTime]);

  useEffect(() => {
    if (actualClockInTime) {
      localStorage.setItem("taikin_actual_clock_in", actualClockInTime);
    } else {
      localStorage.removeItem("taikin_actual_clock_in");
    }
  }, [actualClockInTime]);

  useEffect(() => {
    if (actualClockOutTime) {
      localStorage.setItem("taikin_actual_clock_out", actualClockOutTime);
    } else {
      localStorage.removeItem("taikin_actual_clock_out");
    }
  }, [actualClockOutTime]);

  useEffect(() => {
    localStorage.setItem("taikin_break_minutes", String(breakMinutes));
  }, [breakMinutes]);

  useEffect(() => {
    localStorage.setItem("taikin_history", JSON.stringify(taikinHistory));
  }, [taikinHistory]);

  // Auto-updating active clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("daily_briefing_raw_text", rawText);
  }, [rawText]);

  useEffect(() => {
    localStorage.setItem("daily_briefing_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("daily_briefing_events", JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    localStorage.setItem("daily_briefing_username", username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem("daily_briefing_selected_voice", selectedVoice);
  }, [selectedVoice]);

  // Audio wave animation when voice briefing is singing
  useEffect(() => {
    let waveInterval: any;
    if (isPlayingBriefing) {
      waveInterval = setInterval(() => {
        setAudioWaves(Array.from({ length: 15 }, () => Math.floor(Math.random() * 40) + 10));
      }, 100);
    } else {
      setAudioWaves(Array.from({ length: 15 }, () => 10));
    }
    return () => clearInterval(waveInterval);
  }, [isPlayingBriefing]);

  // Firebase auth state initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setIsAuthLoading(false);
        setIsDemoMode(false);
        if (user.displayName) {
          const cleanName = user.displayName.split(" ")[0] || user.displayName;
          // Set username based on logged-in google account unless user changed it
          if (!localStorage.getItem("daily_briefing_username")) {
            setUsername(cleanName);
          }
        }
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Synchronize and Load from Firestore when user is authenticated
  useEffect(() => {
    if (currentUser?.uid) {
      const loadFirestoreData = async () => {
        try {
          const fsTasks = await fetchUserTasks(currentUser.uid);
          if (fsTasks.length > 0) {
            setTasks(fsTasks);
          } else if (tasks.length > 0) {
            // First time login - migrate existing local tasks to Firestore
            for (const t of tasks) {
              await saveUserTask(currentUser.uid, t);
            }
          }

          const fsTaikin = await fetchUserTaikinRecords(currentUser.uid);
          if (fsTaikin.length > 0) {
            setTaikinHistory(fsTaikin);
          } else if (taikinHistory.length > 0) {
            // Migrate local taikin records to Firestore
            for (const tk of taikinHistory) {
              await saveUserTaikinRecord(currentUser.uid, tk);
            }
          }
        } catch (e) {
          console.error("Failed to load/sync Firestore data:", e);
        }
      };
      loadFirestoreData();
    } else {
      // Offline / No User login - reset or read from local storage
      const savedTasks = localStorage.getItem("daily_briefing_tasks");
      if (savedTasks) {
        try { setTasks(JSON.parse(savedTasks)); } catch (e) {}
      }
      const savedTaikin = localStorage.getItem("taikin_history");
      if (savedTaikin) {
        try { setTaikinHistory(JSON.parse(savedTaikin)); } catch (e) {}
      }
    }
  }, [currentUser]);

  // Fetch calendar events once authorized
  useEffect(() => {
    if (accessToken) {
      fetchGoogleCalendarToday();
    }
  }, [accessToken]);

  // Fetch current Google Calendar events
  const fetchGoogleCalendarToday = async () => {
    if (!accessToken) return;
    setIsCalendarLoading(true);
    setCalendarError(null);

    try {
      const today = new Date();
      // Set to Japanese timezone start & end (GMT+9 offset handled elegantly by setting start & end)
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      const timeMin = startOfDay.toISOString();
      const timeMax = endOfDay.toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired, log user out so they can log back in
          logout();
          throw new Error("セッションの期限が切れました。再度Googleにサインインしてください。");
        }
        throw new Error(`Google Calendar API error: ${res.statusText}`);
      }

      const data = await res.json();
      const items: any[] = data.items || [];
      
      const parsedEvents: CalendarEvent[] = items.map((item: any) => ({
        id: item.id || Math.random().toString(),
        summary: item.summary || "無題の予定",
        description: item.description,
        start: {
          dateTime: item.start?.dateTime || item.start?.date,
          date: item.start?.date,
        },
        end: {
          dateTime: item.end?.dateTime || item.end?.date,
          date: item.end?.date,
        },
        location: item.location,
      }));

      setCalendarEvents(parsedEvents);
    } catch (err: any) {
      console.error("Error fetching google calendar:", err);
      setCalendarError(err.message || "Googleカレンダーの情報の取得に失敗しました。");
    } finally {
      setIsCalendarLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setIsDemoMode(false);
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setAuthError(err.message || "お手数ですがもう一度サインインをお試しください。");
      // Fallback to Demo Mode with mock calendar if sign in configuration is placeholder
      if (err.message?.includes("initializing") || err.message?.includes("PLACEHOLDER") || err.message?.includes("Firebase")) {
        setIsDemoMode(true);
      }
    }
  };

  // Trigger Google Logout
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
    setIsDemoMode(false);
  };

  // Organize raw text with AI
  const handleParseTasks = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setParseError(null);

    try {
      const response = await fetch("/api/parse-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!response.ok) {
        throw new Error("AIタスク解析リクエストに失敗しました。");
      }

      const data = await response.json();
      if (data.tasks && Array.isArray(data.tasks)) {
        const parsedWithIds: Task[] = data.tasks.map((t: any, idx: number) => ({
          id: `ai-${Date.now()}-${idx}`,
          title: t.title || "タスク",
          priority: (t.priority === "high" || t.priority === "medium" || t.priority === "low") ? t.priority : "medium",
          estimatedMinutes: Number(t.estimatedMinutes) || 30,
          category: t.category || "その他",
          status: "not_started",
          createdAt: Date.now() + idx,
        }));
        
        setTasks(parsedWithIds);
        if (currentUser?.uid) {
          for (const t of parsedWithIds) {
            saveUserTask(currentUser.uid, t).catch(console.error);
          }
        }
      } else {
        throw new Error("タスクデータの解析フォーマットが正しくありません。");
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || "AI解析中にエラーが発生しました。");
    } finally {
      setIsParsing(false);
    }
  };

  // Manual Task creation
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newMinutes, setNewMinutes] = useState(30);
  const [newCategory, setNewCategory] = useState("Work");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: Task = {
      id: `manual-${Date.now()}`,
      title: newTitle.trim(),
      priority: newPriority,
      estimatedMinutes: Number(newMinutes) || 30,
      category: newCategory.trim() || "Work",
      status: "not_started",
      createdAt: Date.now(),
    };

    setTasks([...tasks, newTask]);
    if (currentUser?.uid) {
      saveUserTask(currentUser.uid, newTask).catch(console.error);
    }
    setNewTitle("");
  };

  // Modify task status
  const handleToggleStatus = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const statusMap: Record<string, "not_started" | "in_progress" | "completed"> = {
          "not_started": "in_progress",
          "in_progress": "completed",
          "completed": "not_started"
        };
        const updated = { ...t, status: statusMap[t.status] };
        if (currentUser?.uid) {
          saveUserTask(currentUser.uid, updated).catch(console.error);
        }
        return updated;
      }
      return t;
    }));
  };

  // Delete single task
  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    if (currentUser?.uid) {
      deleteUserTask(currentUser.uid, id).catch(console.error);
    }
  };

  // Reordering tasks
  const handleMoveTask = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= tasks.length) return;

    const reordered = [...tasks];
    const temp = reordered[index];
    reordered[index] = reordered[nextIndex];
    reordered[nextIndex] = temp;

    // Adjust creation timestamp slightly to preserve ordering
    const now = Date.now();
    reordered[index].createdAt = now;
    reordered[nextIndex].createdAt = now + 1;

    setTasks(reordered);
    if (currentUser?.uid) {
      saveUserTask(currentUser.uid, reordered[index]).catch(console.error);
      saveUserTask(currentUser.uid, reordered[nextIndex]).catch(console.error);
    }
  };

  // Stop and clean up any playing PCM or legacy audio
  const handleStopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close().catch(() => {});
      } catch (e) {}
      audioCtxRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {}
    }
    setIsPlayingBriefing(false);
  };

  // Play uncompressed raw signed 16-bit PCM (little-endian) as returned by Gemini TTS at 24kHz
  const playPcmAudio = async (base64Audio: string, sampleRate = 24000) => {
    try {
      // Clean up previous playback if any
      handleStopAudio();

      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const buffer = new ArrayBuffer(len);
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const dataView = new DataView(buffer);
      const floatData = new Float32Array(len / 2);
      for (let i = 0; i < len / 2; i++) {
        floatData[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const audioBuffer = audioCtx.createBuffer(1, len / 2, sampleRate);
      audioBuffer.getChannelData(0).set(floatData);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      audioSourceRef.current = source;

      source.connect(audioCtx.destination);

      source.onended = () => {
        if (audioSourceRef.current === source) {
          setIsPlayingBriefing(false);
          audioSourceRef.current = null;
          if (audioCtxRef.current === audioCtx) {
            audioCtx.close().catch(() => {});
            audioCtxRef.current = null;
          }
        }
      };

      setIsPlayingBriefing(true);
      source.start(0);
    } catch (err) {
      console.error("PCM playback error:", err);
      setBriefingError("ブラウザでの音声再生時に問題が発生しました。");
    }
  };

  // Play MP3/WAV/AAC audio returned as base64 from OpenAI TTS
  const playEncodedAudio = async (base64Audio: string, mimeType = "audio/mpeg") => {
    try {
      handleStopAudio();

      const audio = new Audio(`data:${mimeType};base64,${base64Audio}`);
      audioRef.current = audio;

      audio.onended = () => {
        if (audioRef.current === audio) {
          setIsPlayingBriefing(false);
        }
      };

      audio.onerror = () => {
        setIsPlayingBriefing(false);
        setBriefingError("ブラウザでの音声再生時に問題が発生しました。");
      };

      setIsPlayingBriefing(true);
      await audio.play();
    } catch (err) {
      console.error("Encoded audio playback error:", err);
      setBriefingError("ブラウザでの音声再生時に問題が発生しました。");
      setIsPlayingBriefing(false);
    }
  };

  const playGeneratedAudio = async (audioBase64: string, mimeType?: string) => {
    if (mimeType) {
      await playEncodedAudio(audioBase64, mimeType);
      return;
    }

    // 古いGemini PCM形式にも戻せるように残しておく
    await playPcmAudio(audioBase64);
  };

  // Voice briefing generator
  const handlePlayBriefing = async () => {
    if (isPlayingBriefing) {
      handleStopAudio();
      return;
    }

    setIsGeneratingBriefing(true);
    setBriefingError(null);

    try {
      // 1. まず、タスクと予定をそのまま全部読ませず、短い自然な台本にまとめる
      const scriptResponse = await fetch("/api/briefing-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          tasks,
          calendarEvents,
        }),
      });

      if (!scriptResponse.ok) {
        throw new Error("音声用の短い台本作成に失敗しました。時間をおいてもう一度お試しください。");
      }

      const scriptData = await scriptResponse.json();
      const compiledText = scriptData.script;

      if (!compiledText) {
        throw new Error("音声用の台本を取得できませんでした。");
      }

      setActiveSpeechText(compiledText);

      // 2. 短く整えた台本だけを音声生成する
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          text: compiledText,
          voice: selectedVoice 
        }),
      });

      if (!response.ok) {
        throw new Error("音声作成に失敗しました。時間をおいてもう一度お試しください。");
      }

      const data = await response.json();
      if (!data.audioBase64) {
        throw new Error("音声データの読み込み時に不具合が発生しました。");
      }

      await playGeneratedAudio(data.audioBase64, data.mimeType);
    } catch (err: any) {
      console.error(err);
      setBriefingError(err.message || "読み上げ準備に失敗しました。");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // Taikin Timer helper functions
  const handleClockIn = () => {
    setIsClockedIn(true);
    setIsClockedOut(false);
    const nowStr = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
    setActualClockInTime(nowStr);
    setClockInTime(nowStr);
    
    // Auto-calculate standard target clock-out (clockIn + 9 hours representing 8 hours work + 1 hour break)
    const targetHour = (currentTime.getHours() + 9) % 24;
    const targetStr = `${String(targetHour).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
    setTargetClockOutTime(targetStr);
  };

  const handleClockOut = () => {
    if (!isClockedIn) return;
    setIsClockedIn(false);
    setIsClockedOut(true);
    const nowStr = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
    setActualClockOutTime(nowStr);

    const inTime = actualClockInTime || clockInTime;
    const [inH, inM] = inTime.split(":").map(Number);
    const [outH, outM] = nowStr.split(":").map(Number);
    
    let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle cross-midnight
    
    const workM = Math.max(0, diffMinutes - breakMinutes);

    const [tgtH, tgtM] = targetClockOutTime.split(":").map(Number);
    let overtimeM = (outH * 60 + outM) - (tgtH * 60 + tgtM);
    if (overtimeM < 0 && (outH * 60 + outM) < (inH * 60 + inM)) overtimeM += 24 * 60;
    overtimeM = Math.max(0, overtimeM);

    const newRecord: TaikinRecord = {
      id: `tk-${Date.now()}`,
      date: `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, "0")}-${String(currentTime.getDate()).padStart(2, "0")}`,
      clockIn: inTime,
      clockOut: nowStr,
      workMinutes: workM,
      overtimeMinutes: overtimeM,
    };
    
    setTaikinHistory(prev => [newRecord, ...prev]);
    if (currentUser?.uid) {
      saveUserTaikinRecord(currentUser.uid, newRecord).catch(console.error);
    }
  };

  const handleResetClock = () => {
    setIsClockedIn(false);
    setIsClockedOut(false);
    setActualClockInTime(null);
    setActualClockOutTime(null);
  };

  const handleDeleteTaikinHistory = (id: string) => {
    setTaikinHistory(prev => prev.filter(item => item.id !== id));
    if (currentUser?.uid) {
      deleteUserTaikinRecord(currentUser.uid, id).catch(console.error);
    }
  };

  const handlePlayClosingBriefing = async () => {
    if (isPlayingBriefing) {
      handleStopAudio();
      return;
    }

    setIsGeneratingBriefing(true);
    setBriefingError(null);

    const completedTasks = tasks.filter(t => t.status === "completed");
    const inTime = actualClockInTime || clockInTime;
    const outTime = actualClockOutTime || `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
    
    // Calculate work hours and overtime
    const [inH, inM] = inTime.split(":").map(Number);
    const [outH, outM] = outTime.split(":").map(Number);
    let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const actualWorkMin = Math.max(0, diffMinutes - breakMinutes);
    const workHoursString = `${Math.floor(actualWorkMin / 60)}時間${actualWorkMin % 60}分`;

    const [tgtH, tgtM] = targetClockOutTime.split(":").map(Number);
    let overMin = (outH * 60 + outM) - (tgtH * 60 + tgtM);
    if (overMin < 0 && (outH * 60 + outM) < (inH * 60 + inM)) overMin += 24 * 60;
    overMin = Math.max(0, overMin);
    const overtimeString = overMin > 0 ? `残業時間は、${Math.floor(overMin / 60)}時間${overMin % 60}分でした。` : "残業はなく、定時での退勤です。素晴らしい時間管理ですね！";

    const text = `お疲れ様でした、${username}さん。今日の業務がすべて終了しました。本日の出勤時間は${inTime}、退勤時間は${outTime}。休憩時間を除いた実働時間は${workHoursString}です。${overtimeString}また、本日は全体のタスクのうち、${completedTasks.length}件を完了させることができました。一生懸命取り組んだ自分をたっぷり褒めてあげてくださいね。それでは、今夜は心も体もゆっくり休めてリフレッシュしてください。今日お疲れ様でした！`;
    setActiveSpeechText(text);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          text: text,
          voice: selectedVoice 
        }),
      });

      if (!response.ok) {
        throw new Error("お疲れ様音声の作成に失敗しました。時間をおいてもう一度お試しください。");
      }

      const data = await response.json();
      if (!data.audioBase64) {
        throw new Error("音声データの読み込み時に不具合が発生しました。");
      }

      // Play audio
      await playGeneratedAudio(data.audioBase64, data.mimeType);
    } catch (err: any) {
      console.error(err);
      setBriefingError(err.message || "お疲れ様音声の生成に失敗しました。");
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  // Helper date tools
  const formatDateJapanese = (date: Date) => {
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${days[date.getDay()]})`;
  };

  const getDayPeriodText = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 11) return "朝のスタート、準備はばっちりですか？";
    if (hour >= 11 && hour < 14) return "お昼時ですね。午後も無理せず進めましょう！";
    if (hour >= 14 && hour < 18) return "夕方に向けて、ラストスパートです！";
    return "夜の時間です。今日もお疲れ様でした！";
  };

  // Stats
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.status !== "completed" ? t.estimatedMinutes : 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const getTaikinCalculations = () => {
    const inTime = actualClockInTime || clockInTime;
    const [inH, inM] = inTime.split(":").map(Number);
    const [tgtH, tgtM] = targetClockOutTime.split(":").map(Number);
    
    // Convert to Date objects
    const inDate = new Date(currentTime);
    inDate.setHours(inH, inM, 0, 0);
    
    const tgtDate = new Date(currentTime);
    tgtDate.setHours(tgtH, tgtM, 0, 0);
    
    const nowMs = currentTime.getTime();
    const tgtMs = tgtDate.getTime();
    const inMs = inDate.getTime();
    
    const isAhead = nowMs < tgtMs;
    const diffMs = Math.abs(tgtMs - nowMs);
    
    // Check-in progress percent helper
    let workProgress = 0;
    if (isClockedIn) {
      const elapsedMs = Math.max(0, nowMs - inMs);
      const totalShiftMs = Math.max(1, tgtMs - inMs);
      workProgress = Math.min(100, Math.round((elapsedMs / totalShiftMs) * 100));
    }
    
    // Format diffMs as hh:mm:ss
    const totalSecs = Math.floor(diffMs / 1000);
    const secs = totalSecs % 60;
    const mins = Math.floor(totalSecs / 60) % 60;
    const hours = Math.floor(totalSecs / 3600);
    
    const formattedDiff = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    
    return {
      isAhead,
      formattedDiff,
      workProgress,
      inTime,
    };
  };

  return (
    <div id="briefing_app" className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans flex flex-col md:flex-row selection:bg-amber-550 selection:text-white">
      
      {/* Sidebar Navigation - Always elegant & responsive */}
      <nav id="briefing_nav" className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col p-6 shrink-0 z-10">
        
        {/* App Title & Elegant Emblem */}
        <div className="flex items-center gap-3 mb-8 md:mb-12">
          <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-4 h-4 bg-white rounded-full"></div>
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-[#111827]">MorningTask</span>
            <span className="block text-[9px] font-bold text-slate-400 tracking-wider">VOICE BRIEFING</span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <div className="space-y-1.5 flex-1">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              activeTab === "tasks" 
                ? "bg-amber-50 text-amber-700 font-bold" 
                : "text-gray-500 hover:bg-gray-150"
            }`}
          >
            <Layers className={`w-4 h-4 ${activeTab === "tasks" ? "text-amber-500" : "text-gray-400"}`} />
            <span>予定 & タスク（朝礼）</span>
          </button>

          <button
            onClick={() => setActiveTab("taikin")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
              activeTab === "taikin" 
                ? "bg-indigo-50 text-indigo-700 font-bold" 
                : "text-gray-500 hover:bg-gray-150"
            }`}
          >
            <Timer className={`w-4 h-4 ${activeTab === "taikin" ? "text-indigo-500" : "text-gray-400"}`} />
            <span className="flex items-center gap-1.5 justify-between w-full">
              <span>退勤タイマー（終礼）</span>
              {isClockedIn && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-100 text-rose-600 animate-pulse">
                  勤務中
                </span>
              )}
            </span>
          </button>

          <div className="text-xs font-bold text-gray-400 pt-6 px-1 uppercase tracking-wider block">宛名設定</div>
          <div className="p-3 bg-gray-50 rounded-xl mt-1 border border-gray-100 flex flex-col gap-1.5 shadow-inner">
            <label className="text-[10px] text-gray-400 font-bold">ブリーフィングの進行宛名:</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="奥田"
                className="w-full bg-white text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-xs text-gray-500 font-medium shrink-0">様</span>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Account & Status Indicator */}
        <div className="mt-8 md:mt-auto pt-6 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wide">Google連携アカウント</p>
          {currentUser ? (
            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="avatar" 
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full border border-white object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    {username[0]}
                  </div>
                )}
                <div className="text-xs overflow-hidden">
                  <p className="font-bold text-gray-800 truncate" title={currentUser.displayName || username}>{currentUser.displayName || username} 様</p>
                  <p className="text-[9px] text-[#34A853] font-semibold flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#34A853] animate-ping"></span>
                    認証連携中
                  </p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full text-center py-1.5 bg-white hover:bg-rose-50 border border-gray-200 text-rose-600 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                連携解除
              </button>
            </div>
          ) : isDemoMode ? (
            <div className="p-3 bg-gray-50 border border-gray-150 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-700 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                ローカル・スタンドアロン動作中
              </div>
              <p className="text-[9px] text-gray-500 leading-relaxed">
                ログイン不要ですべてのタスク管理、退勤タイマー、音声読み上げが問題なく動作します。Google連携を行うと、実際のカレンダー予定も自動同期されます。
              </p>
              <button
                onClick={() => setIsDemoMode(false)}
                className="w-full text-center py-1 bg-white hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold border border-gray-200 transition-all cursor-pointer"
              >
                連携ログイン表示に戻る
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              Google アカウント同期
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Workspace Layout */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Elegant Minimal Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-5 md:px-10 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-[#111827] flex items-baseline gap-2.5">
              <span>{formatDateJapanese(currentTime)}</span>
              <span className="text-sm font-mono text-gray-400 font-bold tracking-tight">
                {currentTime.toTimeString().split(" ")[0]}
              </span>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm font-medium mt-1">
              {activeTab === "tasks" 
                ? `おはようございます、${username || "奥田"}様。今日も素晴らしい一日にしましょう！`
                : `今日もお疲れ様でした、${username || "奥田"}様。定時で退勤できるようサポートします！`
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-green-50 border border-green-150 rounded-full text-xs text-green-700 font-bold">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Google カレンダー同期済
              </span>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-150 rounded-full text-xs text-amber-700 font-bold transition-all cursor-pointer"
              >
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                カレンダー未同期（同期はこちら）
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Grid Workspace */}
        {activeTab === "tasks" ? (
          <div className="flex-1 p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 overflow-y-auto">
          
          {/* Dashboard Left/Main Component (Col: 7) -> Task list and Input */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Box 1: Quick bullet list importer */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-50 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    今日やることを箇条書き
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">出勤時に自由に書いた箇条書きリストをAIが整理します</p>
                </div>
                
                <button
                  onClick={handleParseTasks}
                  disabled={isParsing || !rawText.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      整理中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      AIで整理して反映
                    </>
                  )}
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="1. 会議の資料作成。&#10;2. クライアントへのメール返信。優先度高。&#10;3. 進捗報告の準備。30分くらいで終わる。"
                className="w-full h-32 bg-[#F9FAFB] border border-gray-200 rounded-xl p-3.5 text-xs text-gray-800 leading-relaxed placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all resize-none"
              />

              {parseError && (
                <div className="text-rose-600 text-xs bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            {/* Box 2: Organized Task Dashboard Container */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#111827]">今日やるべきこと（タスクボード）</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">タスクの追加、並べ替え、ステータス変更がリアルタイムに連動します</p>
                </div>
                <span className="px-3 py-1 bg-gray-150 rounded-full text-[10px] text-gray-600 font-bold">
                  計 {tasks.length} 件
                </span>
              </div>

              {/* Task Add Mini Form */}
              <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    placeholder="新しいタスクを入力..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-[#F9FAFB] text-xs border border-gray-200 rounded-xl px-3 py-2 text-gray-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 sm:col-span-5">
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="bg-white text-[10px] border border-gray-200 rounded-xl px-2 py-1.5 font-semibold text-gray-700"
                  >
                    <option value="high">優先：高</option>
                    <option value="medium">優先：中</option>
                    <option value="low">優先：低</option>
                  </select>
                  <select
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="bg-white text-[10px] border border-gray-200 rounded-xl px-1 py-1.5 font-semibold text-gray-700"
                  >
                    <option value={15}>15分</option>
                    <option value={30}>30分</option>
                    <option value={45}>45分</option>
                    <option value={60}>60分</option>
                    <option value={90}>90分</option>
                  </select>
                  <input
                    type="text"
                    placeholder="分類"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-white text-[10px] border border-gray-200 rounded-xl px-2 py-1.5 text-gray-700 placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="sm:col-span-2 py-2 bg-amber-400 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-0.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  追加
                </button>
              </form>

              {/* Tasks List */}
              <div className="space-y-3 min-h-[150px]">
                <AnimatePresence initial={false}>
                  {tasks.length > 0 ? (
                    tasks.map((task, index) => {
                      const priorityConfig = {
                        high: { bg: "bg-rose-50 text-rose-700", border: "border-rose-100", dot: "bg-rose-500", label: "高" },
                        medium: { bg: "bg-amber-50 text-amber-700", border: "border-amber-100", dot: "bg-amber-500", label: "中" },
                        low: { bg: "bg-blue-50 text-blue-700", border: "border-blue-100", dot: "bg-blue-500", label: "低" },
                      }[task.priority];

                      const isCompleted = task.status === "completed";
                      const isInProgress = task.status === "in_progress";

                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -15 }}
                          className={`bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all ${
                            isCompleted ? "opacity-60 bg-gray-50/50" : ""
                          }`}
                        >
                          {/* Circular Status Interactive Toggle */}
                          <div 
                            onClick={() => handleToggleStatus(task.id)}
                            className={`w-6 h-6 border-2 rounded-full cursor-pointer flex-shrink-0 flex items-center justify-center transition-all ${
                              isCompleted 
                                ? "border-amber-400 bg-amber-400 text-white" 
                                : isInProgress
                                ? "border-amber-400 bg-amber-50 text-amber-600 animate-pulse"
                                : "border-gray-200 hover:border-amber-300"
                            }`}
                          >
                            {isCompleted && (
                              <svg className="w-3.5 h-3.5 stroke-[3] fill-none stroke-current" viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {isInProgress && (
                              <span className="w-2 h-2 bg-amber-500 rounded-full" />
                            )}
                          </div>

                          {/* Task Content text */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] uppercase font-bold tracking-tight bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                                {task.category}
                              </span>
                              
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${priorityConfig.bg} ${priorityConfig.border}`}>
                                <span className={`w-1 h-1 rounded-full ${priorityConfig.dot}`} />
                                {priorityConfig.label}
                              </span>

                              <span className="text-[9px] text-gray-400 font-semibold inline-flex items-center gap-0.5 ml-1">
                                <Clock className="w-2.5 h-2.5 text-gray-350" />
                                {task.estimatedMinutes}分
                              </span>
                            </div>

                            <p className={`font-semibold text-sm text-[#111827] mt-1 pr-2 truncate ${
                              isCompleted ? "line-through text-gray-400 font-normal" : ""
                            }`}>
                              {task.title}
                            </p>
                          </div>

                          {/* Task Operations */}
                          <div className="flex items-center gap-1.5">
                            {/* Interactive Tag Status Toggler in background */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(task.id)}
                              className={`text-[9px] font-bold px-2 py-1 rounded-full border cursor-pointer select-none transition-all ${
                                isCompleted 
                                  ? "bg-green-50 text-green-700 border-green-100"
                                  : isInProgress
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-gray-100 text-gray-500 border-gray-150 hover:bg-gray-200"
                              }`}
                            >
                              {isCompleted ? "完了" : isInProgress ? "進行中" : "未着手"}
                            </button>

                            {/* Position Shifting */}
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMoveTask(index, "up")}
                                className="p-0.5 hover:bg-gray-100 text-gray-400 hover:text-amber-600 rounded disabled:opacity-30 transition-all cursor-pointer"
                                title="上に移動"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                disabled={index === tasks.length - 1}
                                onClick={() => handleMoveTask(index, "down")}
                                className="p-0.5 hover:bg-gray-100 text-gray-400 hover:text-amber-600 rounded disabled:opacity-30 transition-all cursor-pointer"
                                title="下に移動"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Delete single item */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center text-gray-450">
                      <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-2 opacity-70 animate-pulse" />
                      <p className="text-xs font-bold text-gray-700">登録済みタスクがありません。</p>
                      <p className="text-[10px] text-gray-400 mt-1 max-w-xs mx-auto leading-normal">
                        上の欄に「出勤前やること」の日課（箇条書き）を入力し、「AIで整理して反映」をクリックすると秒単位で整理されます。
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Micro Stats Row summary under Clean Minimalism */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 block font-sans">
                  完了タスク進捗率
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold text-gray-850 font-mono">
                    {completedCount}
                  </span>
                  <span className="text-[10px] text-gray-400">/ {tasks.length} 件 ({progressPercent}%)</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    style={{ width: `${progressPercent}%` }}
                    className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <span className="text-[9px] uppercase font-bold tracking-wider text-gray-400 block font-sans">
                  残り総稼働時間見込み
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold text-gray-850 font-mono">
                    {totalHours}
                  </span>
                  <span className="text-[10px] text-gray-450 font-bold">時間</span>
                </div>
                <span className="text-[9px] text-amber-600 font-bold mt-1.5 block">
                  未着手タスク合計: {totalMinutes} 分
                </span>
              </div>
            </div>
          </section>

          {/* Dashboard Right Column (Col: 5) -> Premium voice reader & Google Calendar */}
          <section className="lg:col-span-5 flex flex-col gap-6 md:gap-8">
            
            {/* Box 1: Beautiful Slate Dark Voice Card */}
            <div className="bg-[#2D3139] p-6 rounded-[32px] text-white shadow-lg flex flex-col gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm tracking-tight">音声読み上げアシスタント</h3>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Natural Female Voice</p>
                </div>
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
              </div>

              {/* Central Voice icon and animation */}
              <div className="flex flex-col items-center py-4 bg-white/5 rounded-2xl border border-white/5">
                
                {/* Visual Speaker Circle with pulsing shadow matching design-html */}
                <div className="w-14 h-14 bg-amber-400 rounded-full flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                  <div className="w-6 h-6 bg-white rounded-sm rotate-45 flex items-center justify-center relative">
                    <div className="w-1 h-3.5 bg-amber-400 rounded-full mx-[1.5px] animate-pulse"></div>
                    <div className="w-1 h-2.5 bg-amber-400 rounded-full mx-[1.5px]"></div>
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full absolute -top-1 -right-1"></div>
                  </div>
                </div>

                <p className="text-xs text-center px-4 leading-relaxed opacity-90 italic text-slate-100 font-medium">
                  {isPlayingBriefing 
                    ? `「${activeSpeechText.slice(0, 75)}...」`
                    : `「おはようございます。奥田さんが今日やるタスクは、会議の資料作成、カレンダー予定など計${tasks.filter(t => t.status !== "completed").length}件です。」`}
                </p>

                {/* Animated waves in clean minimalism design */}
                <div className="h-4 flex items-center justify-center gap-1 w-full mt-3">
                  {audioWaves.map((val, idx) => (
                    <div
                      key={idx}
                      style={{ height: `${val / 3}px` }}
                      className={`w-0.5 rounded-full ${isPlayingBriefing ? "bg-amber-400" : "bg-white/20"}`}
                    />
                  ))}
                </div>
              </div>

              {/* TTS Voice Tone option picker */}
              <div className="flex flex-col gap-1.5 bg-white/5 p-3 rounded-xl border border-white/5">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">声の選択 (自然な日本語):</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-[#2D3139] border border-white/10 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {PREBUILT_VOICES.map((vo) => (
                    <option key={vo.id} value={vo.id} className="bg-[#2D3139]">
                      {vo.name} ({vo.gender === "female" ? "女性" : "男性"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Play Aloud Action button */}
              <button
                onClick={handlePlayBriefing}
                disabled={isGeneratingBriefing}
                className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  isPlayingBriefing
                    ? "bg-white text-slate-900 border-white"
                    : isGeneratingBriefing
                    ? "bg-slate-700 text-slate-300 border-slate-650 cursor-wait"
                    : "bg-white/10 hover:bg-white/20 border-white/10 text-white"
                }`}
              >
                {isGeneratingBriefing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    音声を生成中...
                  </>
                ) : isPlayingBriefing ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    読み上げを一時停止
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    音声読み上げを開始する
                  </>
                )}
              </button>

              {briefingError && (
                <div className="text-rose-400 text-[10px] bg-rose-950/40 border border-rose-900/60 rounded-xl p-2.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{briefingError}</span>
                </div>
              )}
            </div>

            {/* Box 2: Premium Google Calendar events sync list */}
            <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-5 bg-blue-500 rounded-full"></div>
                  <h3 className="font-bold text-sm tracking-tight text-[#111827]">本日のカレンダー予定</h3>
                </div>

                {currentUser && (
                  <button
                    onClick={fetchGoogleCalendarToday}
                    disabled={isCalendarLoading}
                    className="p-1.5 hover:bg-gray-50 text-gray-400 hover:text-amber-500 rounded-full transition-all cursor-pointer"
                    title="再同期"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCalendarLoading ? "animate-spin" : ""}`} />
                  </button>
                )}
              </div>

              {!currentUser && !isDemoMode ? (
                <div className="border border-amber-100/50 rounded-2xl bg-amber-50/50 p-4 text-center flex flex-col gap-3">
                  <p className="text-[11px] text-gray-600 leading-normal">
                    Google アカウントで連携ログインすると、当日のスケジュールを瞬時に同期し、カレンダー項目を音声原稿に統合します！
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleGoogleLogin}
                      className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-500 text-white font-bold text-[10px] rounded-lg transition-all"
                    >
                      OAuth 連携 login
                    </button>
                    <button
                      onClick={() => {
                        setIsDemoMode(true);
                        setCalendarEvents([
                          { id: "e1", summary: "【定例】朝会・進捗共有", start: { dateTime: new Date(new Date().setHours(9, 30, 0)).toISOString() }, end: { dateTime: new Date(new Date().setHours(10, 0, 0)).toISOString() } },
                          { id: "e2", summary: "クライアント奥田様定例ミーティング", start: { dateTime: new Date(new Date().setHours(14, 0, 0)).toISOString() }, end: { dateTime: new Date(new Date().setHours(15, 0, 0)).toISOString() } },
                        ]);
                      }}
                      className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[10px] rounded-lg transition-all"
                    >
                      サンプル予定を挿入
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {isCalendarLoading ? (
                    <div className="text-center py-6 text-xs text-gray-400 flex items-center justify-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                      <span>連携データを取得中...</span>
                    </div>
                  ) : calendarEvents.length > 0 ? (
                    calendarEvents.map((evt) => {
                      const startIso = evt.start.dateTime || evt.start.date;
                      let formattedTime = "終日予定";
                      if (startIso) {
                        try {
                          const dateObj = new Date(startIso);
                          formattedTime = `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
                        } catch (e) {}
                      }
                      return (
                        <div key={evt.id} className="flex items-start gap-3">
                          <p className="text-[10px] font-bold text-gray-400 pt-0.5 w-10 shrink-0 font-mono text-right">{formattedTime}</p>
                          <div className="flex-1 pb-3.5 border-b border-gray-50 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{evt.summary}</p>
                            {evt.location && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{evt.location}</p>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-[10px] text-gray-400">
                      本日の登録スケジュールはありません。
                    </div>
                  )}

                  {calendarError && (
                    <div className="text-rose-600 text-[10px] bg-rose-50 border border-rose-100 rounded-lg p-2 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>{calendarError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Premium explanation Footer card */}
            <div className="text-[10px] text-gray-400/85 leading-relaxed bg-[#F1F3F5] p-3 rounded-2xl border border-gray-200/50">
              💡 **音声読み上げ機能の使い方**<br />
              自然な女性の声で「今日やることを箇条書き」から抽出したタスク情報と、Googleカレンダーの本日のカレンダー予定項目をブレンドした、実用的なオーディオ朝礼を作成・開始します。
            </div>
          </section>

        </div>
        ) : (
          <div className="flex-1 p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 overflow-y-auto">
            {/* Dashboard Left/Main Component (Col: 7) -> Clock-out countdown, setup inputs & history */}
            <section className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Box 1: Beautiful Countdown Visual Clock */}
              <div className="bg-white p-6 rounded-[32px] border border-gray-150 shadow-sm flex flex-col gap-6 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-[#111827] flex items-center gap-2">
                      <Timer className="w-5 h-5 text-indigo-500" />
                      退勤カウントダウン・業務進捗
                    </h3>
                    <p className="text-[11px] text-gray-400 font-medium">現在の勤務状態と定時退勤までの残り時間を秒単位で計測します</p>
                  </div>
                  
                  {isClockedIn ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-150 rounded-full text-xs font-bold text-rose-600 animate-pulse">
                      <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                      勤務中 （{getTaikinCalculations().inTime}打刻）
                    </span>
                  ) : isClockedOut ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-150 rounded-full text-xs font-bold text-emerald-600">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      本日の業務終了！お疲れ様でした
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-500">
                      未出勤 （お仕事準備中）
                    </span>
                  )}
                </div>

                {/* Big Live Countdown readout */}
                <div className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-indigo-50/40 via-white to-gray-50/50 rounded-2xl border border-gray-150">
                  <span className="text-xs uppercase tracking-wider font-extrabold text-[#4F46E5] mb-2 font-sans">
                    {isClockedIn 
                      ? (getTaikinCalculations().isAhead ? "定時退勤まで あと" : "残業発生中（定時を超過しました）")
                      : "退勤までの予想時間（未打刻）"
                    }
                  </span>

                  <div className={`text-4xl sm:text-5xl font-black font-mono tracking-wider flex items-center gap-1.5 ${
                    isClockedIn && !getTaikinCalculations().isAhead ? "text-rose-500 animate-pulse" : "text-gray-800"
                  }`}>
                    {isClockedIn ? (
                      <>
                        {!getTaikinCalculations().isAhead && <span className="text-xl sm:text-2xl font-bold font-sans mr-2 text-rose-500">＋</span>}
                        {getTaikinCalculations().formattedDiff}
                      </>
                    ) : isClockedOut ? (
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">お疲れ様でした！</span>
                    ) : (
                      "00:00:00"
                    )}
                  </div>

                  {/* Progress completion bar */}
                  {isClockedIn && (
                    <div className="w-full max-w-md px-6 mt-6">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold mb-1.5">
                        <span>出勤時間: {actualClockInTime}</span>
                        <span>進捗率: {getTaikinCalculations().workProgress}%</span>
                        <span>退勤目標: {targetClockOutTime}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                        <div 
                          style={{ width: `${getTaikinCalculations().workProgress}%` }}
                          className="bg-indigo-500 h-full rounded-full transition-all duration-1000 shadow-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive 打刻 (Clocking Buttons) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleClockIn}
                    disabled={isClockedIn || isClockedOut}
                    className="py-3 px-4 bg-amber-400 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    出勤を打刻
                  </button>

                  <button
                    onClick={handleClockOut}
                    disabled={!isClockedIn}
                    className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    退勤を打刻
                  </button>

                  <button
                    onClick={handleResetClock}
                    className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    今日の記録をリセット
                  </button>
                </div>
              </div>

              {/* Box 2: Shift / Shift Settings */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-extrabold text-[#111827] flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-indigo-500" />
                  勤務形態・目標退勤時間の設定
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">基準出勤時刻 (Clock-In)</label>
                    <input
                      type="time"
                      value={clockInTime}
                      onChange={(e) => setClockInTime(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">基準退勤目標 (Clock-Out)</label>
                    <input
                      type="time"
                      value={targetClockOutTime}
                      onChange={(e) => setTargetClockOutTime(e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">休憩時間 (分)</label>
                    <select
                      value={breakMinutes}
                      onChange={(e) => setBreakMinutes(Number(e.target.value))}
                      className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    >
                      <option value={45}>45分</option>
                      <option value={60}>60分 (1時間)</option>
                      <option value={90}>90分 (1.5時間)</option>
                      <option value={120}>120分 (2時間)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Box 3: History log of Clock-out timings */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-gray-55 pb-3">
                  <h3 className="text-sm font-extrabold text-[#111827] flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    退勤活動ログ・記録
                  </h3>
                  <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-[9px] text-[#4F46E5] font-bold">
                    計 {taikinHistory.length} 件
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1">
                  {taikinHistory.length > 0 ? (
                    taikinHistory.map((item) => {
                      const totalWorkH = (item.workMinutes / 60).toFixed(1);
                      return (
                        <div key={item.id} className="flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 border border-gray-100 p-3 rounded-xl transition-all">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-gray-800">{item.date}</span>
                            <span className="text-[10px] text-gray-400 font-semibold font-mono">
                              打刻: {item.clockIn} 〜 {item.clockOut} (休憩 {breakMinutes}分)
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right col-span-1">
                              <span className="text-xs font-bold text-gray-700 block">実働: {totalWorkH}時間</span>
                              {item.overtimeMinutes > 0 ? (
                                <span className="inline-flex items-center text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-105 px-1.5 py-0.5 rounded-md mt-0.5">
                                  残業: {Math.floor(item.overtimeMinutes / 60)}h{item.overtimeMinutes % 60}m
                                </span>
                              ) : (
                                <span className="text-[9px] text-gray-400 font-semibold">定時退勤</span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteTaikinHistory(item.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="記録を削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                      <Award className="w-6 h-6 text-indigo-400/80 mx-auto mb-2 animate-bounce" />
                      <p className="text-xs font-bold text-gray-700">退勤履歴が未登録です。</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">「退勤を打刻」すると、ここにお仕事結果が記録されます！</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Dashboard Right Column (Col: 5) -> Evening brief speaker & configuration summary */}
            <section className="lg:col-span-5 flex flex-col gap-6 md:gap-8">
              
              {/* Voice Card: Evening Speech synthesizer */}
              <div className="bg-[#2D3139] p-6 rounded-[32px] text-white shadow-lg flex flex-col gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-indigo-300">退勤お疲れ様ブリーフィング</h3>
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Closing voice speaker</p>
                  </div>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                </div>

                <div className="flex flex-col items-center py-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                    <div className="w-6 h-6 bg-white rounded-sm rotate-45 flex items-center justify-center relative">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full absolute -top-1 -right-1"></div>
                      <div className="w-1 h-3.5 bg-indigo-550 rounded-full mx-[1.5px] animate-pulse"></div>
                      <div className="w-1 h-2.5 bg-indigo-550 rounded-full mx-[1.5px]"></div>
                    </div>
                  </div>

                  <p className="text-xs text-center px-4 leading-relaxed opacity-90 italic text-slate-100 font-medium">
                    {isPlayingBriefing 
                      ? `「${activeSpeechText.slice(0, 75)}...」`
                      : `「お疲れ様でした、${username || "奥田"}さん。休憩時間を除いた実働時間は${
                          actualClockInTime ? "計算可能" : "---分"
                        }。今日も本当に良い仕事ができましたね。」`}
                  </p>

                  <div className="h-4 flex items-center justify-center gap-1 w-full mt-3">
                    {audioWaves.map((val, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${val / 3}px` }}
                        className={`w-0.5 rounded-full ${isPlayingBriefing ? "bg-indigo-400" : "bg-white/20"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 bg-white/5 p-3 rounded-xl border border-white/5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">声のトーン選択 (TTS):</label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-[#2D3139] border border-white/10 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    {PREBUILT_VOICES.map((vo) => (
                      <option key={vo.id} value={vo.id} className="bg-[#2D3139]">
                        {vo.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handlePlayClosingBriefing}
                  disabled={isGeneratingBriefing}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                    isPlayingBriefing
                      ? "bg-white text-slate-900 border-white"
                      : isGeneratingBriefing
                      ? "bg-slate-700 text-slate-300 border-slate-650 cursor-wait"
                      : "bg-indigo-600 hover:bg-indigo-700 border-transparent text-white"
                  }`}
                >
                  {isGeneratingBriefing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      お疲れ様声を生成中...
                    </>
                  ) : isPlayingBriefing ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      読み上げを一時停止
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      お疲れ様ボイスを再生！ (終礼)
                    </>
                  )}
                </button>

                {briefingError && (
                  <div className="text-rose-400 text-[10px] bg-rose-950/40 border border-rose-900/60 rounded-xl p-2.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{briefingError}</span>
                  </div>
                )}
              </div>

              {/* Box 3: Performance statistics summary */}
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-5 bg-indigo-500 rounded-full"></div>
                  <h3 className="font-bold text-sm tracking-tight text-[#111827]">今日の仕事成果サマリー</h3>
                </div>

                <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-semibold">完了タスク</span>
                    <span className="text-xs font-black text-indigo-700">{completedCount} / {tasks.length} 件</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-semibold">本日の実働時間</span>
                    <span className="text-xs font-black text-indigo-700">
                      {isClockedOut && taikinHistory.length > 0 
                        ? (taikinHistory[0].workMinutes / 60).toFixed(1) + " 時間"
                        : "打刻後に計算"
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-semibold">当日の残業</span>
                    <span className="text-xs font-black text-rose-600">
                      {isClockedOut && taikinHistory.length > 0 
                        ? taikinHistory[0].overtimeMinutes + " 分"
                        : "---"
                      }
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-150">
                  💡 **統一メリット:** 朝は「MorningTask」でやるべき日課とGoogle予定をまとめて音声朝礼。夕方は「退勤タイマー」でカウントダウンしながら定時退勤を意識し、1日の頑張りとお疲れ様ボイスで毎日を豊かに完結させます。
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
