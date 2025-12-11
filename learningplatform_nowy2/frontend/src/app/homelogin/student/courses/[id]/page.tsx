"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import Providers from '@/components/Providers';
import { CourseViewShared } from "@/components/CourseViewShared";
import { ArrowLeft } from 'lucide-react';

function StudentCourseDetailContent() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const courseId = params?.id;

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      const functionCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🚀 [DEBUG] [${functionCallId}] useEffect triggered`, {
        courseId: courseId,
        courseIdType: typeof courseId,
        userExists: !!user,
        userEmail: user?.email,
        authLoading: authLoading
      });
      
      if (!courseId) {
        console.warn(`⚠️ [DEBUG] [${functionCallId}] No courseId provided`);
        return;
      }
      
      if (!user) {
        console.warn(`⚠️ [DEBUG] [${functionCallId}] No user data available yet`);
        return;
      }

      console.log(`🔄 [DEBUG] [${functionCallId}] Starting fetchCourseData`);
      setLoading(true);
      try {
        console.log('🔍 [DEBUG] ========== STARTING COURSE ACCESS CHECK ==========');
        console.log('🔍 [DEBUG] Initial data:', {
          courseId: courseId,
          courseIdString: String(courseId),
          userEmail: user?.email,
          userEmailType: typeof user?.email,
          userUid: user?.uid,
          userUidType: typeof user?.uid,
          userRole: user?.role,
          userFullObject: JSON.stringify(user, null, 2)
        });
        
        // Pobierz dane kursu
        console.log('📥 [DEBUG] Fetching course document from Firestore...', {
          collection: 'courses',
          documentId: String(courseId)
        });
        
        const courseDoc = await getDoc(doc(db, "courses", String(courseId)));
        
        console.log('📥 [DEBUG] Course document fetch result:', {
          exists: courseDoc.exists(),
          id: courseDoc.id,
          hasData: courseDoc.exists() ? 'yes' : 'no'
        });
        
        if (!courseDoc.exists()) {
          console.error('❌ [DEBUG] Course document does not exist:', {
            requestedId: courseId,
            requestedIdString: String(courseId),
            documentId: courseDoc.id
          });
          setError("Nie znaleziono kursu.");
          setLoading(false);
          return;
        }

        const courseData = courseDoc.data();
        console.log('📋 [DEBUG] Raw course data from Firestore:', courseData);
        
        // DEBUG: Loguj pełne dane kursu i użytkownika
        console.log('🔍 [DEBUG] Course document data:', {
          courseId: courseId,
          courseDocId: courseDoc.id,
          courseTitle: courseData.title,
          courseSlug: courseData.slug,
          assignedUsers: courseData.assignedUsers || [],
          assignedUsersType: Array.isArray(courseData.assignedUsers),
          assignedUsersLength: courseData.assignedUsers?.length || 0,
          assignedClasses: courseData.assignedClasses || [],
          assignedClassesType: Array.isArray(courseData.assignedClasses),
          assignedClassesLength: courseData.assignedClasses?.length || 0,
          teacherEmail: courseData.teacherEmail,
          createdBy: courseData.created_by,
          isActive: courseData.is_active
        });
        
        console.log('🔍 [DEBUG] User data:', {
          userEmail: user?.email,
          userUid: user?.uid,
          userRole: user?.role,
          userClasses: (user as any).classes || [],
          userClassesType: Array.isArray((user as any).classes),
          userClassesLength: (user as any).classes?.length || 0
        });
        
        // Sprawdź czy uczeń ma dostęp do kursu
        const assignedUsers = courseData.assignedUsers || [];
        const assignedClasses = courseData.assignedClasses || [];
        
        console.log('🔍 [DEBUG] ========== ACCESS CHECK DETAILS ==========');
        console.log('🔍 [DEBUG] Extracted assignment arrays:', {
          assignedUsers: assignedUsers,
          assignedUsersRaw: courseData.assignedUsers,
          assignedUsersIsArray: Array.isArray(assignedUsers),
          assignedUsersLength: assignedUsers.length,
          assignedClasses: assignedClasses,
          assignedClassesRaw: courseData.assignedClasses,
          assignedClassesIsArray: Array.isArray(assignedClasses),
          assignedClassesLength: assignedClasses.length
        });
        
        // Sprawdź dostęp przez email lub uid
        const isAdmin = user?.role === 'admin';
        
        // Szczegółowe porównanie emaili
        const userEmail = user?.email;
        const userEmailTrimmed = userEmail?.trim().toLowerCase();
        const hasEmailAccess = assignedUsers.some((assigned: any) => {
          const assignedStr = String(assigned).trim().toLowerCase();
          const match = assignedStr === userEmailTrimmed;
          if (match) {
            console.log('✅ [DEBUG] Email match found:', { assigned, userEmail });
          }
          return match;
        });
        
        // Szczegółowe porównanie UID
        const userUid = user?.uid;
        const hasUidAccess = assignedUsers.some((assigned: any) => {
          const assignedStr = String(assigned);
          const match = assignedStr === userUid;
          if (match) {
            console.log('✅ [DEBUG] UID match found:', { assigned, userUid });
          }
          return match;
        });
        
        console.log('🔍 [DEBUG] Direct user assignment check:', {
          isAdmin,
          isAdminCheck: user?.role === 'admin',
          userRole: user?.role,
          hasEmailAccess,
          hasEmailAccessCheck: assignedUsers.includes(user?.email),
          userEmail: userEmail,
          userEmailTrimmed: userEmailTrimmed,
          hasUidAccess,
          hasUidAccessCheck: assignedUsers.includes(user?.uid),
          userUid: userUid,
          assignedUsersArray: assignedUsers,
          assignedUsersArrayDetails: assignedUsers.map((u: any, idx: number) => ({
            index: idx,
            value: u,
            type: typeof u,
            stringValue: String(u),
            trimmed: String(u).trim().toLowerCase(),
            matchesEmail: String(u).trim().toLowerCase() === userEmailTrimmed,
            matchesUid: String(u) === userUid
          }))
        });
        
        let hasAccess = isAdmin || hasEmailAccess || hasUidAccess;
        
        console.log('🔍 [DEBUG] Initial access result (before class check):', {
          hasAccess,
          isAdmin,
          hasEmailAccess,
          hasUidAccess
        });
        
        // Jeśli nie ma dostępu przez assignedUsers, sprawdź klasy
        const userClasses = (user as any).classes;
        const userClassesIsArray = Array.isArray(userClasses);
        const userClassesLength = userClassesIsArray ? userClasses.length : 0;
        const userClassesHasItems = userClassesLength > 0;
        
        console.log('🔍 [DEBUG] User classes check:', {
          userClasses: userClasses,
          userClassesType: typeof userClasses,
          userClassesIsArray: userClassesIsArray,
          userClassesLength: userClassesLength,
          userClassesHasItems: userClassesHasItems,
          assignedClassesLength: assignedClasses.length,
          willCheckClasses: !hasAccess && userClassesHasItems && assignedClasses.length > 0
        });
        
        if (!hasAccess && userClassesHasItems && assignedClasses.length > 0) {
          console.log('🔍 [DEBUG] ========== CHECKING CLASS-BASED ACCESS ==========');
          console.log('🔍 [DEBUG] Class arrays:', {
            userClasses: userClasses,
            userClassesDetails: userClasses.map((c: any, idx: number) => ({
              index: idx,
              value: c,
              type: typeof c,
              stringValue: String(c)
            })),
            assignedClasses: assignedClasses,
            assignedClassesDetails: assignedClasses.map((c: any, idx: number) => ({
              index: idx,
              value: c,
              type: typeof c,
              stringValue: String(c)
            }))
          });
          
          const matchingClasses = assignedClasses.filter((classId: string) => {
            const classIdStr = String(classId);
            const match = userClasses.some((userClass: any) => String(userClass) === classIdStr);
            if (match) {
              console.log('✅ [DEBUG] Class match found:', { classId, userClass: userClasses.find((uc: any) => String(uc) === classIdStr) });
            }
            return match;
          });
          
          console.log('🔍 [DEBUG] Class matching result:', {
            matchingClasses: matchingClasses,
            matchingClassesCount: matchingClasses.length,
            hasClassAccess: matchingClasses.length > 0
          });
          
          const newHasAccess = matchingClasses.length > 0;
          console.log('🔍 [DEBUG] Setting hasAccess:', {
            oldHasAccess: hasAccess,
            newHasAccess: newHasAccess,
            matchingClassesLength: matchingClasses.length
          });
          hasAccess = newHasAccess;
          console.log('🔍 [DEBUG] hasAccess after assignment:', hasAccess, typeof hasAccess);
        } else if (!hasAccess) {
          console.log('🔍 [DEBUG] Skipping class check - conditions not met:', {
            hasAccess,
            userClassesHasItems,
            assignedClassesLength: assignedClasses.length,
            reason: !userClassesHasItems ? 'user has no classes' : assignedClasses.length === 0 ? 'course has no assigned classes' : 'already has access'
          });
        }
        
        const accessMethod = isAdmin ? 'admin' : hasEmailAccess ? 'email' : hasUidAccess ? 'uid' : hasAccess ? 'class' : 'none';
        
        console.log(`🔍 [DEBUG] [${functionCallId}] ========== FINAL ACCESS RESULT ==========`);
        console.log(`🔍 [DEBUG] [${functionCallId}] Final access result:`, { 
          hasAccess,
          hasAccessType: typeof hasAccess,
          hasAccessValue: String(hasAccess),
          accessMethod: accessMethod,
          breakdown: {
            isAdmin,
            hasEmailAccess,
            hasUidAccess,
            hasClassAccess: hasAccess && !isAdmin && !hasEmailAccess && !hasUidAccess
          }
        });
        
        // Dodatkowe sprawdzenie tuż przed warunkiem
        const willDenyAccess = !hasAccess;
        console.log(`🔍 [DEBUG] [${functionCallId}] Pre-condition check:`, {
          hasAccess: hasAccess,
          notHasAccess: !hasAccess,
          willEnterIfBlock: willDenyAccess,
          hasAccessBoolean: Boolean(hasAccess),
          hasAccessStrictFalse: hasAccess === false,
          hasAccessStrictTrue: hasAccess === true,
          willDenyAccess: willDenyAccess
        });
        
        // CRITICAL: Sprawdź czy hasAccess nie jest przypadkiem nadpisywane
        if (hasAccess !== true && hasAccess !== false) {
          console.error(`🚨 [DEBUG] [${functionCallId}] CRITICAL: hasAccess is not a boolean!`, {
            hasAccess,
            type: typeof hasAccess,
            value: String(hasAccess)
          });
        }
        
        if (willDenyAccess) {
          console.log(`⚠️ [DEBUG] [${functionCallId}] ENTERING ACCESS DENIED BLOCK - hasAccess is:`, hasAccess, typeof hasAccess);
          console.error(`❌ [DEBUG] [${functionCallId}] ========== ACCESS DENIED ==========`);
          console.error(`❌ [DEBUG] [${functionCallId}] Full diagnostic report:`, {
            courseId: courseId,
            courseTitle: courseData.title,
            courseSlug: courseData.slug,
            assignedUsers: assignedUsers,
            assignedUsersDetails: assignedUsers.map((u: any, idx: number) => ({
              index: idx,
              value: u,
              type: typeof u,
              stringValue: String(u),
              trimmed: String(u).trim().toLowerCase()
            })),
            assignedClasses: assignedClasses,
            assignedClassesDetails: assignedClasses.map((c: any, idx: number) => ({
              index: idx,
              value: c,
              type: typeof c,
              stringValue: String(c)
            })),
            userData: {
              email: user?.email,
              emailTrimmed: user?.email?.trim().toLowerCase(),
              uid: user?.uid,
              role: user?.role,
              classes: (user as any).classes,
              classesType: typeof (user as any).classes,
              classesIsArray: Array.isArray((user as any).classes),
              classesLength: Array.isArray((user as any).classes) ? (user as any).classes.length : 0
            },
            checks: {
              isAdmin,
              emailMatch: hasEmailAccess,
              uidMatch: hasUidAccess,
              classMatch: hasAccess && !isAdmin && !hasEmailAccess && !hasUidAccess
            },
            recommendations: [
              !assignedUsers.length && !assignedClasses.length ? 'Course has no assigned users or classes' : '',
              !user?.email && !user?.uid ? 'User has no email or UID' : '',
              !(user as any).classes || !Array.isArray((user as any).classes) || (user as any).classes.length === 0 ? 'User has no classes assigned' : ''
            ].filter(Boolean)
          });
          setError("Nie masz dostępu do tego kursu. Skontaktuj się z nauczycielem.");
          setLoading(false);
          return;
        }
        
        console.log(`✅ [DEBUG] [${functionCallId}] ========== ACCESS GRANTED ==========`);
        console.log(`✅ [DEBUG] [${functionCallId}] Access granted via:`, accessMethod);
        
        setCourse(courseData);
        setSections(courseData.sections || []);

        // Pobierz quizy przypisane do tego kursu
        const quizzesQuery = query(
          collection(db, "quizzes"),
          where("courseId", "==", String(courseId))
        );
        const quizzesSnapshot = await getDocs(quizzesQuery);
        const quizzesData = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setQuizzes(quizzesData);

        setLoading(false);
      } catch (err) {
        console.error("Error fetching course:", err);
        setError("Błąd podczas ładowania kursu.");
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchCourseData();
    }
  }, [courseId, user, authLoading]);

  if (authLoading || loading) {
  return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie kursu...</p>
        </div>
      </div>
    );
  }

  if (error) {
                                        return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Błąd</h2>
          <p className="text-gray-600 mb-6">{error}</p>
                                                <button
            onClick={() => window.history.back()}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Powrót</span>
                                                        </button>
        </div>
      </div>
    );
  }

  return (
    <CourseViewShared
      course={course}
      sections={sections}
      quizzes={quizzes}
      isTeacherPreview={false}
    />
  );
}

export default function StudentCourseDetail() {
  return (
    <Providers>
      <StudentCourseDetailContent />
    </Providers>
  );
}