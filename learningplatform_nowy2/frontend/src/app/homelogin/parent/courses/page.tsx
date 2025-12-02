'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Providers from '@/components/Providers';

interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  yearOfStudy: number;
  isActive: boolean;
  teacherName: string;
  progress: number;
  lastAccessed: string;
  totalLessons: number;
  completedLessons: number;
  iconUrl?: string;
}

function ParentCoursesContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>('');

  // Pobierz przypisanego ucznia
  useEffect(() => {
    if (!user) return;

    const fetchAssignedStudent = async () => {
      try {
        // 1. Znajdź przypisanego ucznia
        const parentStudentsRef = collection(db, 'parent_students');
        const parentStudentsQuery = query(parentStudentsRef, where('parent', '==', user.uid));
        const parentStudentsSnapshot = await getDocs(parentStudentsQuery);

        if (parentStudentsSnapshot.empty) {
          setLoading(false);
          return;
        }

        const foundStudentId = parentStudentsSnapshot.docs[0].data().student;
        setStudentId(foundStudentId);

        // 2. Pobierz dane ucznia
        const studentDoc = await getDoc(doc(db, 'users', foundStudentId));
        if (studentDoc.exists()) {
          const student = studentDoc.data();
          setStudentData(student);
          setDisplayName(
            student.displayName || 
            `${student.firstName || ''} ${student.lastName || ''}`.trim() || 
            student.email || 
            'Uczeń'
          );
        }
      } catch (error) {
        console.error('Error fetching assigned student:', error);
        setLoading(false);
      }
    };

    fetchAssignedStudent();
  }, [user]);

  // Pobierz kursy dla przypisanego ucznia
  useEffect(() => {
    if (!studentId || !studentData) return;
    
    const fetchCourses = async () => {
      try {
        setLoading(true);
        
        // Pobierz wszystkie kursy
        const coursesCollection = collection(db, 'courses');
        const coursesSnapshot = await getDocs(coursesCollection);
        
        // Pobierz wszystkie moduły
        const modulesCollection = collection(db, 'modules');
        const modulesSnapshot = await getDocs(modulesCollection);
        
        // Pobierz wszystkie lekcje
        const lessonsCollection = collection(db, 'lessons');
        const lessonsSnapshot = await getDocs(lessonsCollection);
        
        // Pobierz postęp ucznia
        const progressCollection = collection(db, 'progress');
        let progressQuery = query(progressCollection, where('studentId', '==', studentId));
        let progressSnapshot = await getDocs(progressQuery);
        
        // Jeśli nie ma wyników, spróbuj inne warianty
        if (progressSnapshot.empty) {
          progressQuery = query(progressCollection, where('user_id', '==', studentId));
          progressSnapshot = await getDocs(progressQuery);
        }
        
        // Utwórz mapę postępu: lessonId -> progress data
        const progressMap = new Map();
        progressSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const lessonId = data.lessonId || data.lesson_id || data.lesson;
          if (lessonId) {
            progressMap.set(lessonId, data);
          }
        });

        // Filtruj kursy przypisane do ucznia
        const userCourses = await Promise.all(
          coursesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((course: any) => {
              // Sprawdź czy kurs jest przypisany bezpośrednio do ucznia
              const isDirectlyAssigned = course.assignedUsers && 
                (course.assignedUsers.includes(studentId) || course.assignedUsers.includes(studentData.email));
              
              // Sprawdź czy uczeń jest w klasie, która ma przypisane kursy
              const isInAssignedClass = course.assignedClasses && course.assignedClasses.length > 0 &&
                studentData.classes && Array.isArray(studentData.classes) && 
                studentData.classes.some((classId: string) => 
                  course.assignedClasses.includes(classId)
                );
              
              return isDirectlyAssigned || isInAssignedClass;
            })
            .map(async (course: any) => {
              // Znajdź moduły dla tego kursu
              const courseModules = modulesSnapshot.docs.filter(moduleDoc => {
                const moduleData = moduleDoc.data();
                return moduleData.courseId === course.id || 
                       moduleData.course_id === course.id ||
                       moduleData.course === course.id;
              });

              // Znajdź wszystkie lekcje dla modułów tego kursu
              const courseLessons = lessonsSnapshot.docs.filter(lessonDoc => {
                const lessonData = lessonDoc.data();
                return courseModules.some(moduleDoc => 
                  lessonData.moduleId === moduleDoc.id || 
                  lessonData.module_id === moduleDoc.id ||
                  lessonData.module === moduleDoc.id
                );
              });

              // Oblicz postęp
              const totalLessons = courseLessons.length;
              let completedLessons = 0;
              let lastAccessed: string | null = null;

              courseLessons.forEach(lessonDoc => {
                const progressData = progressMap.get(lessonDoc.id);
                if (progressData) {
                  if (progressData.completed) {
                    completedLessons++;
                  }
                  // Znajdź ostatni dostęp
                  const lessonLastAccessed = progressData.lastViewed || progressData.last_viewed;
                  if (lessonLastAccessed) {
                    if (!lastAccessed || new Date(lessonLastAccessed) > new Date(lastAccessed)) {
                      lastAccessed = lessonLastAccessed;
                    }
                  }
                }
              });

              const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

              // Pobierz dane nauczyciela
              let teacherName = 'Nieznany nauczyciel';
              if (course.instructor_name) {
                teacherName = course.instructor_name;
              } else if (course.teacher) {
                try {
                  const teacherDoc = await getDoc(doc(db, 'users', course.teacher));
                  if (teacherDoc.exists()) {
                    const teacher = teacherDoc.data();
                    teacherName = teacher.displayName || teacher.email || 'Nieznany nauczyciel';
                  }
                } catch (err) {
                  console.error('Error fetching teacher:', err);
                }
              } else if (course.teacherName) {
                teacherName = course.teacherName;
              } else if (course.teacherEmail) {
                teacherName = course.teacherEmail;
              } else if (course.created_by) {
                teacherName = course.created_by;
              }

              return {
                id: course.id,
                title: course.title || 'Brak tytułu',
                description: course.description || 'Brak opisu',
                subject: course.subject || 'Brak przedmiotu',
                yearOfStudy: course.year_of_study || 1,
                isActive: course.is_active !== false,
                teacherName: teacherName,
                progress: progress,
                lastAccessed: lastAccessed || course.updated_at || course.created_at || new Date().toISOString(),
                totalLessons: totalLessons,
                completedLessons: completedLessons,
                iconUrl: course.iconUrl || ''
              };
            })
        );

        setCourses(userCourses);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [studentId, studentData]);

  // Filtruj kursy
  const filteredCourses = courses.filter(course => {
    const matchesSubject = selectedSubject === 'all' || course.subject === selectedSubject;
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  // Pobierz unikalne przedmioty
  const subjects = ['all', ...Array.from(new Set(courses.map(c => c.subject)))];

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-yellow-500';
    if (progress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#4067EC] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie kursów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 w-full">
      {/* Header bez przycisku powrotu */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-white/20 px-4 sm:px-6 lg:px-8 py-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Kursy Dziecka
        </h1>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        <div className="bg-white/90 backdrop-blur-xl w-full p-4 md:p-6 rounded-2xl shadow-lg border border-white/20">
          <p className="text-gray-600 mb-4">
            {displayName ? `Kursy przypisane do ${displayName}` : 'Kursy przypisane do Twojego podopiecznego'}
          </p>
        
          {/* Filtry i wyszukiwanie */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Wyszukaj kursy..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
              />
            </div>
            
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4067EC] focus:border-transparent"
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>
                  {subject === 'all' ? 'Wszystkie przedmioty' : subject}
                </option>
              ))}
            </select>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Brak kursów</h3>
              <p className="text-gray-500">
                {courses.length === 0 
                  ? 'Twój podopieczny nie ma jeszcze przypisanych kursów.'
                  : 'Nie znaleziono kursów spełniających kryteria wyszukiwania.'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              {filteredCourses.map((course) => {
                return (
                  <div key={course.id} className="bg-white rounded-xl border border-gray-200 hover:border-[#4067EC] transition-all duration-300 hover:shadow-lg overflow-hidden flex flex-col">
                    {/* Course Header */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className={`w-12 h-12 ${course.iconUrl ? 'bg-transparent' : 'bg-[#4067EC]'} rounded-lg flex items-center justify-center text-white text-xl font-bold mb-3 overflow-hidden`}>
                        {course.iconUrl ? (
                          <Image
                            src={course.iconUrl}
                            alt={course.title || 'Course icon'}
                            width={48}
                            height={48}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          course.title.charAt(0).toUpperCase()
                        )}
                      </div>
                      <h3 className="font-semibold text-base text-gray-800 mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2 flex-1">
                        {course.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-[#4067EC] text-white rounded-full text-xs">
                          {course.subject}
                        </span>
                        <span className="text-xs text-gray-600">
                          {course.progress}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(course.progress)}`}
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {course.completedLessons} z {course.totalLessons} lekcji
                        </div>
                      </div>
                      
                      {/* Course Info */}
                      <div className="space-y-1 mb-3 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span>Nauczyciel:</span>
                          <span className="truncate ml-2">{course.teacherName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Rok:</span>
                          <span>{course.yearOfStudy}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="p-4 border-t border-gray-100 flex gap-2">
                      <Link
                        href={`/homelogin/parent/courses/${course.id}`}
                        className="flex-1 bg-[#4067EC] text-white py-2 px-3 rounded-lg text-xs font-medium hover:bg-[#3050b3] transition-colors text-center"
                      >
                        Zobacz szczegóły
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ParentCoursesPage() {
  return (
    <Providers>
      <ParentCoursesContent />
    </Providers>
  );
}
