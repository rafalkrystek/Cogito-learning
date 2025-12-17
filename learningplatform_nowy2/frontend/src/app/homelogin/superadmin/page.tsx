"use client";
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Link from "next/link";
import Providers from '@/components/Providers';
import { db } from "@/config/firebase";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { auth } from "@/config/firebase";
import { measureAsync } from '@/utils/perf';
import {
  BookOpen,
  Users,
  ClipboardList,
  TrendingUp,
  Clock,
  Shield,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  UserPlus,
  Group,
  GraduationCap,
  Bug,
  Filter,
  RefreshCw,
  Menu,
  X,
  Search
} from 'lucide-react';

// Typ użytkownika Firestore
interface FirestoreUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  approved?: boolean;
  banned?: boolean;
  role?: string;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  year?: number;
  teacherEmail?: string;
  assignedUsers?: string[];
  slug?: string;
}

interface Group {
  id: string;
  name?: string;
  description?: string;
  members?: string[];
  member_count?: number;
}

interface StatCard {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  color: string;
}

interface RecentActivity {
  id: string;
  type: 'user' | 'course' | 'group' | 'approval' | 'creation';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Usuwamy statyczne dane - będziemy pobierać z Firestore



function SuperAdminDashboardContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("users");
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [bugReportsLoading, setBugReportsLoading] = useState(false);
  const [bugReportsError, setBugReportsError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedUser] = useState<FirestoreUser | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState("");
  const [groupError, setGroupError] = useState("");
  const [groupSuccess, setGroupSuccess] = useState("");
  const [selectedStudentForAssignment, setSelectedStudentForAssignment] = useState("");
  const [selectedCourseForAssignment, setSelectedCourseForAssignment] = useState("");
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseYear, setNewCourseYear] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [newCourseSubject, setNewCourseSubject] = useState("");
  const [selectedTeacherForCourse, setSelectedTeacherForCourse] = useState("");
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserRole, setNewUserRole] = useState("student");
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editCourseYear, setEditCourseYear] = useState("");
  const [editCourseDescription, setEditCourseDescription] = useState("");
  const [editCourseSubject, setEditCourseSubject] = useState("");
  const [editCourseTeacher, setEditCourseTeacher] = useState("");
  const [showEditTeacherSpecializationModal, setShowEditTeacherSpecializationModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<FirestoreUser | null>(null);
  const [teacherInstructorType, setTeacherInstructorType] = useState<string>("");
  const [teacherSpecialization, setTeacherSpecialization] = useState<string>("");
  const [editCourseStudents, setEditCourseStudents] = useState<string[]>([]);
  // const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]); // Zakomentowane - nie używane
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [usersPageSize] = useState(30); // Zmniejszone z 50 do 30 dla lepszej wydajności
  const [usersPage, setUsersPage] = useState(1);
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [coursesPage, setCoursesPage] = useState(1);
  const [groupsPage, setGroupsPage] = useState(1);
  const [bugReportsPage, setBugReportsPage] = useState(1);
  const [pendingUsersPage, setPendingUsersPage] = useState(1);
  const coursesPerPage = 20;
  const groupsPerPage = 20;
  const bugReportsPerPage = 10;
  const pendingUsersPerPage = 30;

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (debouncedSearchTerm) {
        const search = debouncedSearchTerm.toLowerCase();
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        if (!fullName.includes(search) && !email.includes(search)) {
          return false;
        }
      }

      if (userRoleFilter !== 'all' && user.role !== userRoleFilter) {
        return false;
      }

      if (userStatusFilter !== 'all') {
        if (userStatusFilter === 'approved' && !user.approved) {
          return false;
        }
        if (userStatusFilter === 'pending' && user.approved) {
          return false;
        }
      }

      return true;
    });
  }, [users, debouncedSearchTerm, userRoleFilter, userStatusFilter]);
  
  // Memoized counts
  const approvedUsersCount = useMemo(() => users.filter(u => u.approved).length, [users]);
  const pendingUsersCount = useMemo(() => users.filter(u => !u.approved).length, [users]);

  const paginatedUsers = useMemo(() => {
    const end = usersPage * usersPageSize;
    return filteredUsers.slice(0, end);
  }, [filteredUsers, usersPage, usersPageSize]);

  // Cache helpers - memoized to avoid recreating on every render
  const CACHE_TTL_MS = 60 * 1000; // 60s
  const getSessionCache = useCallback(<T,>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { timestamp: number; data: T };
      if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
        sessionStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }, [CACHE_TTL_MS]);

  const setSessionCache = useCallback(<T,>(key: string, data: T) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
    } catch {
      // Ignore cache errors
    }
  }, []);

  // Memoized Maps for O(1) lookup
  const usersMap = useMemo(() => {
    const map = new Map<string, FirestoreUser>();
    users.forEach(u => map.set(u.email || '', u));
    return map;
  }, [users]);

  // Paginated courses
  const paginatedCourses = useMemo(() => {
    const startIndex = (coursesPage - 1) * coursesPerPage;
    const endIndex = startIndex + coursesPerPage;
    return courses.slice(startIndex, endIndex);
  }, [courses, coursesPage]);

  const totalCoursesPages = Math.ceil(courses.length / coursesPerPage);

  // Paginated groups
  const paginatedGroups = useMemo(() => {
    const startIndex = (groupsPage - 1) * groupsPerPage;
    const endIndex = startIndex + groupsPerPage;
    return groups.slice(startIndex, endIndex);
  }, [groups, groupsPage]);

  const totalGroupsPages = Math.ceil(groups.length / groupsPerPage);

  // Paginated bug reports
  const paginatedBugReports = useMemo(() => {
    const startIndex = (bugReportsPage - 1) * bugReportsPerPage;
    const endIndex = startIndex + bugReportsPerPage;
    return bugReports.slice(startIndex, endIndex);
  }, [bugReports, bugReportsPage]);

  const totalBugReportsPages = Math.ceil(bugReports.length / bugReportsPerPage);

  // Memoized filtered students for selects
  const studentsForSelect = useMemo(() => {
    return users.filter(u => u.role === 'student').slice(0, 100);
  }, [users]);
  
  // Memoized teachers list
  const teachersList = useMemo(() => {
    return users.filter(u => u.role === 'teacher');
  }, [users]);
  
  // Memoized pending users list
  const pendingUsersList = useMemo(() => {
    return users.filter(u => !u.approved);
  }, [users]);

  // Paginated pending users
  const paginatedPendingUsers = useMemo(() => {
    const startIndex = (pendingUsersPage - 1) * pendingUsersPerPage;
    const endIndex = startIndex + pendingUsersPerPage;
    return pendingUsersList.slice(startIndex, endIndex);
  }, [pendingUsersList, pendingUsersPage, pendingUsersPerPage]);

  const totalPendingUsersPages = Math.ceil(pendingUsersList.length / pendingUsersPerPage);

  // Memoized courses for selects (lazy loaded)
  const coursesForSelect = useMemo(() => {
    return courses.slice(0, 100);
  }, [courses]);
  
  // Memoized role colors (move outside map)
  const roleColors: { [key: string]: string } = useMemo(() => ({
    'admin': 'bg-red-500',
    'teacher': 'bg-[#4067EC]',
    'parent': 'bg-purple-500',
    'student': 'bg-green-500'
  }), []);
  
  // Memoized role labels
  const roleLabels: { [key: string]: string } = useMemo(() => ({
    'admin': '👑 Admin',
    'teacher': '👨‍🏫 Nauczyciel',
    'parent': '👨‍👩‍👧 Rodzic',
    'student': '🎓 Uczeń'
  }), []);
  
  // Memoized users for select (lazy loaded)
  const usersForSelect = useMemo(() => {
    return users.slice(0, 100);
  }, [users]);

  // Memoized UserCard component
  const UserCard = memo(({ user, roleColor, roleLabel, onApprove, onReject, onSetTeacher, onSetAdmin, onSetParent, onSetStudent, onEditSpecialization, onDelete }: {
    user: FirestoreUser;
    roleColor: string;
    roleLabel: string;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onSetTeacher: (email: string) => void;
    onSetAdmin: (id: string) => void;
    onSetParent: (id: string) => void;
    onSetStudent: (id: string) => void;
    onEditSpecialization: (user: FirestoreUser) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <div 
        key={user.id} 
        className="group bg-white dark:bg-white/10 backdrop-blur-xl rounded-xl p-4 border border-gray-200 dark:border-white/20 hover:border-gray-300 dark:hover:border-white/40 transition-all duration-300 hover:shadow-xl"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Lewa strona - informacje o użytkowniku */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`w-12 h-12 ${roleColor} rounded-xl flex items-center justify-center shadow-md flex-shrink-0`}>
              <span className="text-white font-bold text-lg">
                {user.firstName?.[0] || ''}{user.lastName?.[0] || ''}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                  {user.firstName} {user.lastName}
                </h3>
                {user.approved ? (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-500/30 border border-green-300 dark:border-green-500/50 text-green-700 dark:text-green-200 rounded-full text-xs font-semibold flex-shrink-0">
                    ✅ Zatwierdzony
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/30 border border-yellow-300 dark:border-yellow-500/50 text-yellow-700 dark:text-yellow-200 rounded-full text-xs font-semibold flex-shrink-0">
                    ⏳ Oczekuje
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-white/70 text-sm truncate">{user.email}</p>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-1 ${roleColor} text-white rounded-lg text-xs font-semibold`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Prawa strona - akcje */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!user.approved ? (
              <button 
                onClick={() => onApprove(user.id)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg hover:shadow-md transition-all duration-200"
                title="Zatwierdź użytkownika"
              >
                <CheckCircle className="h-4 w-4" />
                Zatwierdź
              </button>
            ) : (
              <button 
                onClick={() => onReject(user.id)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg hover:shadow-md transition-all duration-200"
                title="Odrzuć użytkownika"
              >
                <XCircle className="h-4 w-4" />
                Odrzuć
              </button>
            )}
            
            {user.role !== 'teacher' && (
              <button 
                onClick={() => onSetTeacher(user.email || '')}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-300 dark:border-white/30 rounded-lg transition-all duration-200"
                title="Ustaw jako nauczyciela"
              >
                <GraduationCap className="h-4 w-4" />
                Nauczyciel
              </button>
            )}
            {user.role !== 'admin' && (
              <button 
                onClick={() => onSetAdmin(user.id)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-300 dark:border-white/30 rounded-lg transition-all duration-200"
                title="Ustaw jako admina"
              >
                <Shield className="h-4 w-4" />
                Admin
              </button>
            )}
            {user.role !== 'parent' && (
              <button 
                onClick={() => onSetParent(user.id)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-300 dark:border-white/30 rounded-lg transition-all duration-200"
                title="Ustaw jako rodzica"
              >
                <Users className="h-4 w-4" />
                Rodzic
              </button>
            )}
            {user.role === 'admin' && (
              <button 
                onClick={() => onSetTeacher(user.email || '')}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-300 dark:border-white/30 rounded-lg transition-all duration-200"
                title="Ustaw jako nauczyciela"
              >
                <GraduationCap className="h-4 w-4" />
                Nauczyciel
              </button>
            )}
            {user.role === 'teacher' && (
              <>
                <button 
                  onClick={() => onSetStudent(user.id)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-300 dark:border-white/30 rounded-lg transition-all duration-200"
                  title="Ustaw jako ucznia"
                >
                  <Users className="h-4 w-4" />
                  Uczeń
                </button>
                <button 
                  onClick={() => onEditSpecialization(user)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white border border-gray-300 dark:border-white/30 rounded-lg transition-all duration-200"
                  title="Edytuj specjalizację"
                >
                  <Edit className="h-4 w-4" />
                  Spec.
                </button>
              </>
            )}
            <button 
              onClick={() => onDelete(user.id)}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200 hover:shadow-md"
              title="Usuń użytkownika"
            >
              <Trash2 className="h-4 w-4" />
              Usuń
            </button>
          </div>
        </div>
      </div>
    );
  });
  
  UserCard.displayName = 'UserCard';

  // Helper to invalidate cache - MUST be defined before functions that use it
  const invalidateCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('superadmin_users');
      sessionStorage.removeItem('superadmin_courses');
      sessionStorage.removeItem('superadmin_groups');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const cacheKey = 'superadmin_users';
    const cached = getSessionCache<FirestoreUser[]>(cacheKey);
    
    if (cached) {
      setUsers(cached);
      return;
    }

    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FirestoreUser[];
      setUsers(usersData);
      setSessionCache(cacheKey, usersData);
      console.log('Users loaded from Firestore:', usersData.length);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
    }
  }, [setError, getSessionCache, setSessionCache]);

  const fetchCourses = useCallback(async () => {
    const cacheKey = 'superadmin_courses';
    const cached = getSessionCache<Course[]>(cacheKey);
    
    if (cached) {
      setCourses(cached);
      return;
    }

    try {
      const coursesCollection = collection(db, 'courses');
      const coursesSnapshot = await getDocs(coursesCollection);
      const coursesData = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      setCourses(coursesData);
      setSessionCache(cacheKey, coursesData);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  }, [getSessionCache, setSessionCache]);

  const fetchGroups = useCallback(async () => {
    const cacheKey = 'superadmin_groups';
    const cached = getSessionCache<Group[]>(cacheKey);
    
    if (cached) {
      setGroups(cached);
      return;
    }

    try {
      const groupsCollection = collection(db, 'groups');
      const groupsSnapshot = await getDocs(groupsCollection);
      const groupsData = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      setGroups(groupsData);
      setSessionCache(cacheKey, groupsData);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  }, [getSessionCache, setSessionCache]);

  // Pobierz ostatnie aktywności
  const fetchRecentActivities = useCallback(async () => {
    if (!user?.email) return;

    try {
      const activities: RecentActivity[] = [];
      
      // Pobierz ostatnie zatwierdzenia użytkowników
      const recentUsers = users.slice(0, 3);
      recentUsers.forEach(user => {
        if (user.approved) {
          activities.push({
            id: `user-approved-${user.id}`,
            type: 'approval',
            title: 'Użytkownik zatwierdzony',
            description: `${user.firstName || ''} ${user.lastName || ''} został zatwierdzony`,
            timestamp: new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '/'),
            icon: CheckCircle
          });
        }
      });

      // Pobierz ostatnie utworzone kursy
      const recentCourses = courses.slice(0, 2);
      recentCourses.forEach(course => {
        activities.push({
          id: `course-created-${course.id}`,
          type: 'course',
          title: 'Nowy kurs utworzony',
          description: `Kurs "${course.title}" został utworzony`,
          timestamp: new Date().toLocaleString('pl-PL'),
          icon: BookOpen
        });
      });

      // Pobierz ostatnie utworzone grupy
      const recentGroups = groups.slice(0, 2);
      recentGroups.forEach(group => {
        activities.push({
          id: `group-created-${group.id}`,
          type: 'group',
          title: 'Nowa grupa utworzona',
          description: `Grupa "${group.name}" została utworzona`,
          timestamp: new Date().toLocaleString('pl-PL'),
          icon: Group
        });
      });

      // Sortuj aktywności po czasie (najnowsze pierwsze)
      activities.sort((a, b) => {
        try {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.error('Error sorting activities:', error);
          return 0;
        }
      });

      // Usuń duplikaty i weź pierwsze 4
      const uniqueActivities = activities.filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      );

      // setRecentActivities(uniqueActivities.slice(0, 4)); // Zakomentowane - nie używane
      console.log('Recent activities:', uniqueActivities.slice(0, 4));
      
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  }, [user, users, courses, groups]);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      measureAsync('Superadmin:fetchUsers', fetchUsers),
      measureAsync('Superadmin:fetchCourses', fetchCourses),
      measureAsync('Superadmin:fetchGroups', fetchGroups),
    ]).finally(() => {
      setLoading(false);
    });
  }, [fetchUsers, fetchCourses, fetchGroups]);

  // Funkcja do pobierania zgłoszeń błędów
  const fetchBugReports = useCallback(async () => {
    try {
      setBugReportsLoading(true);
      setBugReportsError('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Brak użytkownika zalogowanego');
      }

      // Odśwież token, aby uzyskać najnowsze custom claims
      // forceRefresh: true wymusza odświeżenie tokenu z Firebase
      console.log('🔍 Fetching bug reports - refreshing token...');
      const token = await currentUser.getIdToken(true); // forceRefresh = true
      if (!token) {
        throw new Error('Brak tokenu autoryzacyjnego');
      }

      console.log('🔍 Token obtained, user role from context:', user?.role);
      console.log('🔍 User email:', currentUser.email);

      let url = '/api/bug-reports?';
      if (statusFilter !== 'all') {
        url += `status=${statusFilter}&`;
      }
      if (categoryFilter !== 'all') {
        url += `category=${encodeURIComponent(categoryFilter)}&`;
      }

      console.log('🔍 Fetching from URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error response:', errorData);
        console.error('❌ Response status:', response.status);
        console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.status === 403) {
          const errorMsg = errorData.error || 'Brak uprawnień. Wymagana rola: Administrator';
          console.error('❌ 403 Forbidden - User role:', user?.role, 'User email:', currentUser.email);
          console.error('❌ Debug info:', errorData._debug);
          
          // Jeśli backend zwrócił informacje diagnostyczne, użyj ich
          if (errorData._debug) {
            console.error('❌ Backend debug:', errorData._debug);
          }
          
          // Dodaj pomocny komunikat jeśli użytkownik ma rolę admin w kontekście, ale nie w tokenie
          if (user?.role === 'admin') {
            throw new Error(`${errorMsg}\n\nTwoje konto ma rolę administratora w Firestore, ale backend nie może zweryfikować uprawnień. Sprawdź logi backendu lub skontaktuj się z administratorem.`);
          }
          throw new Error(errorMsg);
        }
        
        // Dla innych błędów HTTP
        const errorMessage = errorData.error || errorData.detail || `Błąd podczas pobierania zgłoszeń (status: ${response.status})`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Bug reports fetched successfully:', data.count || 0, 'reports');
      setBugReports(data.reports || []);
    } catch (err: any) {
      console.error('❌ Error fetching bug reports:', err);
      console.error('❌ Error type:', err?.constructor?.name);
      console.error('❌ Error stack:', err?.stack);
      
      // Sprawdź typ błędu
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setBugReportsError('Błąd połączenia z serwerem. Sprawdź połączenie internetowe lub spróbuj ponownie później.');
      } else if (err.name === 'AbortError') {
        setBugReportsError('Żądanie przekroczyło limit czasu. Spróbuj ponownie.');
      } else {
        const errorMessage = err.message || 'Wystąpił błąd podczas pobierania zgłoszeń';
        setBugReportsError(errorMessage);
      }
    } finally {
      setBugReportsLoading(false);
    }
  }, [statusFilter, categoryFilter, user]);

  // Pobierz zgłoszenia gdy zakładka jest aktywna
  useEffect(() => {
    if (activeTab === 'bug-reports' && user) {
      fetchBugReports();
    }
  }, [activeTab, user, fetchBugReports]);

  // Funkcja do aktualizacji statusu zgłoszenia
  const updateBugReportStatus = async (reportId: string, newStatus: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Brak użytkownika zalogowanego');
      }

      const token = await currentUser.getIdToken();
      if (!token) {
        throw new Error('Brak tokenu autoryzacyjnego');
      }

      const response = await fetch(`/api/bug-reports/${reportId}/status/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas aktualizacji statusu');
      }

      // Odśwież listę zgłoszeń
      await fetchBugReports();
      setSuccess('Status zgłoszenia został zaktualizowany');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setBugReportsError(err.message || 'Wystąpił błąd podczas aktualizacji statusu');
      console.error('Error updating status:', err);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    if (users.length > 0 && courses.length > 0 && groups.length > 0) {
      fetchRecentActivities();
    }
  }, [users, courses, groups, fetchRecentActivities]);

  const setTeacherRole = useCallback(async (email: string) => {
    try {
      // Znajdź użytkownika po email w Firestore
      const { collection, query, where, getDocs, updateDoc, doc } = await import('firebase/firestore');
      const usersCollection = collection(db, 'users');
      const q = query(usersCollection, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('User not found');
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      // Użyj ID dokumentu jako UID (w Firestore ID dokumentu to UID użytkownika)
      const userUid = userDoc.id || userData.uid;
      
      if (!userUid) {
        setError('Nie można znaleźć UID użytkownika');
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      // Aktualizuj rolę w Firestore
      await updateDoc(doc(db, 'users', userUid), {
        role: 'teacher',
        approved: true
      });
      
      // Ustaw custom claims w Firebase Auth (ważne dla uprawnień)
      try {
        console.log('Setting custom claims for user:', userUid);
        const response = await fetch('/api/set-teacher-role-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: userUid })
        });
        
        if (response.ok) {
          console.log('✅ Custom claims set successfully for teacher');
          
          // Poinformuj użytkownika, że powinien się wylogować i zalogować ponownie
          setSuccess(`Nauczyciel ${email} został ustawiony! Użytkownik powinien się wylogować i zalogować ponownie, aby uzyskać pełne uprawnienia.`);
        } else {
          const errorData = await response.json();
          console.error('❌ Failed to set Firebase Auth custom claims:', errorData);
          setError('Nie udało się ustawić uprawnień Firebase Auth: ' + (errorData.error || 'Unknown error'));
        }
      } catch (authError) {
        console.error('❌ Error setting Firebase Auth custom claims:', authError);
        setError('Błąd podczas ustawiania uprawnień Firebase Auth: ' + (authError instanceof Error ? authError.message : 'Unknown error'));
      }
      
      invalidateCache();
      setTimeout(() => setSuccess(''), 5000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error setting teacher role:', err);
      setError('Failed to set teacher role');
      setTimeout(() => setError(''), 3000);
    }
  }, [invalidateCache, fetchUsers]);

  const setAdminRole = useCallback(async (uid: string) => {
    try {
      // Znajdź użytkownika po ID w Firestore
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', uid), {
        role: 'admin',
        approved: true
      });
      
      // Ustaw custom claims w Firebase Auth (ważne dla uprawnień)
      try {
        const response = await fetch('/api/set-admin-role-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: uid })
        });
        
        if (!response.ok) {
          console.error('Failed to set Firebase Auth custom claims');
        }
      } catch (authError) {
        console.error('Error setting Firebase Auth custom claims:', authError);
      }
      
      invalidateCache();
      setSuccess(`Successfully set user as admin`);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error setting admin role:', err);
      setError('Failed to set admin role');
      setTimeout(() => setError(''), 3000);
    }
  }, [invalidateCache, fetchUsers]);

  const setStudentRole = useCallback(async (uid: string) => {
    try {
      // Znajdź użytkownika po ID w Firestore
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', uid), {
        role: 'student'
      });
      
      invalidateCache();
      setSuccess(`Successfully set user as student`);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error setting student role:', err);
      setError('Failed to set student role');
      setTimeout(() => setError(''), 3000);
    }
  }, [invalidateCache, fetchUsers]);

  const setParentRole = useCallback(async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: 'parent'
      });
      
      invalidateCache();
      setSuccess(`Pomyślnie ustawiono użytkownika jako Rodzic`);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error setting parent role:', err);
      setError('Nie udało się ustawić roli Rodzic');
      setTimeout(() => setError(''), 3000);
    }
  }, [invalidateCache, fetchUsers]);

  const approveUser = useCallback(async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        approved: true
      });
      
      invalidateCache();
      setSuccess(`Użytkownik został zatwierdzony`);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error approving user:', err);
      setError('Nie udało się zatwierdzić użytkownika');
      setTimeout(() => setError(''), 3000);
    }
  }, [invalidateCache, fetchUsers]);

  const rejectUser = useCallback(async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        approved: false
      });
      
      invalidateCache();
      setSuccess(`Użytkownik został odrzucony`);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error rejecting user:', err);
      setError('Nie udało się odrzucić użytkownika');
      setTimeout(() => setError(''), 3000);
    }
  }, [invalidateCache, fetchUsers]);

  const saveTeacherSpecialization = useCallback(async () => {
    if (!editingTeacher) return;
    
    try {
      const specializationArray = teacherSpecialization
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      await updateDoc(doc(db, 'users', editingTeacher.id), {
        instructorType: teacherInstructorType || null,
        specialization: specializationArray.length > 0 ? specializationArray : null
      });
      
      invalidateCache();
      setSuccess(`Specjalizacja nauczyciela została zaktualizowana`);
      setTimeout(() => setSuccess(''), 3000);
      setShowEditTeacherSpecializationModal(false);
      setEditingTeacher(null);
      setTeacherInstructorType('');
      setTeacherSpecialization('');
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error saving teacher specialization:', err);
      setError('Nie udało się zapisać specjalizacji');
      setTimeout(() => setError(''), 3000);
    }
  }, [editingTeacher, teacherInstructorType, teacherSpecialization, invalidateCache, fetchUsers]);

  const deleteUser = useCallback(async (uid: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego użytkownika? Ta operacja jest nieodwracalna.')) {
      return;
    }
    
    try {
      // Najpierw upewnij się, że administrator ma custom claims
      if (user?.role === 'admin') {
        try {
          const response = await fetch('/api/set-admin-role-api', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uid: user.uid })
          });
          
          if (response.ok) {
            console.log('✅ Admin custom claims updated');
            // Refresh token to get new custom claims
            const { getAuth } = await import('firebase/auth');
            const auth = getAuth();
            if (auth.currentUser) {
              const token = await auth.currentUser.getIdToken(true);
              sessionStorage.setItem('token', token);
            }
          }
        } catch (authError) {
          console.error('Error updating admin custom claims:', authError);
        }
      }
      
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', uid));
      
      setSuccess(`Użytkownik został usunięty`);
      setTimeout(() => setSuccess(''), 3000);
      fetchUsers(); // Refresh the list
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Nie udało się usunąć użytkownika: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setTimeout(() => setError(''), 5000);
    }
  }, [user, fetchUsers]);







  const handleResetPassword = async (userId: string) => {
    try {
      const token = sessionStorage.getItem("token") || sessionStorage.getItem("firebaseToken");
              const response = await fetch(`/api/users/${userId}/reset_password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetPasswordSuccess("Password has been reset successfully");
        setResetPasswordError("");
        setShowResetPasswordModal(false);
        setNewPassword("");
      } else {
        setResetPasswordError(data.error || "Failed to reset password");
        setResetPasswordSuccess("");
      }
    } catch {
      setResetPasswordError("An error occurred while resetting the password");
      setResetPasswordSuccess("");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCreateGroup = async () => {
    try {
      const token = sessionStorage.getItem("token") || sessionStorage.getItem("firebaseToken");
              const response = await fetch("/api/groups/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setGroupSuccess("Group created successfully");
        setGroupError("");
        setShowCreateGroupModal(false);
        setNewGroupName("");
        setNewGroupDescription("");
      } else {
        setGroupError(data.error || "Failed to create group");
        setGroupSuccess("");
      }
    } catch {
      setGroupError("An error occurred while creating the group");
      setGroupSuccess("");
    }
  };

  const handleAddMember = async (groupId: string, userId: string) => {
    try {
      const token = sessionStorage.getItem("token") || sessionStorage.getItem("firebaseToken");
              const response = await fetch(`/api/groups/${groupId}/add_member/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();

      if (response.ok) {
        setGroupSuccess("Member added successfully");
        setGroupError("");
        setShowAddMemberModal(false);
      } else {
        setGroupError(data.error || "Failed to add member");
        setGroupSuccess("");
      }
    } catch {
      setGroupError("An error occurred while adding the member");
      setGroupSuccess("");
    }
  };


  const deleteCourse = async (courseId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten kurs? Ta operacja jest nieodwracalna.')) {
      return;
    }
    
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'courses', courseId));
      invalidateCache();
      setSuccess('Kurs został pomyślnie usunięty');
      fetchCourses(); // Refresh the list
    } catch (error) {
      console.error('Error deleting course:', error);
      setError('Błąd podczas usuwania kursu');
    }
  };

  const deleteGroup = async (groupId: string) => {
    invalidateCache();
    if (!confirm('Czy na pewno chcesz usunąć tę grupę? Ta operacja jest nieodwracalna.')) {
      return;
    }
    
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'groups', groupId));
      invalidateCache();
      setGroupSuccess('Grupa została pomyślnie usunięta');
      fetchGroups(); // Refresh the list
    } catch (error) {
      console.error('Error deleting group:', error);
      setGroupError('Błąd podczas usuwania grupy');
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      setGroupError('Nazwa grupy jest wymagana');
      return;
    }
    
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        description: newGroupDescription,
        members: [],
        created_at: new Date().toISOString(),
        created_by: user?.email || 'admin'
      });
      
      setGroupSuccess('Grupa została pomyślnie utworzona');
      invalidateCache();
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateGroupModal(false);
      fetchGroups(); // Refresh the list
    } catch (error) {
      console.error('Error creating group:', error);
      setGroupError('Błąd podczas tworzenia grupy');
    }
  };

  const assignCourseToStudent = async () => {
    if (!selectedStudentForAssignment || !selectedCourseForAssignment) {
      setError('Wybierz studenta i kurs');
      return;
    }
    
    try {
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      
      // Pobierz kurs
      const courseDoc = await getDoc(doc(db, 'courses', selectedCourseForAssignment));
      if (!courseDoc.exists()) {
        setError('Kurs nie został znaleziony');
        return;
      }
      
      const courseData = courseDoc.data();
      const assignedUsers = courseData.assignedUsers || [];
      
      // Sprawdź czy student już jest przypisany
      if (assignedUsers.includes(selectedStudentForAssignment)) {
        setError('Student jest już przypisany do tego kursu');
        return;
      }
      
      // Dodaj studenta do listy przypisanych użytkowników
      assignedUsers.push(selectedStudentForAssignment);
      
      // Zaktualizuj kurs
      await updateDoc(doc(db, 'courses', selectedCourseForAssignment), {
        assignedUsers: assignedUsers
      });
      
      setSuccess('Kurs został pomyślnie przypisany do studenta');
      setSelectedStudentForAssignment('');
      setSelectedCourseForAssignment('');
      fetchCourses(); // Refresh courses to update assignment count
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error assigning course:', error);
      setError('Błąd podczas przypisywania kursu');
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000);
    }
  };

  const createCourse = async () => {
    if (!newCourseTitle.trim() || !newCourseYear.trim() || !newCourseSubject.trim() || !selectedTeacherForCourse) {
      setError('Wypełnij wszystkie wymagane pola');
      return;
    }
    
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      
      // Generuj slug z tytułu kursu
      const generateSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Usuń znaki specjalne
          .replace(/\s+/g, '-') // Zamień spacje na myślniki
          .replace(/-+/g, '-') // Usuń podwójne myślniki
          .trim();
      };
      
      const slug = generateSlug(newCourseTitle);
      
      const courseData = {
        title: newCourseTitle,
        year: parseInt(newCourseYear),
        description: newCourseDescription,
        subject: newCourseSubject,
        teacherEmail: selectedTeacherForCourse,
        assignedUsers: [],
        lessons: [],
        materials: [],
        assignments: [],
        slug: slug,
        created_at: new Date().toISOString(),
        created_by: user?.email || 'admin',
        status: 'active'
      };
      
      await addDoc(collection(db, 'courses'), courseData);
      
      invalidateCache();
      setSuccess('Kurs został pomyślnie utworzony');
      setNewCourseTitle('');
      setNewCourseYear('');
      setNewCourseDescription('');
      setNewCourseSubject('');
      setSelectedTeacherForCourse('');
      setShowCreateCourseModal(false);
      fetchCourses(); // Refresh the list
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating course:', error);
      setError('Błąd podczas tworzenia kursu');
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000);
    }
  };

  const createUser = async () => {
    if (!newUserEmail.trim() || !newUserFirstName.trim() || !newUserLastName.trim()) {
      setError('Wypełnij wszystkie wymagane pola');
      return;
    }
    
    try {
      const { addDoc, collection } = await import('firebase/firestore');
      const userData = {
        email: newUserEmail,
        firstName: newUserFirstName,
        lastName: newUserLastName,
        role: newUserRole,
        approved: true,
        banned: false,
        created_at: new Date().toISOString(),
        created_by: user?.email || 'admin'
      };
      
      await addDoc(collection(db, 'users'), userData);
      
      invalidateCache();
      setSuccess('Użytkownik został pomyślnie utworzony');
      setNewUserEmail('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setNewUserRole('student');
      setShowCreateUserModal(false);
      fetchUsers(); // Refresh the list
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Błąd podczas tworzenia użytkownika');
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000);
    }
  };

  const openEditCourseModal = (course: Course) => {
    setEditingCourse(course);
    setEditCourseTitle(course.title || '');
    setEditCourseYear(course.year?.toString() || '');
    setEditCourseDescription(course.description || '');
    setEditCourseSubject(course.subject || '');
    setEditCourseTeacher(course.teacherEmail || '');
    setEditCourseStudents(course.assignedUsers || []);
    setShowEditCourseModal(true);
  };

  const updateCourse = async () => {
    if (!editingCourse || !editCourseTitle.trim() || !editCourseYear.trim() || !editCourseSubject.trim()) {
      setError('Wypełnij wszystkie wymagane pola');
      return;
    }
    
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      
      // Generuj slug z tytułu kursu
      const generateSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Usuń znaki specjalne
          .replace(/\s+/g, '-') // Zamień spacje na myślniki
          .replace(/-+/g, '-') // Usuń podwójne myślniki
          .trim();
      };
      
      const slug = generateSlug(editCourseTitle);
      
      const courseData = {
        title: editCourseTitle,
        year: parseInt(editCourseYear),
        description: editCourseDescription,
        subject: editCourseSubject,
        teacherEmail: editCourseTeacher,
        assignedUsers: editCourseStudents,
        slug: slug,
        updated_at: new Date().toISOString(),
        updated_by: user?.email || 'admin'
      };
      
      await updateDoc(doc(db, 'courses', editingCourse.id), courseData);
      
      invalidateCache();
      setSuccess('Kurs został pomyślnie zaktualizowany');
      setShowEditCourseModal(false);
      setEditingCourse(null);
      fetchCourses(); // Refresh the list
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating course:', error);
      setError('Błąd podczas aktualizacji kursu');
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000);
    }
  };

  const removeStudentFromCourse = (studentEmail: string) => {
    setEditCourseStudents(prev => prev.filter(email => email !== studentEmail));
  };

  const addStudentToCourse = (studentEmail: string) => {
    if (!editCourseStudents.includes(studentEmail)) {
      setEditCourseStudents(prev => [...prev, studentEmail]);
    }
  };

  // Funkcja do aktualizacji istniejących kursów bez slug
  const updateExistingCoursesWithSlug = async () => {
    try {
      const { collection, getDocs, updateDoc, doc } = await import('firebase/firestore');
      const coursesCollection = collection(db, 'courses');
      const coursesSnapshot = await getDocs(coursesCollection);
      
      const generateSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      };
      
      let updatedCount = 0;
      
      for (const courseDoc of coursesSnapshot.docs) {
        const courseData = courseDoc.data();
        if (!courseData.slug && courseData.title) {
          const slug = generateSlug(courseData.title);
          await updateDoc(doc(db, 'courses', courseDoc.id), {
            slug: slug
          });
          updatedCount++;
        }
      }
      
      if (updatedCount > 0) {
        setSuccess(`Zaktualizowano ${updatedCount} kursów z slug`);
        fetchCourses(); // Refresh the list
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error updating courses with slug:', error);
      setError('Błąd podczas aktualizacji kursów');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Map of edit specialization handlers - created before conditional return to maintain hook order
  const editSpecializationHandlers = useMemo(() => {
    const handlers: { [key: string]: (user: FirestoreUser) => void } = {};
    paginatedUsers.forEach((u) => {
      handlers[u.id] = (user: FirestoreUser) => {
        setEditingTeacher(user);
        const teacherDoc = doc(db, 'users', user.id);
        getDoc(teacherDoc).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTeacherInstructorType(data.instructorType || '');
            setTeacherSpecialization(Array.isArray(data.specialization) ? data.specialization.join(', ') : (data.specialization || ''));
          }
        });
        setShowEditTeacherSpecializationModal(true);
      };
    });
    return handlers;
  }, [paginatedUsers]);

  // Memoized handlers - MUSI być przed warunkowym return
  const clearSearchHandler = useCallback(() => setSearchTerm(""), []);
  const loadMoreUsersHandler = useCallback(() => setUsersPage((prev) => prev + 1), []);
  const prevPendingUsersPageHandler = useCallback(() => setPendingUsersPage(p => Math.max(1, p - 1)), []);
  const nextPendingUsersPageHandler = useCallback(() => setPendingUsersPage(p => Math.min(totalPendingUsersPages, p + 1)), [totalPendingUsersPages]);

  // Memoized user count display - MUSI być przed warunkowym return
  const userCountDisplay = useMemo(() => {
    const filteredCount = filteredUsers.length;
    const displayedCount = Math.min(filteredCount, usersPage * usersPageSize);
    return (
      <div className="mb-4 text-sm text-gray-600 dark:text-white/70">
        Wyświetlono{' '}
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          {displayedCount}
        </span>{' '}
        z <span className="font-semibold">{filteredCount}</span> dopasowanych użytkowników
      </div>
    );
  }, [filteredUsers.length, usersPage, usersPageSize]);

  // Memoized stat cards - MUSI być przed warunkowym return, aby zachować kolejność hooków
  const statCards: StatCard[] = useMemo(() => [
    {
      title: "Wszyscy Użytkownicy",
      value: users.length.toString(),
      description: "zarejestrowanych użytkowników",
      icon: Users,
      color: "bg-blue-500"
    },
    {
      title: "Oczekujący na zatwierdzenie", 
      value: pendingUsersCount.toString(),
      description: "użytkowników czeka",
      icon: Clock,
      color: "bg-yellow-500"
    },
    {
      title: "Kursy",
      value: courses.length.toString(),
      description: "aktywnych kursów",
      icon: BookOpen,
      color: "bg-green-500"
    },
    {
      title: "Grupy",
      value: groups.length.toString(),
      description: "utworzonych grup",
      icon: Group,
      color: "bg-purple-500"
    },
  ], [users.length, pendingUsersCount, courses.length, groups.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4067EC]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-white/10 backdrop-blur-xl border-b border-gray-200 dark:border-white/20 z-50 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#4067EC] rounded-xl flex items-center justify-center shadow-md">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Panel Administratora</h1>
              <p className="text-xs text-gray-600 dark:text-white/70">Zarządzanie systemem</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-white/10 rounded-lg backdrop-blur-sm">
            <div className="w-8 h-8 bg-[#4067EC] rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">
                {(user as any)?.displayName?.[0] || user?.email?.[0] || 'A'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {(user as any)?.displayName || user?.email?.split('@')[0] || 'Administrator'}
              </p>
              <p className="text-xs text-gray-600 dark:text-white/70">Super Admin</p>
            </div>
          </div>
          <ThemeToggle />
          <Link 
            href="/login" 
            className="px-4 py-2 bg-red-500 hover:bg-red-600 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-white dark:text-red-200 rounded-lg transition-colors font-medium border border-red-500 dark:border-red-500/30"
          >
            <span className="hidden sm:inline">Wyloguj</span>
            <span className="sm:hidden">Exit</span>
          </Link>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white dark:bg-white/5 backdrop-blur-2xl border-r border-gray-200 dark:border-white/10 z-40 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 h-full overflow-y-auto">
          <nav className="space-y-2">
            {[
              { id: "users", label: "Użytkownicy", icon: Users, color: "bg-[#4067EC]" },
              { id: "pending", label: `Oczekujący (${pendingUsersCount})`, icon: Clock, color: "bg-yellow-500" },
              { id: "groups", label: "Grupy", icon: Group, color: "bg-purple-500" },
              { id: "courses", label: "Kursy", icon: BookOpen, color: "bg-green-500" },
              { id: "assignments", label: "Przypisania", icon: ClipboardList, color: "bg-indigo-500" },
              { id: "bug-reports", label: "Zgłoszenia błędów", icon: Bug, color: "bg-red-500" },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? `${tab.color} text-white shadow-md scale-105`
                      : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 hover:scale-102'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-white/10 group-hover:bg-gray-300 dark:group-hover:bg-white/20'} transition-colors`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-600 dark:text-white/70 group-hover:text-gray-800 dark:group-hover:text-white'} transition-colors`} />
                  </div>
                  <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-600 dark:text-white/70 group-hover:text-gray-800 dark:group-hover:text-white'} transition-colors`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
            <Link
              href="/homelogin/superadmin/parent-student"
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all duration-200 group hover:scale-102"
            >
              <div className="p-2 rounded-lg bg-gray-200 dark:bg-white/10 group-hover:bg-gray-300 dark:group-hover:bg-white/20 transition-colors">
                <UserPlus className="w-5 h-5 text-gray-700 dark:text-white/70 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
              </div>
              <span className="font-medium text-gray-700 dark:text-white/70 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Rodzic-Uczeń
              </span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-20 transition-all duration-300 lg:pl-72`}>
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-600/20 dark:via-purple-600/20 dark:to-pink-600/20 backdrop-blur-xl rounded-3xl p-8 border border-gray-200 dark:border-white/20 shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-2">
                    Witaj, <span className="text-[#4067EC] dark:text-blue-400">
                      {(user as any)?.displayName || user?.email?.split('@')[0] || 'Administratorze'}
                    </span>!
                  </h1>
                  <p className="text-gray-700 dark:text-white/80 text-lg">
                    Zarządzaj całym systemem edukacyjnym z jednego miejsca
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="px-6 py-3 bg-[#4067EC] hover:bg-[#3155d4] text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span className="hidden sm:inline">Dodaj użytkownika</span>
                    <span className="sm:hidden">Dodaj</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stat Cards - Stonowane kolory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div 
                  key={index} 
                  className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{stat.title}</h3>
                    <div className={`p-3 ${stat.color} rounded-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{stat.value}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    {stat.trend === "up" && <TrendingUp className="inline h-4 w-4 mr-1 text-green-500" />}
                    {stat.description}
                  </p>
                </div>
              );
            })}
          </div>



          {/* Content based on active tab */}
          {activeTab === "users" && (
              <div className="bg-white dark:bg-white/10 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/20 shadow-2xl overflow-hidden">
                <div className="p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Zarządzanie użytkownikami</h2>
                      <p className="text-gray-600 dark:text-white/70">Zarządzaj wszystkimi użytkownikami systemu</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-white/70 text-center sm:text-left">
                        <span className="font-medium text-green-600 dark:text-green-300">{approvedUsersCount}</span> zatwierdzonych, 
                        <span className="font-medium text-yellow-600 dark:text-yellow-300"> {pendingUsersCount}</span> oczekuje
                      </div>
                      <button 
                        onClick={() => setShowCreateUserModal(true)}
                        className="bg-[#4067EC] hover:bg-[#3155d4] text-white px-6 py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all duration-200 font-semibold flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Dodaj użytkownika</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Licznik wyników - memoized */}
                  {userCountDisplay}

                  {/* Wyszukiwarka i Filtry */}
                  <div className="mb-6 space-y-4">
                    {/* Wyszukiwarka */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-white/50" />
                      <input
                        type="text"
                        placeholder="Wyszukaj użytkownika po imieniu, nazwisku lub emailu..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                      />
                      {searchTerm && (
                        <button
                          onClick={clearSearchHandler}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-white/50 hover:text-gray-600 dark:hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Filtry */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Filtr po roli */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Filter className="w-4 h-4 inline mr-1" />
                          Rola
                        </label>
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-white/20 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                        >
                          <option value="all">Wszystkie role</option>
                          <option value="admin">👑 Admin</option>
                          <option value="teacher">👨‍🏫 Nauczyciel</option>
                          <option value="parent">👨‍👩‍👧 Rodzic</option>
                          <option value="student">🎓 Uczeń</option>
                        </select>
                      </div>

                      {/* Filtr po statusie */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <Filter className="w-4 h-4 inline mr-1" />
                          Status
                        </label>
                        <select
                          value={userStatusFilter}
                          onChange={(e) => setUserStatusFilter(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-white/20 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                        >
                          <option value="all">Wszystkie statusy</option>
                          <option value="approved">✅ Zatwierdzony</option>
                          <option value="pending">⏳ Oczekuje</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {success && (
                    <div className="mb-4 bg-green-100 dark:bg-green-500/20 border border-green-300 dark:border-green-500/50 text-green-800 dark:text-green-200 px-4 py-3 rounded-xl text-sm backdrop-blur-sm">
                      {success}
                    </div>
                  )}
                  {error && (
                    <div className="mb-4 bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/50 text-red-800 dark:text-red-200 px-4 py-3 rounded-xl text-sm backdrop-blur-sm">
                      {error}
                    </div>
                  )}
                  {resetPasswordSuccess && (
                    <div className="mb-4 bg-green-100 dark:bg-green-500/20 border border-green-300 dark:border-green-500/50 text-green-800 dark:text-green-200 px-4 py-3 rounded-xl text-sm backdrop-blur-sm">
                      {resetPasswordSuccess}
                    </div>
                  )}
                  
                  {/* Lista użytkowników */}
                  <div className="space-y-3">
                    {paginatedUsers.map((user) => {
                        const roleColor = roleColors[user.role || 'student'] || 'bg-gray-500';
                        const roleLabel = roleLabels[user.role || 'student'] || '🎓 Uczeń';
                        return (
                          <UserCard
                            key={user.id}
                            user={user}
                            roleColor={roleColor}
                            roleLabel={roleLabel}
                            onApprove={approveUser}
                            onReject={rejectUser}
                            onSetTeacher={setTeacherRole}
                            onSetAdmin={setAdminRole}
                            onSetParent={setParentRole}
                            onSetStudent={setStudentRole}
                            onEditSpecialization={editSpecializationHandlers[user.id] || (() => {})}
                            onDelete={deleteUser}
                          />
                        );
                      })}
                    {filteredUsers.length === 0 && (
                      <div className="text-center py-12 text-gray-500 dark:text-white/50">
                        <p className="text-lg">Brak użytkowników do wyświetlenia</p>
                        {(debouncedSearchTerm || userRoleFilter !== 'all' || userStatusFilter !== 'all') && (
                          <p className="text-sm mt-2">Spróbuj zmienić kryteria wyszukiwania lub filtry</p>
                        )}
                      </div>
                    )}
                    
                    {/* Load More button - tylko jeśli są jeszcze użytkownicy do załadowania */}
                    {filteredUsers.length > paginatedUsers.length && (
                      <div className="flex justify-center mt-6">
                        <button
                          type="button"
                          onClick={loadMoreUsersHandler}
                          className="px-6 py-3 text-sm font-semibold bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-xl border border-gray-300 dark:border-white/30 transition-all duration-200 hover:shadow-md"
                        >
                          Załaduj więcej użytkowników ({filteredUsers.length - paginatedUsers.length} pozostało)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "pending" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Oczekujący na zatwierdzenie</h2>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-yellow-600">{pendingUsersCount}</span> użytkowników oczekuje na zatwierdzenie
                </div>
              </div>
              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                  {success}
                </div>
              )}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                  {error}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedPendingUsers.map((user) => (
                      <tr key={user.id} className="bg-yellow-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Oczekuje na zatwierdzenie
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {user.role === 'admin' ? 'Admin' : 
                             user.role === 'teacher' ? 'Teacher' : 
                             user.role === 'parent' ? 'Rodzic' : 'Student'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => approveUser(user.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 transition-colors"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Zatwierdź
                            </button>
                            <button 
                              onClick={() => rejectUser(user.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors"
                            >
                              <XCircle className="h-3 w-3" />
                              Odrzuć
                            </button>
                            <button 
                              onClick={() => deleteUser(user.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors"
                              title="Usuń użytkownika"
                            >
                              <Trash2 className="h-3 w-3" />
                              Usuń
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingUsersList.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Wszyscy użytkownicy zostali zatwierdzeni! 🎉
                  </div>
                )}
                
                {/* Pagination for pending users */}
                {totalPendingUsersPages > 1 && (
                  <div className="mt-6 flex justify-center items-center gap-2 px-6">
                    <button
                      onClick={prevPendingUsersPageHandler}
                      disabled={pendingUsersPage <= 1}
                      className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Poprzednia
                    </button>
                    
                    <span className="px-4 py-2 text-sm text-gray-700">
                      Strona {pendingUsersPage} z {totalPendingUsersPages} ({pendingUsersList.length} oczekujących)
                    </span>
                    
                    <button
                      onClick={nextPendingUsersPageHandler}
                      disabled={pendingUsersPage >= totalPendingUsersPages}
                      className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Następna
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

            {activeTab === "groups" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Zarządzanie grupami</h2>
                <button 
                  onClick={() => setShowCreateGroupModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Utwórz grupę
                </button>
              </div>
              {groupSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                  {groupSuccess}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Group Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Members
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedGroups.map((group) => (
                      <tr key={group.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{group.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{group.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{group.member_count} members</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowAddMemberModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors mr-3"
                          >
                            <UserPlus className="h-3 w-3" />
                            Add Member
                          </button>
                          <button className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors mr-3">
                            <Edit className="h-3 w-3" />
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteGroup(group.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination for groups */}
              {totalGroupsPages > 1 && (
                <div className="mt-6 flex justify-center items-center gap-2 px-6">
                  <button
                    onClick={() => setGroupsPage(p => Math.max(1, p - 1))}
                    disabled={groupsPage <= 1}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Poprzednia
                  </button>
                  
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Strona {groupsPage} z {totalGroupsPages} ({groups.length} grup)
                  </span>
                  
                  <button
                    onClick={() => setGroupsPage(p => Math.min(totalGroupsPages, p + 1))}
                    disabled={groupsPage >= totalGroupsPages}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Następna
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

            {activeTab === "courses" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Zarządzanie kursami</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={updateExistingCoursesWithSlug}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm hover:shadow-md"
                  >
                    Aktualizuj slugi
                  </button>
                  <button 
                    onClick={() => setShowCreateCourseModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj kurs
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Year
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teacher
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedCourses.map((course) => (
                      <tr key={course.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {course.slug ? (
                              <Link 
                                href={`/courses/${course.slug}`}
                                className="text-[#4067EC] hover:text-[#3155d4] hover:underline"
                              >
                                {course.title}
                              </Link>
                            ) : (
                              course.title
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">Year {course.year}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {course.teacherEmail ? (
                              (() => {
                                const teacher = usersMap.get(course.teacherEmail || '');
                                return teacher ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() : 'Not assigned';
                              })()
                            ) : 'Not assigned'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {course.assignedUsers ? course.assignedUsers.length : 0} students
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => openEditCourseModal(course)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors mr-3"
                          >
                            <Edit className="h-3 w-3" />
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteCourse(course.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination for courses */}
              {totalCoursesPages > 1 && (
                <div className="mt-6 flex justify-center items-center gap-2 px-6">
                  <button
                    onClick={() => setCoursesPage(p => Math.max(1, p - 1))}
                    disabled={coursesPage <= 1}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Poprzednia
                  </button>
                  
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Strona {coursesPage} z {totalCoursesPages} ({courses.length} kursów)
                  </span>
                  
                  <button
                    onClick={() => setCoursesPage(p => Math.min(totalCoursesPages, p + 1))}
                    disabled={coursesPage >= totalCoursesPages}
                    className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Następna
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

            {activeTab === "assignments" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Przypisania kursów</h2>
              </div>
              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                  {success}
                </div>
              )}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Assign Course to Student</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Select Student</label>
                      <select 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                        value={selectedStudentForAssignment}
                        onChange={(e) => setSelectedStudentForAssignment(e.target.value)}
                      >
                        <option value="">Select a student...</option>
                        {studentsForSelect.map((user: FirestoreUser) => (
                          <option key={user.id} value={user.email}>{user.firstName || ''} {user.lastName || ''}</option>
                        ))}
                        {users.filter(u => u.role === 'student').length > 100 && (
                          <option disabled>... i {users.filter(u => u.role === 'student').length - 100} więcej (użyj wyszukiwarki)</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Select Course</label>
                      <select 
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                        value={selectedCourseForAssignment}
                        onChange={(e) => setSelectedCourseForAssignment(e.target.value)}
                      >
                        <option value="">Select a course...</option>
                        {coursesForSelect.map(course => (
                          <option key={course.id} value={course.id}>{course.title}</option>
                        ))}
                        {courses.length > 100 && (
                          <option disabled>... i {courses.length - 100} więcej</option>
                        )}
                      </select>
                    </div>
                    <button 
                      onClick={assignCourseToStudent}
                      className="w-full bg-[#4067EC] text-white px-4 py-2 rounded-lg hover:bg-[#3155d4] transition"
                    >
                      Assign Course
                    </button>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Current Assignments</h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {coursesForSelect.map(course => (
                      <div key={course.id} className="border-b pb-4">
                        <h4 className="font-medium text-gray-800">{course.title}</h4>
                        <p className="text-sm text-gray-500">{course.assignedUsers ? course.assignedUsers.length : 0} students assigned</p>
                        <button className="text-[#4067EC] hover:text-[#3155d4] text-sm mt-2">
                          View Details
                        </button>
                      </div>
                    ))}
                    {courses.length > 100 && (
                      <p className="text-sm text-gray-500 text-center pt-2">
                        ... i {courses.length - 100} więcej kursów
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

            {activeTab === "bug-reports" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden w-full">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800 flex items-center gap-2">
                      <Bug className="w-5 h-5 sm:w-6 sm:h-6" />
                      Zgłoszenia błędów
                    </h2>
                    <button
                      onClick={() => fetchBugReports()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#4067EC] text-white rounded-lg hover:bg-[#3155d4] transition-colors text-sm font-medium"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Odśwież
                    </button>
                  </div>

                  {success && (
                    <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                      {success}
                    </div>
                  )}
                  {bugReportsError && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {bugReportsError}
                    </div>
                  )}

                  {/* Filtry */}
                  <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Filter className="w-4 h-4 inline mr-1" />
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">Wszystkie</option>
                        <option value="new">Nowe</option>
                        <option value="in_progress">W trakcie</option>
                        <option value="resolved">Rozwiązane</option>
                        <option value="closed">Zamknięte</option>
                      </select>
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kategoria
                      </label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">Wszystkie</option>
                        {Array.from(new Set(bugReports.map(r => r.category))).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Statystyki */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {['new', 'in_progress', 'resolved', 'closed'].map((status) => {
                  const count = bugReports.filter(r => r.status === status).length;
                  const statusLabels = {
                    new: 'Nowe',
                    in_progress: 'W trakcie',
                    resolved: 'Rozwiązane',
                    closed: 'Zamknięte'
                  };
                  const statusColors = {
                    new: 'bg-blue-100 text-blue-800',
                    in_progress: 'bg-yellow-100 text-yellow-800',
                    resolved: 'bg-green-100 text-green-800',
                    closed: 'bg-gray-100 text-gray-800'
                  };
                  return (
                    <div key={status} className={`${statusColors[status as keyof typeof statusColors]} rounded-lg p-4`}>
                      <p className="text-sm font-medium opacity-75">{statusLabels[status as keyof typeof statusLabels]}</p>
                      <p className="text-2xl font-bold mt-1">{count}</p>
                    </div>
                  );
                })}
              </div>

                  {/* Lista zgłoszeń */}
                  {bugReportsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4067EC] mx-auto"></div>
                      <p className="mt-4 text-gray-600">Ładowanie zgłoszeń...</p>
                    </div>
                  ) : bugReports.length === 0 ? (
                    <div className="text-center py-12">
                      <Bug className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">Brak zgłoszeń do wyświetlenia</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paginatedBugReports.map((report) => {
                    const statusColors = {
                      new: 'bg-blue-100 text-blue-800 border-blue-200',
                      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      resolved: 'bg-green-100 text-green-800 border-green-200',
                      closed: 'bg-gray-100 text-gray-800 border-gray-200',
                    };
                    const statusLabels = {
                      new: 'Nowe',
                      in_progress: 'W trakcie',
                      resolved: 'Rozwiązane',
                      closed: 'Zamknięte'
                    };
                    return (
                      <div
                        key={report.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={`px-3 py-1 rounded-full border text-sm font-medium ${statusColors[report.status as keyof typeof statusColors]}`}>
                                {statusLabels[report.status as keyof typeof statusLabels]}
                              </span>
                              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                {report.category}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatDate(report.created_at)}
                              </span>
                            </div>

                            <h3 className="text-lg font-semibold text-gray-800 mb-2">
                              {report.description}
                            </h3>

                            {report.steps && (
                              <div className="mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">Kroki do odtworzenia:</p>
                                <p className="text-sm text-gray-600 whitespace-pre-line">{report.steps}</p>
                              </div>
                            )}

                            {(report.expected || report.actual) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                {report.expected && (
                                  <div>
                                    <p className="text-sm font-medium text-green-700 mb-1">Oczekiwane:</p>
                                    <p className="text-sm text-gray-600">{report.expected}</p>
                                  </div>
                                )}
                                {report.actual && (
                                  <div>
                                    <p className="text-sm font-medium text-red-700 mb-1">Rzeczywiste:</p>
                                    <p className="text-sm text-gray-600">{report.actual}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                              {report.browser && (
                                <span>🌐 {report.browser}</span>
                              )}
                              {report.url && (
                                <a
                                  href={report.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  🔗 Link
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="lg:ml-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Zmień status:
                            </label>
                            <select
                              value={report.status}
                              onChange={(e) => updateBugReportStatus(report.id, e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="new">Nowe</option>
                              <option value="in_progress">W trakcie</option>
                              <option value="resolved">Rozwiązane</option>
                              <option value="closed">Zamknięte</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    
                    {/* Pagination for bug reports */}
                    {totalBugReportsPages > 1 && (
                      <div className="mt-6 flex justify-center items-center gap-2">
                        <button
                          onClick={() => setBugReportsPage(p => Math.max(1, p - 1))}
                          disabled={bugReportsPage <= 1}
                          className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Poprzednia
                        </button>
                        
                        <span className="px-4 py-2 text-sm text-gray-700">
                          Strona {bugReportsPage} z {totalBugReportsPages} ({bugReports.length} zgłoszeń)
                        </span>
                        
                        <button
                          onClick={() => setBugReportsPage(p => Math.min(totalBugReportsPages, p + 1))}
                          disabled={bugReportsPage >= totalBugReportsPages}
                          className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Następna
                        </button>
                      </div>
                    )}
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </main>

      {/* Modals - outside main */}
      {/* Reset Password Modal */}
      {showResetPasswordModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Reset Password for {selectedUser?.firstName} {selectedUser?.lastName}
                </h3>
                {resetPasswordError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                    {resetPasswordError}
                  </div>
                )}
                <div className="mt-2 px-7 py-3">
                  <input
                    type="password"
                    placeholder="New Password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-[#4067EC] focus:border-[#4067EC]"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end mt-4 space-x-3">
                  <button
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setNewPassword("");
                      setResetPasswordError("");
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleResetPassword(selectedUser?.id || '')}
                    className="px-4 py-2 bg-[#4067EC] text-white rounded-md hover:bg-[#3155d4]"
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Create Course Modal */}
      {showCreateCourseModal && (
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Utwórz nowy kurs
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCreateCourseModal(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                  >
                    <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                  </button>
                </div>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); createCourse(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł kursu *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newCourseTitle}
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      placeholder="np. Matematyka 7A"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rok *</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newCourseYear}
                      onChange={(e) => setNewCourseYear(e.target.value)}
                      placeholder="np. 7"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Przedmiot *</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newCourseSubject}
                      onChange={(e) => setNewCourseSubject(e.target.value)}
                      required
                    >
                      <option value="">Wybierz przedmiot...</option>
                      <option value="Matematyka">Matematyka</option>
                      <option value="Fizyka">Fizyka</option>
                      <option value="Chemia">Chemia</option>
                      <option value="Biologia">Biologia</option>
                      <option value="Historia">Historia</option>
                      <option value="Geografia">Geografia</option>
                      <option value="Język polski">Język polski</option>
                      <option value="Język angielski">Język angielski</option>
                      <option value="Język niemiecki">Język niemiecki</option>
                      <option value="Informatyka">Informatyka</option>
                      <option value="Wiedza o społeczeństwie">Wiedza o społeczeństwie</option>
                      <option value="Wychowanie fizyczne">Wychowanie fizyczne</option>
                      <option value="Plastyka">Plastyka</option>
                      <option value="Muzyka">Muzyka</option>
                      <option value="Technika">Technika</option>
                      <option value="Edukacja dla bezpieczeństwa">Edukacja dla bezpieczeństwa</option>
                      <option value="Inne">Inne</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      value={newCourseDescription}
                      onChange={(e) => setNewCourseDescription(e.target.value)}
                      placeholder="Opis kursu..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Przypisz nauczyciela *</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={selectedTeacherForCourse}
                      onChange={(e) => setSelectedTeacherForCourse(e.target.value)}
                      required
                    >
                      <option value="">Wybierz nauczyciela...</option>
                      {teachersList.map((user: FirestoreUser) => (
                        <option key={user.id} value={user.email}>
                          {user.firstName || ''} {user.lastName || ''} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateCourseModal(false);
                        setNewCourseTitle("");
                        setNewCourseYear("");
                        setNewCourseDescription("");
                        setNewCourseSubject("");
                        setSelectedTeacherForCourse("");
                        setError("");
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Utwórz kurs
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* Create User Modal */}
      {showCreateUserModal && (
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Utwórz nowego użytkownika
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateUserModal(false);
                      setNewUserEmail("");
                      setNewUserFirstName("");
                      setNewUserLastName("");
                      setNewUserRole("student");
                      setError("");
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                  >
                    <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                  </button>
                </div>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); createUser(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imię *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newUserFirstName}
                      onChange={(e) => setNewUserFirstName(e.target.value)}
                      placeholder="Jan"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newUserLastName}
                      onChange={(e) => setNewUserLastName(e.target.value)}
                      placeholder="Kowalski"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rola *</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      required
                    >
                      <option value="student">Uczeń</option>
                      <option value="teacher">Nauczyciel</option>
                      <option value="admin">Administrator</option>
                      <option value="parent">Rodzic</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateUserModal(false);
                        setNewUserEmail("");
                        setNewUserFirstName("");
                        setNewUserLastName("");
                        setNewUserRole("student");
                        setError("");
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Utwórz użytkownika
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Group className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Utwórz nową grupę
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateGroupModal(false);
                      setNewGroupName("");
                      setNewGroupDescription("");
                      setGroupError("");
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                  >
                    <span className="text-gray-500 group-hover:text-gray-700 text-lg font-medium">×</span>
                  </button>
                </div>
                {groupError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {groupError}
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); createGroup(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa grupy *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="np. Grupa A"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      rows={3}
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      placeholder="Opis grupy..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateGroupModal(false);
                        setNewGroupName("");
                        setNewGroupDescription("");
                        setGroupError("");
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                    >
                      Utwórz grupę
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      {/* Edit Course Modal */}
      {showEditCourseModal && editingCourse && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
            <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Edit Course: {editingCourse.title}
                </h3>
                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                    {error}
                  </div>
                )}
                <div className="mt-2 px-7 py-3 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Course Title *</label>
                      <input
                        type="text"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                        value={editCourseTitle}
                        onChange={(e) => setEditCourseTitle(e.target.value)}
                        placeholder="e.g., Matematyka 7A"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Year *</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                        value={editCourseYear}
                        onChange={(e) => setEditCourseYear(e.target.value)}
                        placeholder="e.g., 7"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject *</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                      value={editCourseSubject}
                      onChange={(e) => setEditCourseSubject(e.target.value)}
                    >
                      <option value="">Select a subject...</option>
                      <option value="Matematyka">Matematyka</option>
                      <option value="Fizyka">Fizyka</option>
                      <option value="Chemia">Chemia</option>
                      <option value="Biologia">Biologia</option>
                      <option value="Historia">Historia</option>
                      <option value="Geografia">Geografia</option>
                      <option value="Język polski">Język polski</option>
                      <option value="Język angielski">Język angielski</option>
                      <option value="Język niemiecki">Język niemiecki</option>
                      <option value="Informatyka">Informatyka</option>
                      <option value="Wiedza o społeczeństwie">Wiedza o społeczeństwie</option>
                      <option value="Wychowanie fizyczne">Wychowanie fizyczne</option>
                      <option value="Plastyka">Plastyka</option>
                      <option value="Muzyka">Muzyka</option>
                      <option value="Technika">Technika</option>
                      <option value="Edukacja dla bezpieczeństwa">Edukacja dla bezpieczeństwa</option>
                      <option value="Inne">Inne</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                      rows={3}
                      value={editCourseDescription}
                      onChange={(e) => setEditCourseDescription(e.target.value)}
                      placeholder="Opis kursu..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Assign Teacher</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                      value={editCourseTeacher}
                      onChange={(e) => setEditCourseTeacher(e.target.value)}
                    >
                      <option value="">Select a teacher...</option>
                      {teachersList.map((user: FirestoreUser) => (
                        <option key={user.id} value={user.email}>
                          {user.firstName || ''} {user.lastName || ''} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Assigned Students Section */}
                  <div className="border-t pt-4">
                    <h4 className="text-md font-medium text-gray-800 mb-3">Assigned Students</h4>
                    
                    {/* Current Students */}
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Currently Assigned:</h5>
                      <div className="space-y-2">
                        {editCourseStudents.length > 0 ? (
                          editCourseStudents.map((studentEmail, index) => {
                            const student = usersMap.get(studentEmail || '');
                            return (
                              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                <span className="text-sm">
                                  {student ? `${student.firstName || ''} ${student.lastName || ''}` : studentEmail}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeStudentFromCourse(studentEmail || '')}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-500">No students assigned</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Add New Student */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Add Student:</h5>
                      <select
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                        onChange={(e) => {
                          if (e.target.value) {
                            addStudentToCourse(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Select a student to add...</option>
                        {users
                          .filter(u => u.role === 'student' && u.email && !editCourseStudents.includes(u.email))
                          .map((user: FirestoreUser) => (
                            <option key={user.id} value={user.email || ''}>
                              {user.firstName || ''} {user.lastName || ''} ({user.email})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-4 space-x-3">
                  <button
                    onClick={() => {
                      setShowEditCourseModal(false);
                      setEditingCourse(null);
                      setEditCourseTitle("");
                      setEditCourseYear("");
                      setEditCourseDescription("");
                      setEditCourseSubject("");
                      setEditCourseTeacher("");
                      setEditCourseStudents([]);
                      setError("");
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateCourse}
                    className="px-4 py-2 bg-[#4067EC] text-white rounded-md hover:bg-[#3155d4]"
                  >
                    Update Course
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Edit Teacher Specialization Modal */}
      {showEditTeacherSpecializationModal && editingTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Edytuj specjalizację nauczyciela</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nauczyciel
                </label>
                <p className="text-sm text-gray-900">
                  {editingTeacher.firstName} {editingTeacher.lastName} ({editingTeacher.email})
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ instruktora
                </label>
                <select
                  value={teacherInstructorType}
                  onChange={(e) => setTeacherInstructorType(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                >
                  <option value="">-- Brak --</option>
                  <option value="wychowawca">Wychowawca</option>
                  <option value="tutor">Tutor</option>
                  <option value="nauczyciel_wspomagajacy">Nauczyciel wspomagający</option>
                  <option value="pedagog_specjalny">Pedagog specjalny</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specjalizacje (oddzielone przecinkami)
                </label>
                <input
                  type="text"
                  value={teacherSpecialization}
                  onChange={(e) => setTeacherSpecialization(e.target.value)}
                  placeholder="np. Matematyka, Fizyka, Informatyka"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Wpisz specjalizacje oddzielone przecinkami (np. Matematyka, Fizyka)
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 space-x-3">
              <button
                onClick={() => {
                  setShowEditTeacherSpecializationModal(false);
                  setEditingTeacher(null);
                  setTeacherInstructorType('');
                  setTeacherSpecialization('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Anuluj
              </button>
              <button
                onClick={saveTeacherSpecialization}
                className="px-4 py-2 bg-[#4067EC] text-white rounded-md hover:bg-[#3155d4]"
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Add Member to {selectedGroup?.name}
                </h3>
                {groupError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                    {groupError}
                  </div>
                )}
                <div className="mt-2 px-7 py-3">
                  <select
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4067EC] focus:ring-[#4067EC]"
                    onChange={(e) => handleAddMember(selectedGroup?.id || '', e.target.value)}
                  >
                    <option value="">Select a user...</option>
                    {usersForSelect.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role === 'teacher' ? 'Teacher' : 'Student'})
                      </option>
                    ))}
                    {users.length > 100 && (
                      <option disabled>... i {users.length - 100} więcej</option>
                    )}
                  </select>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setGroupError("");
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

import AdminRoute from '@/components/AdminRoute';
import ThemeToggle from '@/components/ThemeToggle';

export default function SuperAdminDashboard() {
  return (
    <Providers>
      <AdminRoute>
        <SuperAdminDashboardContent />
      </AdminRoute>
    </Providers>
  );
} 

