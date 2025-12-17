import { FirebaseDocument } from './firebase';

export interface User extends FirebaseDocument {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'admin' | 'tutor' | 'wychowawca' | 'nauczyciel_wspomagajacy' | 'psycholog' | 'pedagog' | 'logopeda' | 'terapeuta' | 'bibliotekarz' | 'administrator';
  isActive: boolean;
  lastLogin: string | null;
  classes?: string[]; // 🆕 NOWE - ID klas do których należy uczeń
  primaryTutorId?: string; // 🆕 NOWE - ID głównego tutora
  assignedTutors?: string[]; // 🆕 NOWE - ID przypisanych tutorów
  assignedInstructors?: string[]; // 🆕 NOWE - ID przypisanych instruktorów (tutor, wychowawca, nauczyciel wspomagający)
  instructorType?: 'tutor' | 'wychowawca' | 'nauczyciel_wspomagajacy'; // 🆕 NOWE - typ instruktora
  specialization?: string[]; // 🆕 NOWE - specjalizacje instruktora
  experience?: string; // 🆕 NOWE - doświadczenie instruktora
  availability?: string; // 🆕 NOWE - dostępność instruktora
  phone?: string; // 🆕 NOWE - telefon instruktora
  metadata: Record<string, unknown>;
}

export interface Course extends FirebaseDocument {
  title: string;
  description: string;
  slug: string;
  thumbnail: string;
  level: string;
  subject: string;
  year_of_study: number;
  category?: number;
  category_name?: string;
  is_active: boolean;
  teacherEmail: string;
  instructor_name?: string;
  courseType: 'obowiązkowy' | 'fakultatywny'; // 🆕 NOWE - typ kursu
  assignedUsers: string[]; // 🚨 ZACHOWUJĘ - kompatybilność wsteczna
  assignedClasses: string[]; // 🆕 NOWE - ID klas przypisanych do kursu
  sections: Section[];
  pdfUrls: string[];
  links: string[];
  progress?: number;
  total_time?: number;
  last_accessed?: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
}

export interface Section extends FirebaseDocument {
  name: string;
  type: string;
  deadline?: string;
  contents: Content[];
  submissions?: Submission[];
  order: number;
}

export interface Content extends FirebaseDocument {
  name: string;
  type: 'file' | 'link' | 'text' | 'video';
  fileUrl?: string;
  link?: string;
  text?: string;
  duration_minutes?: number;
  order: number;
}

export interface Submission extends FirebaseDocument {
  user_id: string;
  content: string;
  submitted_at: string;
  file_url?: string;
  grade?: number;
  feedback?: string;
}

export interface Quiz extends FirebaseDocument {
  title: string;
  description: string;
  subject: string;
  course_id: string;
  course_title: string;
  questions: Question[];
  max_attempts: number;
  time_limit?: number;
  passing_score?: number;
  start_time?: string; // ISO string
  submission_deadline?: string; // ISO string
}

export interface Question extends FirebaseDocument {
  content: string;
  type: 'text' | 'math' | 'mixed' | 'open';
  answers: Answer[];
  points: number;
  order: number;
}

export interface Answer extends FirebaseDocument {
  content: string;
  type: 'text' | 'math' | 'mixed';
  is_correct: boolean;
  explanation?: string;
}

export interface QuizAttempt extends FirebaseDocument {
  user_id: string;
  quiz_id: string;
  started_at: string;
  completed_at?: string;
  score?: number;
  answers: Record<string, string>;
  time_spent?: number;
  attempt_number?: number; // 🆕 NOWE - numer próby (1, 2, 3, itd.)
}

export interface Grade extends FirebaseDocument {
  user_id: string;
  course_id: string;
  value: number;
  comment?: string;
  graded_by: string;
  graded_at: string;
  quiz_id?: string; // 🆕 NOWE - ID quizu z którego pochodzi ocena
  quiz_title?: string; // 🆕 NOWE - tytuł quizu
  subject?: string; // 🆕 NOWE - przedmiot
  grade_type?: string; // 🆕 NOWE - typ oceny (np. "Quiz", "Sprawdzian")
}

export interface Event extends FirebaseDocument {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  type: 'assignment' | 'exam' | 'meeting' | 'other';
  course_id?: string;
  participants: string[];
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface Notification extends FirebaseDocument {
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

export interface TimeEntry extends FirebaseDocument {
  user_id: string;
  course_id?: string;
  duration: number;
  activity_type: 'course' | 'quiz' | 'assignment' | 'other';
  metadata?: Record<string, unknown>;
}

export interface Badge extends FirebaseDocument {
  name: string;
  description: string;
  icon_url: string;
  type: 'achievement' | 'skill' | 'participation';
  level: number;
  requirements: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UserStats extends FirebaseDocument {
  user_id: string;
  total_time: number;
  completed_courses: number;
  average_grade: number;
  badges_earned: number;
  current_streak: number;
  best_streak: number;
  last_activity: string;
  metadata?: Record<string, unknown>;
}

// 🆕 NOWY INTERFEJS DLA KLAS
export interface Class extends FirebaseDocument {
  name: string;
  description?: string;
  grade_level: number; // np. 1, 2, 3 dla podstawówki
  subject?: string; // opcjonalnie dla klas przedmiotowych
  teacher_id: string; // ID nauczyciela prowadzącego
  teacher_email: string;
  students: string[]; // Array z ID studentów
  assignedCourses?: string[]; // 🆕 NOWE - ID kursów przypisanych do klasy
  max_students?: number;
  is_active: boolean;
  academic_year: string; // np. "2024/2025"
  schedule?: {
    day: string;
    time: string;
    duration: number;
  }[];
  metadata?: Record<string, unknown>;
}
