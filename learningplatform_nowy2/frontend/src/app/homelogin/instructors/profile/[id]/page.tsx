'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Mail, BookOpen, GraduationCap, Clock, Star, Edit, Save, X } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { ErrorDisplay } from '@/components/ErrorDisplay';

interface Instructor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  description: string;
  profileImageUrl: string;
  subjects: string;
  experience: string;
  education: string;
  role: string;
  rating?: number;
  coursesCount?: number;
  studentsCount?: number;
}

export default function InstructorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const instructorId = params?.id as string;
  
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    description: '',
    subjects: '',
    experience: '',
    education: '',
    profileImageUrl: ''
  });

  // Load instructor data
  useEffect(() => {
    const loadInstructor = async () => {
      if (!instructorId) {
        console.log('No instructorId provided');
        return;
      }

      console.log('Loading instructor with ID:', instructorId);

      try {
        setLoading(true);
        setError('');
        
        console.log('Fetching from Firestore collection: users, document:', instructorId);
        const instructorDoc = await getDoc(doc(db, 'users', instructorId));
        
        console.log('Firestore response:', instructorDoc.exists() ? 'Document exists' : 'Document not found');
        
        if (!instructorDoc.exists()) {
          console.log('Instructor document not found in Firestore');
          setError('Instruktor nie został znaleziony');
          return;
        }

        const data = instructorDoc.data();
        console.log('Raw instructor data from Firestore:', data);
        
        const instructorData = {
          id: instructorDoc.id,
          ...data
        } as Instructor;
        
        console.log('Processed instructor data:', instructorData);
        
        setInstructor(instructorData);
        setForm({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          description: data.description || '',
          subjects: data.subjects || '',
          experience: data.experience || '',
          education: data.education || '',
          profileImageUrl: data.profileImageUrl || ''
        });
        
        console.log('State updated successfully');
      } catch (err) {
        console.error('Error loading instructor:', err);
        setError('Błąd ładowania profilu instruktora');
      } finally {
        setLoading(false);
        console.log('Loading finished');
      }
    };

    if (instructorId) {
      loadInstructor();
    }
  }, [instructorId]);

  const handleBack = () => {
    router.back();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!instructor) return;

    try {
      setLoading(true);

      const instructorRef = doc(db, 'users', instructor.id);
      await updateDoc(instructorRef, {
        firstName: form.firstName,
        lastName: form.lastName,
        description: form.description,
        subjects: form.subjects,
        experience: form.experience,
        education: form.education,
        profileImageUrl: form.profileImageUrl
      });

      setInstructor(prev => prev ? { ...prev, ...form } : null);
      setEditMode(false);
    } catch (err) {
      console.error('Error updating instructor:', err);
      setError('Błąd aktualizacji profilu');
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    setEditMode(prev => !prev);
  };

  // Check if current user can edit this profile
  const canEdit = user && (user.uid === instructorId || user.role === 'admin');

  // Early returns
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Ładowanie profilu...</p>
        </div>
      </div>
    );
  }

  if (error || !instructor) {
    return (
      <ErrorDisplay 
        error={error || 'Instruktor nie został znaleziony'}
        variant="full"
        showBackButton={true}
        showHomeButton={true}
      />
    );
  }

  const fullName = `${instructor.firstName} ${instructor.lastName}`;
  const hasProfileImage = Boolean(instructor.profileImageUrl && instructor.profileImageUrl.trim() !== '');

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Powrót</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Profil Instruktora</h1>
            </div>
            <div className="flex items-center space-x-3">
              {canEdit && (
                <button
                  onClick={toggleEditMode}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  {editMode ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  <span>{editMode ? 'Anuluj' : 'Edytuj'}</span>
                </button>
              )}
              {editMode && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Zapisz</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
            {/* Profile Image */}
            <div className="relative">
              {editMode ? (
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                  <input
                    name="profileImageUrl"
                    value={form.profileImageUrl}
                    onChange={handleChange}
                    className="w-full h-full opacity-0 absolute inset-0 cursor-pointer"
                    type="text"
                    placeholder="URL zdjęcia"
                  />
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Kliknij aby zmienić</div>
                    <div className="text-gray-400 text-xs">URL zdjęcia</div>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-200">
                  {hasProfileImage ? (
                    <Image
                      src={instructor.profileImageUrl}
                      alt={fullName}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left">
              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Imię"
                    />
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nazwisko"
                    />
                  </div>
                  <input
                    name="subjects"
                    value={form.subjects}
                    onChange={handleChange}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Przedmioty"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {fullName}
                  </h1>
                  <div className="flex items-center justify-center md:justify-start space-x-2 text-blue-600 mb-4">
                    <BookOpen className="w-5 h-5" />
                    <span className="font-medium">{instructor.subjects || 'Brak informacji o przedmiotach'}</span>
                  </div>
                  <div className="flex items-center justify-center md:justify-start space-x-2 text-gray-600 mb-4">
                    <Mail className="w-5 h-5" />
                    <span>{instructor.email}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Description */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              O mnie
            </h2>
            {editMode ? (
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opisz siebie..."
              />
            ) : (
              <p className="text-gray-700 leading-relaxed">
                {instructor.description || 'Brak opisu'}
              </p>
            )}
          </div>

          {/* Experience */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-green-600" />
              Doświadczenie
            </h2>
            {editMode ? (
              <textarea
                name="experience"
                value={form.experience}
                onChange={handleChange}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opisz swoje doświadczenie..."
              />
            ) : (
              <p className="text-gray-700 leading-relaxed">
                {instructor.experience || 'Brak informacji o doświadczeniu'}
              </p>
            )}
          </div>

          {/* Education */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <GraduationCap className="w-5 h-5 mr-2 text-purple-600" />
              Wykształcenie
            </h2>
            {editMode ? (
              <textarea
                name="education"
                value={form.education}
                onChange={handleChange}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opisz swoje wykształcenie..."
              />
            ) : (
              <p className="text-gray-700 leading-relaxed">
                {instructor.education || 'Brak informacji o wykształceniu'}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Star className="w-5 h-5 mr-2 text-yellow-600" />
              Statystyki
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Ocena:</span>
                <span className="font-semibold text-gray-900">
                  {instructor.rating ? `${instructor.rating}/5` : 'Brak ocen'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Kursy:</span>
                <span className="font-semibold text-gray-900">
                  {instructor.coursesCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Uczniowie:</span>
                <span className="font-semibold text-gray-900">
                  {instructor.studentsCount || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
