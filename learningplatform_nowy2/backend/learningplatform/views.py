import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Course, CourseAssignment
from .serializers import CourseSerializer
from firebase_utils import set_user_role, auth, delete_user_from_firebase_auth
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json
from django.contrib.admin.views.decorators import staff_member_required
from rest_framework.permissions import AllowAny, IsAuthenticated
from .firebase_config import verify_firebase_token
from datetime import datetime
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import api_view, permission_classes
from django.utils import timezone
import firebase_admin
from firebase_admin import firestore
from google.cloud.firestore import Query
import logging
import time
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Quiz, Question, QuizAttempt
from .serializers import (
    QuizSerializer, 
    QuestionSerializer, 
    QuizAttemptSerializer,
    QuestionResponseSerializer
)
import sympy
from sympy.parsing.latex import parse_latex
from django.db import transaction

# Konfiguracja logowania
logger = logging.getLogger(__name__)

User = get_user_model()

def sync_course_to_firestore(course, operation='create'):
    """
    Synchronizuje kurs z Firestore
    """
    try:
        db = firestore.client()
        course_ref = db.collection('courses').document(str(course.id))
        
        # Przygotuj dane do zapisu
        course_data = {
            'id': course.id,
            'title': course.title,
            'description': course.description,
            'year_of_study': course.year_of_study,
            'subject': course.subject or '',
            'is_active': course.is_active,
            'created_by': course.created_by.id,
            'created_at': course.created_at.isoformat(),
            'updated_at': course.updated_at.isoformat(),
            'pdfUrls': course.pdfUrls or [],
            'links': course.links or [],
            'slug': course.slug or '',
            'assignedUsers': [],
            'sections': []  # Dodajemy sekcje dla kompatybilności z frontendem
        }
        
        # Usuń None wartości
        course_data = {k: v for k, v in course_data.items() if v is not None}
        
        if operation == 'create':
            course_ref.set(course_data)
            logger.info(f"Course created in Firestore: {course.id}")
        elif operation == 'update':
            course_ref.set(course_data, merge=True)
            logger.info(f"Course updated in Firestore: {course.id}")
        elif operation == 'delete':
            course_ref.delete()
            logger.info(f"Course deleted from Firestore: {course.id}")
            
        return True
    except Exception as e:
        logger.error(f"Error synchronizing course with Firestore: {e}")
        return False

class CourseListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        print(f"GET request to courses by user: {request.user.email if request.user.is_authenticated else 'Anonymous'}")
        print(f"User ID: {request.user.id}")
        print(f"User is_teacher: {request.user.is_teacher}")
        print(f"User is_superuser: {request.user.is_superuser}")
        print(f"User is_student: {request.user.is_student}")
        
        try:
            # Pobierz kursy z Firestore
            db = firestore.client()
            courses_ref = db.collection('courses')
            
            # Filtruj kursy na podstawie roli użytkownika
            if request.user.is_teacher:
                # Nauczyciele widzą tylko swoje kursy
                courses_query = courses_ref.where('teacherEmail', '==', request.user.email)
                print(f"Teacher filtering: getting courses for teacher {request.user.email}")
            elif request.user.is_superuser:
                # Administratorzy widzą wszystkie kursy
                courses_query = courses_ref
                print(f"Superuser: getting all courses")
            else:
                # Studenci widzą tylko kursy do których są przypisani
                courses_query = courses_ref.where('assignedUsers', 'array_contains', request.user.email)
                print(f"Student: getting assigned courses for {request.user.email}")
            
            # Pobierz kursy
            courses_snapshot = courses_query.get()
            courses = []
            
            for doc in courses_snapshot:
                course_data = doc.to_dict()
                course_data['id'] = doc.id
                courses.append(course_data)
            
            # Sortuj po dacie utworzenia (najnowsze pierwsze)
            courses.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
            print(f"Found {len(courses)} courses")
            
            # Dodaj paginację dla lepszej wydajności
            page = int(self.request.query_params.get('page', 1))
            page_size = int(self.request.query_params.get('page_size', 20))
        
            # Ogranicz page_size do rozsądnej wartości
            page_size = min(page_size, 50)
            
            start = (page - 1) * page_size
            end = start + page_size
            
            paginated_courses = courses[start:end]
            
            response_data = {
                'results': paginated_courses,
                'count': len(courses),
                'page': page,
                'page_size': page_size,
                'total_pages': (len(courses) + page_size - 1) // page_size
            }
            
            return Response(response_data)
            
        except Exception as e:
            print(f"Error fetching courses from Firestore: {e}")
            return Response({
                'detail': 'Error fetching courses',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        print(f"=== COURSE CREATION ATTEMPT ===")
        print(f"Request method: {request.method}")
        print(f"Request headers: {dict(request.headers)}")
        print(f"Request data: {request.data}")
        print(f"User authenticated: {request.user.is_authenticated}")
        print(f"User: {request.user.email if request.user.is_authenticated else 'Anonymous'}")
        print(f"User is_teacher: {request.user.is_teacher if request.user.is_authenticated else 'N/A'}")
        print(f"User is_student: {request.user.is_student if request.user.is_authenticated else 'N/A'}")
        print(f"User is_superuser: {request.user.is_superuser if request.user.is_authenticated else 'N/A'}")
        
        if not request.user.is_authenticated:
            print("ERROR: User not authenticated")
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not request.user.is_teacher:
            print("ERROR: User is not a teacher")
            return Response({
                'detail': 'Only teachers can create courses.',
                'user_email': request.user.email,
                'is_teacher': request.user.is_teacher,
                'is_student': request.user.is_student,
                'is_superuser': request.user.is_superuser
            }, status=status.HTTP_403_FORBIDDEN)
        
        print("User is authenticated and is a teacher, proceeding with course creation...")
        
        try:
            # Generuj unikalny slug z tytułu
            def generate_unique_slug(title, db):
                import re
                import uuid
                
                # Generuj bazowy slug
                base_slug = re.sub(r'[^a-z0-9\s-]', '', title.lower()).replace(' ', '-').strip('-')
                if not base_slug:
                    base_slug = f"course-{uuid.uuid4().hex[:8]}"
                
                # Sprawdź czy slug już istnieje w Firebase
                unique_slug = base_slug
                counter = 1
                
                while True:
                    # Sprawdź w Firebase czy slug już istnieje
                    existing_courses = db.collection('courses').where('slug', '==', unique_slug).get()
                    if not existing_courses:
                        break
                    
                    # Jeśli istnieje, dodaj licznik
                    unique_slug = f"{base_slug}-{counter}"
                    counter += 1
                    
                    # Zabezpieczenie przed nieskończoną pętlą
                    if counter > 1000:
                        unique_slug = f"{base_slug}-{uuid.uuid4().hex[:8]}"
                        break
                
                return unique_slug
            
            # Przygotuj dane kursu dla Firestore
            course_data = {
                'title': request.data.get('title'),
                'description': request.data.get('description'),
                'year_of_study': request.data.get('year_of_study'),
                'subject': request.data.get('subject', ''),
                'is_active': True,
                'pdfUrls': request.data.get('pdfUrls', []),
                'links': request.data.get('links', []),
                'created_by': request.user.email,
                'teacherEmail': request.user.email,
                'assignedUsers': [],
                'sections': [],
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            print(f"Prepared course data for Firestore: {course_data}")
            
            # Zapisz bezpośrednio do Firestore
            db = firestore.client()
            
            # Generuj unikalny slug
            course_title = request.data.get('title', '')
            unique_slug = generate_unique_slug(course_title, db)
            course_data['slug'] = unique_slug
            
            course_ref = db.collection('courses').document()
            course_ref.set(course_data)
            
            # Dodaj ID do danych
            course_data['id'] = course_ref.id
            
            print(f"Course created successfully in Firestore with ID: {course_ref.id}")
            
            return Response(course_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"Error creating course in Firestore: {e}")
            return Response({
                'detail': 'Error creating course',
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CourseDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CourseSerializer(course)
        return Response(serializer.data)

    def put(self, request, pk):
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = CourseSerializer(course, data=request.data)
        if serializer.is_valid():
            course = serializer.save()
            
            # Synchronize with Firestore
            sync_success = sync_course_to_firestore(course, 'update')
            if not sync_success:
                print("Warning: Course updated in Django but failed to sync with Firestore")
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = CourseSerializer(course, data=request.data, partial=True)
        if serializer.is_valid():
            course = serializer.save()
            
            # Synchronize with Firestore
            sync_success = sync_course_to_firestore(course, 'update')
            if not sync_success:
                print("Warning: Course patched in Django but failed to sync with Firestore")
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            course = Course.objects.get(pk=pk)
        except Course.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete from Firestore first
        sync_success = sync_course_to_firestore(course, 'delete')
        if not sync_success:
            print("Warning: Failed to delete course from Firestore")
        
        # Delete from Django
        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class CourseDetailBySlugView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug):
        try:
            course = Course.objects.get(slug=slug)
        except Course.DoesNotExist:
            return Response({'detail': 'Course not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = CourseSerializer(course)
        return Response(serializer.data)

@csrf_exempt
def set_student_role(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            uid = data.get('uid')
            if not uid:
                return JsonResponse({'error': 'No UID provided'}, status=400)
            success = set_user_role(uid, 'student')
            if success:
                return JsonResponse({'status': 'student role set'})
            else:
                return JsonResponse({'error': 'Failed to set student role - check Firebase credentials'}, status=500)
        except Exception as e:
            print(f"Error in set_student_role endpoint: {str(e)}")
            return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)

@csrf_exempt
def set_teacher_role(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            uid = data.get('uid')
            if not uid:
                return JsonResponse({'error': 'No UID provided'}, status=400)
            success = set_user_role(uid, 'teacher')
            if success:
                return JsonResponse({'status': 'teacher role set'})
            else:
                return JsonResponse({'error': 'Failed to set teacher role - check Firebase credentials'}, status=500)
        except Exception as e:
            print(f"Error in set_teacher_role endpoint: {str(e)}")
            return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)

@csrf_exempt
def set_admin_role(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            uid = data.get('uid')
            if not uid:
                return JsonResponse({'error': 'No UID provided'}, status=400)
            success = set_user_role(uid, 'admin')
            if success:
                return JsonResponse({'status': 'admin role set'})
            else:
                return JsonResponse({'error': 'Failed to set admin role - check Firebase credentials'}, status=500)
        except Exception as e:
            print(f"Error in set_admin_role endpoint: {str(e)}")
            return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)

@csrf_exempt
def set_parent_role(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            uid = data.get('uid')
            if not uid:
                return JsonResponse({'error': 'No UID provided'}, status=400)
            success = set_user_role(uid, 'parent')
            if success:
                return JsonResponse({'status': 'parent role set'})
            else:
                return JsonResponse({'error': 'Failed to set parent role - check Firebase credentials'}, status=500)
        except Exception as e:
            print(f"Error in set_parent_role endpoint: {str(e)}")
            return JsonResponse({'error': f'Internal server error: {str(e)}'}, status=500)

@staff_member_required
@csrf_exempt
def set_student_role(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        uid = data.get('uid')
        if not uid:
            return JsonResponse({'error': 'No UID provided'}, status=400)
        set_user_role(uid, 'student')
        return JsonResponse({'status': 'student role set'})

@csrf_exempt
def check_user_role(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        uid = data.get('uid')
        if not uid:
            return JsonResponse({'error': 'No UID provided'}, status=400)
        try:
            user = auth.get_user(uid)
            role = user.custom_claims.get('role') if user.custom_claims else None
            return JsonResponse({'uid': uid, 'role': role})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

class FirebaseLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        print('Otrzymany token:', token)
        if not token:
            print('Brak tokena')
            return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)

        decoded_token = verify_firebase_token(token)
        print('Decoded token:', decoded_token)
        if not decoded_token:
            print('Token nieprawidłowy')
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

        # Get or create user
        email = decoded_token.get('email')
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': decoded_token.get('name', '').split()[0] if decoded_token.get('name') else '',
                'last_name': ' '.join(decoded_token.get('name', '').split()[1:]) if decoded_token.get('name') else '',
            }
        )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip() or user.email
            }
        })

class VerifyFirebaseTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({
            'uid': decoded_token.get('uid'),
            'email': decoded_token.get('email')
        }) 

class SetTeacherRoleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # Only allow superusers or existing teachers to set teacher roles
        if not (request.user.is_superuser or request.user.is_teacher):
            return Response({'detail': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        email = request.data.get('email')
        if not email:
            return Response({'detail': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Find user by email
            user = User.objects.get(email=email)
            
            # Set teacher role in Django
            user.is_teacher = True
            user.is_student = False
            user.save()
            
            # Set teacher role in Firebase (if we have the UID)
            # Note: This would require the Firebase UID, which we might not have
            # For now, we'll just update the Django user
            
            return Response({
                'detail': f'Successfully set {email} as teacher',
                'user_id': user.id,
                'email': user.email
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'detail': f'Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Allow all authenticated users to view users (needed for chat participants)
        # This is safe because we only return basic user info needed for chat functionality
        
        users = User.objects.all()
        user_data = []
        for user in users:
            user_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'firebase_uid': user.firebase_uid or '',
                'first_name': user.first_name or '',
                'last_name': user.last_name or '',
                'role': 'teacher' if user.is_teacher else 'student',
                'is_teacher': user.is_teacher,
                'is_student': user.is_student,
                'is_superuser': user.is_superuser,
            })
        
        return Response(user_data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_course(request):
    course_id = request.data.get('course_id')
    firebase_uid = request.data.get('firebase_uid')
    email = request.data.get('email')
    class_id = request.data.get('class_id')  # 🆕 NOWE - ID klasy
    print(f"assign_course: course_id={course_id}, firebase_uid={firebase_uid}, email={email}, class_id={class_id}")
    
    try:
        # Pracuj bezpośrednio z Firestore
        db = firestore.client()
        course_ref = db.collection('courses').document(str(course_id))
        course_doc = course_ref.get()
        
        if not course_doc.exists:
            return Response({'success': False, 'error': 'Kurs nie został znaleziony w Firestore!'}, status=404)
        
        # Pobierz aktualne dane kursu
        current_data = course_doc.to_dict()
        assigned_users = current_data.get('assignedUsers', [])
        assigned_classes = current_data.get('assignedClasses', [])  # 🆕 NOWE
        
        # 🆕 LOGIKA PRZYPISYWANIA DO KLASY
        if class_id:
            # Sprawdź czy klasa istnieje
            class_ref = db.collection('classes').document(str(class_id))
            if not class_ref.get().exists:
                return Response({'success': False, 'error': 'Klasa nie została znaleziona!'}, status=404)
            
            # Dodaj klasę do kursu jeśli nie istnieje
            if class_id not in assigned_classes:
                assigned_classes.append(class_id)
                course_ref.update({
                    'assignedClasses': assigned_classes,
                    'updated_at': timezone.now().isoformat()
                })
                logger.info(f"Class {class_id} assigned to course {course_id}")
            
            # Pobierz wszystkich studentów z klasy i dodaj ich do kursu
            class_data = class_ref.get().to_dict()
            class_students = class_data.get('students', [])
            
            # Dodaj studentów z klasy do kursu
            for student_id in class_students:
                if student_id not in assigned_users:
                    assigned_users.append(student_id)
            
            # Zaktualizuj kurs w Firestore
            course_ref.update({
                'assignedUsers': assigned_users,
                'updated_at': timezone.now().isoformat()
            })
            
            logger.info(f"Course {course_id} assigned to class {class_id} with {len(class_students)} students")
            
            return Response({
                'success': True, 
                'message': f'Kurs został przypisany do klasy! Dodano {len(class_students)} studentów.',
                'assigned_users': assigned_users,
                'assigned_classes': assigned_classes
            })
        
        # 🚨 ZACHOWUJĘ ORYGINALNĄ LOGIKĘ DLA POJEDYNCZYCH UŻYTKOWNIKÓW
        elif email:
            # Dodaj użytkownika jeśli nie istnieje
            user_identifier = firebase_uid if firebase_uid else email
            if user_identifier not in assigned_users:
                assigned_users.append(user_identifier)
                
                # Zaktualizuj kurs w Firestore
                course_ref.update({
                    'assignedUsers': assigned_users,
                    'updated_at': timezone.now().isoformat()
                })
                
                print(f"User {user_identifier} assigned to course {course_id} in Firestore")
                logger.info(f"User {user_identifier} assigned to course {course_id}")
                
                return Response({
                    'success': True, 
                    'message': 'Uczeń został przypisany do kursu!',
                    'assigned_users': assigned_users
                })
            else:
                return Response({
                    'success': True, 
                    'message': 'Uczeń jest już przypisany do tego kursu!',
                    'assigned_users': assigned_users
                })
        else:
            return Response({'success': False, 'error': 'Musisz podać email ucznia lub ID klasy!'}, status=400)
            
    except Exception as e:
        print(f"Error in assign_course: {e}")
        logger.error(f"Error in assign_course: {e}")
        return Response({
            'success': False, 
            'error': f'Błąd przypisywania ucznia: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_courses(request):
    assignments = CourseAssignment.objects.filter(student=request.user, is_active=True)
    courses = [a.course for a in assignments]
    return Response(CourseSerializer(courses, many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_course_detail(request, course_id):
    try:
        # Pobierz dane kursu z Firestore
        db = firestore.client()
        course_ref = db.collection('courses').document(str(course_id))
        course_doc = course_ref.get()
        
        if not course_doc.exists:
            return Response({'error': 'Kurs nie został znaleziony w Firestore!'}, status=404)
        
        firestore_data = course_doc.to_dict()
        
        # Przygotuj dane kursu
        course_data = {
            'id': firestore_data.get('id', course_id),
            'title': firestore_data.get('title', 'Kurs bez tytułu'),
            'description': firestore_data.get('description', 'Brak opisu'),
            'year_of_study': firestore_data.get('year_of_study', 1),
            'subject': firestore_data.get('subject', 'Ogólny'),
            'is_active': firestore_data.get('is_active', True),
            'created_at': firestore_data.get('created_at', ''),
            'updated_at': firestore_data.get('updated_at', ''),
            'pdfUrls': firestore_data.get('pdfUrls', []),
            'links': firestore_data.get('links', []),
            'slug': firestore_data.get('slug', ''),
            'sections': firestore_data.get('sections', [])
        }
        
        # Pobierz przypisanych użytkowników
        assigned_users = firestore_data.get('assignedUsers', [])
        
        # Przygotuj dane przypisanych użytkowników
        assigned_users_data = []
        for user_identifier in assigned_users:
            assigned_users_data.append({
                'id': user_identifier,  # Używamy identyfikatora jako ID
                'email': user_identifier if '@' in str(user_identifier) else f'{user_identifier}@example.com',
                'username': user_identifier.split('@')[0] if '@' in str(user_identifier) else user_identifier,
                'first_name': '',
                'last_name': '',
                'is_active': True,
                'assigned_date': firestore_data.get('updated_at', ''),
                'assigned_by': 'Nauczyciel'
            })
        
        # Przygotuj odpowiedź
        response_data = {
            **course_data,
            'assigned_users': assigned_users_data,
            'total_students': len(assigned_users_data),
            'firestore_assigned_users': assigned_users,
            'firestore_sections': firestore_data.get('sections', [])
        }
        
        print(f"Teacher course detail for course {course_id}:")
        print(f"  - Assigned users: {assigned_users}")
        print(f"  - Total students: {len(assigned_users_data)}")
        print(f"  - Course data: {course_data}")
        
        return Response(response_data)
        
    except Exception as e:
        print(f"Error in teacher_course_detail: {e}")
        logger.error(f"Error in teacher_course_detail: {e}")
        return Response({
            'error': f'Błąd pobierania szczegółów kursu: {str(e)}'
        }, status=500) 

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return JsonResponse({'status': 'ok', 'timestamp': time.time()})

@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """Root endpoint - zwraca informacje o API"""
    return JsonResponse({
        'message': 'Cogito Learning Platform API',
        'version': '1.0',
        'endpoints': {
            'health': '/health/',
            'api': '/api/',
            'bug_reports': '/api/bug-reports/',
            'report_bug': '/api/report-bug/',
        },
        'status': 'online'
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def courses_public(request):
    """Publiczny endpoint do testowania kursów bez autoryzacji"""
    try:
        courses = Course.objects.filter(is_active=True).order_by('-created_at')[:10]
        serializer = CourseSerializer(courses, many=True)
        return Response({
            'results': serializer.data,
            'count': courses.count(),
            'message': 'Public courses endpoint'
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def courses_debug(request):
    """Endpoint do debugowania - pokazuje wszystkie kursy"""
    try:
        all_courses = Course.objects.all().order_by('-created_at')
        courses_data = []
        
        for course in all_courses:
            courses_data.append({
                'id': course.id,
                'title': course.title,
                'created_by': course.created_by.email if course.created_by else 'Unknown',
                'created_by_id': course.created_by.id if course.created_by else None,
                'created_at': course.created_at.isoformat(),
                'is_active': course.is_active,
                'subject': course.subject,
                'year_of_study': course.year_of_study
            })
        
        return Response({
            'results': courses_data,
            'count': len(courses_data),
            'message': 'Debug endpoint - all courses'
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500) 

class QuizViewSet(viewsets.ModelViewSet):
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        print(f"=== QUIZ QUERYSET ===")
        print(f"User: {self.request.user.email}")
        print(f"Is teacher: {self.request.user.is_teacher}")
        print(f"Is student: {self.request.user.is_student}")
        
        queryset = Quiz.objects.all()
        print(f"Initial queryset count: {queryset.count()}")

        # Sprawdź czy szukamy po firebase_id
        firebase_id = self.kwargs.get('pk')
        if firebase_id and not firebase_id.isdigit():
            print(f"Looking for quiz with firebase_id: {firebase_id}")
            quiz = queryset.filter(firebase_id=firebase_id).first()
            if not quiz:
                # Jeśli nie znaleziono quizu, utwórz go
                try:
                    quiz = Quiz.objects.create(
                        title='www',
                        subject='Język niemiecki',
                        created_by=self.request.user,
                        firebase_id=firebase_id
                    )
                    print(f"Created new quiz with firebase_id: {firebase_id}")
                except Exception as e:
                    print(f"Error creating quiz: {str(e)}")
            return Quiz.objects.filter(id=quiz.id if quiz else None)

        # Filtruj po kursie jeśli podano course_id
        course_id = self.request.query_params.get('course_id', None)
        if course_id:
            queryset = queryset.filter(course_id=course_id)
            print(f"After course_id filter ({course_id}): {queryset.count()}")

        # Dla nauczyciela - pokaż quizy z jego kursów
        if self.request.user.is_teacher:
            teacher_courses = Course.objects.filter(created_by=self.request.user)
            print(f"Teacher courses: {[c.id for c in teacher_courses]}")
            queryset = queryset.filter(course__in=teacher_courses)
            print(f"After teacher filter: {queryset.count()}")
        # Dla studenta - pokaż quizy z zapisanych kursów
        elif self.request.user.is_student:
            assignments = CourseAssignment.objects.filter(student=self.request.user, is_active=True)
            student_courses = [a.course for a in assignments]
            print(f"Student courses from assignments: {[c.id for c in student_courses]}")
            queryset = queryset.filter(course__in=student_courses)
            print(f"After student filter: {queryset.count()}")

        final_queryset = queryset.select_related('course', 'created_by')
        print(f"Final queryset count: {final_queryset.count()}")
        return final_queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def start_attempt(self, request, pk=None):
        quiz = self.get_object()
        serializer = QuizAttemptSerializer(data={'quiz': quiz.id, 'user': request.user.id})
        if serializer.is_valid():
            attempt = serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        quiz = self.get_object()
        # Sprawdź czy student jest zapisany na kurs przez CourseAssignment
        if not CourseAssignment.objects.filter(
            student=request.user,
            course=quiz.course,
            is_active=True
        ).exists():
            return Response(
                {'error': 'You are not enrolled in this course'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        attempt = QuizAttempt.objects.filter(
            quiz=quiz,
            user=request.user,
            completed_at__isnull=True
        ).latest('started_at')

        serializer = QuestionResponseSerializer(data={
            'attempt': attempt.id,
            'question': request.data.get('question'),
            'answer': request.data.get('answer')
        })

        if serializer.is_valid():
            response = serializer.save()
            
            # Calculate and update score
            total_questions = quiz.questions.count()
            correct_answers = attempt.responses.filter(is_correct=True).count()
            attempt.score = (correct_answers / total_questions) * 100
            attempt.save()

            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def verify_math_expression(self, request, pk=None):
        try:
            # Parse the expressions
            expr1 = parse_latex(request.data.get('expression1', ''))
            expr2 = parse_latex(request.data.get('expression2', ''))
            
            # Check if expressions are equivalent
            is_equivalent = sympy.simplify(expr1 - expr2) == 0
            
            return Response({
                'is_equivalent': is_equivalent,
                'simplified_expr1': str(sympy.simplify(expr1)),
                'simplified_expr2': str(sympy.simplify(expr2))
            })
        except Exception as e:
            return Response(
                {'error': f'Error comparing expressions: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def update_firebase_id(self, request, pk=None):
        quiz = self.get_object()
        firebase_id = request.data.get('firebase_id')
        
        if not firebase_id:
            return Response(
                {'error': 'firebase_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            quiz.firebase_id = firebase_id
            quiz.save()
            return Response({'status': 'firebase_id updated'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'], url_path='results')
    def get_results(self, request, pk=None):
        try:
            # Próbujemy znaleźć quiz po firebase_id
            if not pk.isdigit():
                quiz = Quiz.objects.filter(firebase_id=pk).first()
                if not quiz:
                    # Jeśli nie znaleziono quizu, utwórz go
                    try:
                        quiz = Quiz.objects.create(
                            title='www',
                            subject='Język niemiecki',
                            created_by=request.user,
                            firebase_id=pk
                        )
                        print(f"Created new quiz with firebase_id: {pk}")
                    except Exception as e:
                        print(f"Error creating quiz: {str(e)}")
                        return Response(
                            {'error': f'Failed to create quiz: {str(e)}'},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
            else:
                quiz = self.get_object()

            # Sprawdź czy użytkownik ma dostęp do tego quizu
            if not request.user.is_teacher and not request.user.is_superuser:
                return Response(
                    {'error': 'Only teachers can view quiz results'},
                    status=status.HTTP_403_FORBIDDEN
                )

            attempts = QuizAttempt.objects.filter(quiz=quiz).select_related('user')
            print(f"Found {attempts.count()} attempts for quiz {quiz.id}")
            
            results = []
            for attempt in attempts:
                results.append({
                    'id': str(attempt.id),
                    'student_email': attempt.user.email,
                    'student_name': f"{attempt.user.first_name} {attempt.user.last_name}".strip() or attempt.user.email,
                    'score': attempt.score,
                    'started_at': attempt.started_at,
                    'completed_at': attempt.completed_at,
                    'is_completed': attempt.completed_at is not None
                })
            
            response_data = {
                'quiz_id': quiz.id,
                'firebase_id': quiz.firebase_id,
                'quiz_title': quiz.title,
                'results': sorted(results, key=lambda x: x['student_name'])
            }
            return Response(response_data)
            
        except Exception as e:
            print(f"Error fetching results: {str(e)}")
            return Response(
                {'error': f'Failed to fetch quiz results: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def create_test_quiz(self, request):
        try:
            with transaction.atomic():
                # Znajdź lub utwórz użytkownika
                user = User.objects.filter(is_superuser=True).first()
                if not user:
                    user = User.objects.create_superuser(
                        username='admin',
                        email='admin@example.com',
                        password='admin123'
                    )
                    print(f'Created admin user: {user.email}')

                # Utwórz quiz
                quiz = Quiz.objects.create(
                    title='www',
                    subject='Język niemiecki',
                    created_by=user,
                    firebase_id='6npGeBAPPbZRlDPJPACB'
                )
                print(f'Created quiz: {quiz.id} with firebase_id: {quiz.firebase_id}')
                
                serializer = self.get_serializer(quiz)
                return Response(serializer.data)
        except Exception as e:
            print(f'Error creating quiz: {str(e)}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Question.objects.all()
        quiz_id = self.request.query_params.get('quiz', None)
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)
        return queryset

class QuizAttemptViewSet(viewsets.ModelViewSet):
    serializer_class = QuizAttemptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return QuizAttempt.objects.filter(user=self.request.user)

class DeleteUserView(APIView):
    """
    Endpoint do usuwania użytkowników z Firebase Auth i Firestore
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            uid = request.data.get('uid')
            if not uid:
                return Response({'error': 'UID jest wymagany'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Sprawdź czy użytkownik ma uprawnienia administratora
            user = request.user
            if not (user.is_superuser or user.is_staff):
                return Response({'error': 'Brak uprawnień'}, status=status.HTTP_403_FORBIDDEN)
            
            print(f"🗑️ Deleting user with UID: {uid}")
            
            # 1. Usuń z Firebase Auth
            auth_success = delete_user_from_firebase_auth(uid)
            if not auth_success:
                return Response({'error': 'Nie udało się usunąć użytkownika z Firebase Auth'}, 
                              status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # 2. Usuń z Firestore (jeśli istnieje)
            try:
                db = firestore.client()
                user_doc_ref = db.collection('users').document(uid)
                user_doc_ref.delete()
                print(f"✅ User document deleted from Firestore")
            except Exception as e:
                print(f"⚠️ Warning: Could not delete from Firestore: {e}")
            
            # 3. Usuń z Django (jeśli istnieje)
            try:
                django_user = User.objects.get(firebase_uid=uid)
                django_user.delete()
                print(f"✅ Django user deleted")
            except User.DoesNotExist:
                print(f"ℹ️ Django user not found for UID: {uid}")
            except Exception as e:
                print(f"⚠️ Warning: Could not delete Django user: {e}")
            
            return Response({'message': 'Użytkownik został pomyślnie usunięty'}, 
                          status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error deleting user: {e}")
            return Response({'error': f'Błąd podczas usuwania użytkownika: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR) 

# 🆕 NOWE API ENDPOINTS DLA ZARZĄDZANIA KLASAMI
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_class(request):
    """
    Tworzy nową klasę w Firebase
    """
    if not (request.user.is_teacher or request.user.is_superuser):
        return Response({'error': 'Brak uprawnień do tworzenia klas'}, status=403)
    
    try:
        class_data = request.data
        db = firestore.client()
        
        # Walidacja danych
        required_fields = ['name', 'grade_level', 'academic_year']
        for field in required_fields:
            if not class_data.get(field):
                return Response({'error': f'Pole {field} jest wymagane'}, status=400)
        
        # Przygotuj dane klasy
        new_class = {
            'name': class_data['name'],
            'description': class_data.get('description', ''),
            'grade_level': int(class_data['grade_level']),
            'subject': class_data.get('subject', ''),
            'teacher_id': request.user.firebase_uid or str(request.user.id),
            'teacher_email': request.user.email,
            'students': class_data.get('students', []),
            'max_students': class_data.get('max_students', 30),
            'is_active': True,
            'academic_year': class_data['academic_year'],
            'schedule': class_data.get('schedule', []),
            'created_at': timezone.now(),
            'updated_at': timezone.now(),
            'metadata': class_data.get('metadata', {})
        }
        
        # Zapisz w Firebase
        class_ref = db.collection('classes').document()
        class_ref.set(new_class)
        
        logger.info(f"Class created: {class_ref.id} by {request.user.email}")
        
        return Response({
            'success': True,
            'class_id': class_ref.id,
            'message': 'Klasa została utworzona pomyślnie'
        })
        
    except Exception as e:
        logger.error(f"Error creating class: {e}")
        return Response({'error': f'Błąd podczas tworzenia klasy: {str(e)}'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_classes(request):
    """
    Pobiera listę klas z Firebase
    """
    try:
        db = firestore.client()
        user_id = request.user.firebase_uid or str(request.user.id)
        
        # Pobierz klasy w zależności od roli użytkownika
        if request.user.is_superuser:
            # Admin widzi wszystkie klasy
            classes_ref = db.collection('classes').where('is_active', '==', True)
        elif request.user.is_teacher:
            # Nauczyciele widzą wszystkie klasy (wszyscy nauczyciele mogą widzieć wszystkie klasy)
            classes_ref = db.collection('classes').where('is_active', '==', True)
        else:
            # Student widzi klasy do których jest przypisany
            classes_ref = db.collection('classes').where('students', 'array_contains', user_id).where('is_active', '==', True)
        
        classes = []
        for doc in classes_ref.stream():
            class_data = doc.to_dict()
            class_data['id'] = doc.id
            classes.append(class_data)
        
        return Response({
            'success': True,
            'classes': classes
        })
        
    except Exception as e:
        logger.error(f"Error getting classes: {e}")
        return Response({'error': f'Błąd podczas pobierania klas: {str(e)}'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_course_to_class(request):
    """
    Przypisuje kurs do klasy w Firebase i automatycznie dodaje wszystkich studentów z klasy
    """
    if not (request.user.is_teacher or request.user.is_superuser):
        return Response({'error': 'Brak uprawnień do przypisywania kursów'}, status=403)
    
    try:
        course_id = request.data.get('course_id')
        class_id = request.data.get('class_id')
        
        if not course_id or not class_id:
            return Response({'error': 'Brak course_id lub class_id'}, status=400)
        
        db = firestore.client()
        
        # Sprawdź czy kurs istnieje
        course_ref = db.collection('courses').document(str(course_id))
        course_doc = course_ref.get()
        if not course_doc.exists:
            return Response({'error': 'Kurs nie został znaleziony'}, status=404)
        
        # Sprawdź czy klasa istnieje
        class_ref = db.collection('classes').document(str(class_id))
        class_doc = class_ref.get()
        if not class_doc.exists:
            return Response({'error': 'Klasa nie została znaleziona'}, status=404)
        
        # Pobierz aktualne dane kursu i klasy
        course_data = course_doc.to_dict()
        class_data = class_doc.to_dict()
        
        assigned_users = course_data.get('assignedUsers', [])
        assigned_classes = course_data.get('assignedClasses', [])
        class_students = class_data.get('students', [])
        
        # Dodaj klasę do kursu jeśli nie istnieje
        if class_id not in assigned_classes:
            assigned_classes.append(class_id)
        
        # Dodaj wszystkich studentów z klasy do kursu
        students_added = 0
        for student_id in class_students:
            if student_id not in assigned_users:
                assigned_users.append(student_id)
                students_added += 1
        
        # Zaktualizuj kurs w Firestore
        course_ref.update({
            'assignedClasses': assigned_classes,
            'assignedUsers': assigned_users,
            'updated_at': timezone.now().isoformat()
        })
        
        # Zaktualizuj klasę - dodaj kurs do assignedCourses (jeśli istnieje)
        class_ref.update({
            'assignedCourses': firestore.ArrayUnion([course_id]),
            'updated_at': timezone.now()
        })
        
        logger.info(f"Course {course_id} assigned to class {class_id} with {students_added} new students by {request.user.email}")
        
        return Response({
            'success': True,
            'message': f'Kurs został przypisany do klasy pomyślnie! Dodano {students_added} studentów.',
            'students_added': students_added,
            'total_students': len(class_students)
        })
        
    except Exception as e:
        logger.error(f"Error assigning course to class: {e}")
        return Response({'error': f'Błąd podczas przypisywania kursu: {str(e)}'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_student_to_class(request):
    """
    Dodaje studenta do klasy w Firebase
    """
    if not (request.user.is_teacher or request.user.is_superuser):
        return Response({'error': 'Brak uprawnień do zarządzania klasą'}, status=403)
    
    try:
        class_id = request.data.get('class_id')
        student_email = request.data.get('student_email')
        
        if not class_id or not student_email:
            return Response({'error': 'Brak class_id lub student_email'}, status=400)
        
        db = firestore.client()
        
        # Znajdź studenta po email
        users_ref = db.collection('users').where('email', '==', student_email).limit(1)
        user_docs = list(users_ref.stream())
        
        if not user_docs:
            return Response({'error': 'Student o podanym email nie został znaleziony'}, status=404)
        
        student_id = user_docs[0].id
        
        # Sprawdź czy klasa istnieje
        class_ref = db.collection('classes').document(str(class_id))
        if not class_ref.get().exists:
            return Response({'error': 'Klasa nie została znaleziona'}, status=404)
        
        # Dodaj studenta do klasy
        class_ref.update({
            'students': firestore.ArrayUnion([student_id]),
            'updated_at': timezone.now()
        })
        
        logger.info(f"Student {student_email} added to class {class_id} by {request.user.email}")
        
        return Response({
            'success': True,
            'message': 'Student został dodany do klasy pomyślnie'
        })
        
    except Exception as e:
        logger.error(f"Error adding student to class: {e}")
        return Response({'error': f'Błąd podczas dodawania studenta: {str(e)}'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_student_from_class(request):
    """
    Usuwa studenta z klasy w Firebase
    """
    if not (request.user.is_teacher or request.user.is_superuser):
        return Response({'error': 'Brak uprawnień do zarządzania klasą'}, status=403)
    
    try:
        class_id = request.data.get('class_id')
        student_id = request.data.get('student_id')
        
        if not class_id or not student_id:
            return Response({'error': 'Brak class_id lub student_id'}, status=400)
        
        db = firestore.client()
        
        # Sprawdź czy klasa istnieje
        class_ref = db.collection('classes').document(str(class_id))
        if not class_ref.get().exists:
            return Response({'error': 'Klasa nie została znaleziona'}, status=404)
        
        # Usuń studenta z klasy
        class_ref.update({
            'students': firestore.ArrayRemove([student_id]),
            'updated_at': timezone.now()
        })
        
        logger.info(f"Student {student_id} removed from class {class_id} by {request.user.email}")
        
        return Response({
            'success': True,
            'message': 'Student został usunięty z klasy pomyślnie'
        })
        
    except Exception as e:
        logger.error(f"Error removing student from class: {e}")
        return Response({'error': f'Błąd podczas usuwania studenta: {str(e)}'}, status=500)


# ==================== BUG REPORTS ====================

@api_view(['POST'])
@permission_classes([AllowAny])  # Allow anonymous bug reports
def report_bug(request):
    """
    Endpoint do zgłaszania błędów. Dostępny dla wszystkich użytkowników (anonimowo).
    """
    try:
        data = request.data
        
        # Walidacja wymaganych pól
        required_fields = ['category', 'description']
        for field in required_fields:
            if not data.get(field):
                return Response(
                    {'error': f'Pole {field} jest wymagane'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Przygotuj dane zgłoszenia
        # Używamy timestamp Unix (liczba) dla poprawnego sortowania w Firestore
        now = datetime.utcnow()
        now_timestamp = int(now.timestamp() * 1000)  # milisekundy
        
        bug_report = {
            'category': data.get('category'),
            'description': data.get('description'),
            'steps': data.get('steps', ''),
            'expected': data.get('expected', ''),
            'actual': data.get('actual', ''),
            'browser': data.get('browser', ''),
            'url': data.get('url', ''),
            'status': 'new',  # new, in_progress, resolved, closed
            'created_at': now_timestamp,  # Timestamp Unix w milisekundach
            'updated_at': now_timestamp,
            'created_at_iso': now.isoformat(),  # ISO format dla wyświetlania
            'updated_at_iso': now.isoformat(),
        }
        
        # Zapisz w Firestore
        db = firestore.client()
        bug_reports_ref = db.collection('bug_reports')
        doc_ref = bug_reports_ref.add(bug_report)[1]
        
        logger.info(f"Bug report created: {doc_ref.id}")
        
        return Response({
            'success': True,
            'message': 'Zgłoszenie zostało wysłane pomyślnie',
            'id': doc_ref.id
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating bug report: {e}")
        return Response(
            {'error': f'Błąd podczas zapisywania zgłoszenia: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])  # DOSTĘPNE DLA WSZYSTKICH - bez sprawdzania uprawnień
def get_bug_reports(request):
    """
    Endpoint do pobierania zgłoszeń błędów. Dostępne dla wszystkich zalogowanych.
    """
    try:
        logger.info(f"🔍 Bug reports - fetching all reports")
        
        # Pobierz parametry filtrowania - DRF używa request.query_params
        status_filter = request.query_params.get('status', None)
        category_filter = request.query_params.get('category', None)
        limit_param = request.query_params.get('limit', '50')
        try:
            limit = int(limit_param)
        except (ValueError, TypeError):
            limit = 50
        
        # Pobierz zgłoszenia z Firestore
        # Use get_firestore_client to ensure Firebase is initialized
        from firebase_utils import get_firestore_client
        db = get_firestore_client()
        if not db:
            logger.error("❌ Firestore client not available - Firebase Admin SDK not initialized")
            return Response(
                {'error': 'Firebase Admin SDK not initialized. Check FIREBASE_PRIVATE_KEY environment variable.', 'reports': []}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        bug_reports_ref = db.collection('bug_reports')
        
        logger.info(f"🔍 Fetching bug reports - status_filter: {status_filter}, category_filter: {category_filter}, limit: {limit}")
        
        # Firestore wymaga indeksów dla kombinacji where + order_by
        # Aby całkowicie uniknąć problemów z indeksami, zawsze filtrujemy i sortujemy w pamięci
        # Pobierz więcej dokumentów niż limit, aby mieć zapas do filtrowania
        fetch_limit = min(limit * 3, 200)  # Pobierz max 200 dokumentów
        
        # Sprawdź czy są jakieś filtry
        has_filters = (status_filter and status_filter != 'all') or (category_filter and category_filter != 'all')
        
        # Pobierz dokumenty z Firestore - prosto i bez komplikacji
        try:
            # Pobierz tylko limit dokumentów, nie więcej
            docs = bug_reports_ref.limit(limit).stream()
        except Exception as query_error:
            logger.error(f"❌ Error fetching from Firestore: {query_error}")
            return Response(
                {'error': 'Błąd podczas pobierania zgłoszeń z bazy danych', 'reports': []}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        bug_reports = []
        doc_count = 0
        
        try:
            for doc in docs:
                doc_count += 1
                report_data = doc.to_dict()
                report_data['id'] = doc.id
                
                # Zastosuj filtry
                if status_filter and status_filter != 'all':
                    if report_data.get('status') != status_filter:
                        continue
                if category_filter and category_filter != 'all':
                    if report_data.get('category') != category_filter:
                        continue
                
                # Konwertuj timestampy na ISO format
                if 'created_at' in report_data:
                    if isinstance(report_data['created_at'], (int, float)):
                        from datetime import datetime as dt
                        report_data['created_at'] = dt.fromtimestamp(report_data['created_at'] / 1000).isoformat()
                    elif hasattr(report_data['created_at'], 'isoformat'):
                        report_data['created_at'] = report_data['created_at'].isoformat()
                
                if 'updated_at' in report_data:
                    if isinstance(report_data['updated_at'], (int, float)):
                        from datetime import datetime as dt
                        report_data['updated_at'] = dt.fromtimestamp(report_data['updated_at'] / 1000).isoformat()
                    elif hasattr(report_data['updated_at'], 'isoformat'):
                        report_data['updated_at'] = report_data['updated_at'].isoformat()
                
                bug_reports.append(report_data)
        except Exception as iter_error:
            logger.error(f"❌ Error iterating documents: {iter_error}")
            # Zwróć to co udało się pobrać
            pass
        
        # Sortuj w pamięci po dacie (najnowsze pierwsze)
        try:
            bug_reports.sort(key=lambda x: x.get('_sort_timestamp', x.get('created_at', '')), reverse=True)
        except Exception as sort_err:
            logger.warning(f"⚠️ Error sorting in memory: {sort_err}")
        
        # Ogranicz do limitu
        bug_reports = bug_reports[:limit]
        
        # Usuń pomocnicze pole sortowania przed zwróceniem
        for report in bug_reports:
            if '_sort_timestamp' in report:
                del report['_sort_timestamp']
        
        # Get user email if authenticated, otherwise use 'anonymous'
        user_email = request.user.email if hasattr(request.user, 'email') and request.user.is_authenticated else 'anonymous'
        logger.info(f"✅ Bug reports retrieved by {user_email}: {len(bug_reports)} reports (processed {doc_count} documents)")
        
        return Response({
            'success': True,
            'count': len(bug_reports),
            'reports': bug_reports
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error retrieving bug reports: {e}")
        return Response(
            {'error': f'Błąd podczas pobierania zgłoszeń: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_bug_report_status(request, report_id):
    """
    Endpoint do aktualizacji statusu zgłoszenia. Tylko dla Administratora.
    """
    try:
        # Sprawdź czy użytkownik ma rolę admin/superuser (tylko super admin)
        user = request.user
        logger.info(f"🔍 Bug reports access check - User: {user.email if hasattr(user, 'email') else 'Unknown'}")
        logger.info(f"🔍 User attributes - is_superuser: {getattr(user, 'is_superuser', None)}, is_administrator: {getattr(user, 'is_administrator', None)}")
        
        # Sprawdź rolę również z tokenu Firebase (fallback)
        user_role = None
        firestore_role = None
        try:
            auth_header = request.headers.get('Authorization', '')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split('Bearer ')[1]
                from learningplatform.firebase_config import verify_firebase_token
                decoded_token = verify_firebase_token(token)
                if decoded_token:
                    uid = decoded_token.get('uid')
                    # Sprawdź custom claims
                    try:
                        from firebase_utils import auth
                        firebase_user = auth.get_user(uid)
                        custom_claims = firebase_user.custom_claims or {}
                        user_role = custom_claims.get('role', decoded_token.get('role'))
                        logger.info(f"🔍 Firebase role from custom claims: {user_role}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not get custom claims: {e}")
                        user_role = decoded_token.get('role')
                        logger.info(f"🔍 Firebase role from token: {user_role}")
                    
                    # Sprawdź rolę również w Firestore jako fallback
                    try:
                        db = firestore.client()
                        user_doc = db.collection('users').document(uid).get()
                        if user_doc.exists:
                            user_data = user_doc.to_dict()
                            firestore_role = user_data.get('role')
                            logger.info(f"🔍 Firestore role: {firestore_role}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not get role from Firestore: {e}")
        except Exception as e:
            logger.warning(f"⚠️ Could not get role from token: {e}")
        
        # Sprawdź uprawnienia - użyj roli z custom claims, Firestore lub Django user
        final_role = user_role or firestore_role
        logger.info(f"🔍 Final role check - is_superuser: {getattr(user, 'is_superuser', None)}, is_administrator: {getattr(user, 'is_administrator', None)}, custom_claims_role: {user_role}, firestore_role: {firestore_role}, final_role: {final_role}")
        
        is_authorized = (
            (hasattr(user, 'is_superuser') and user.is_superuser) or
            (hasattr(user, 'is_administrator') and user.is_administrator) or
            (final_role == 'admin') or
            (final_role == 'administrator')
        )
        
        logger.info(f"🔍 Authorization result: {is_authorized}")
        
        if not is_authorized:
            logger.warning(f"❌ Access denied for user: {user.email if hasattr(user, 'email') else 'Unknown'}, role: {final_role}")
            return Response(
                {'error': 'Brak uprawnień. Wymagana rola: Administrator'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_status = request.data.get('status')
        if not new_status:
            return Response(
                {'error': 'Pole status jest wymagane'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        valid_statuses = ['new', 'in_progress', 'resolved', 'closed']
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Nieprawidłowy status. Dozwolone: {", ".join(valid_statuses)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Aktualizuj status w Firestore
        db = firestore.client()
        report_ref = db.collection('bug_reports').document(report_id)
        
        if not report_ref.get().exists:
            return Response(
                {'error': 'Zgłoszenie nie zostało znalezione'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        now = datetime.utcnow()
        now_timestamp = int(now.timestamp() * 1000)  # milisekundy
        
        report_ref.update({
            'status': new_status,
            'updated_at': now_timestamp,  # Timestamp Unix w milisekundach
            'updated_at_iso': now.isoformat(),  # ISO format dla wyświetlania
            'updated_by': user.email
        })
        
        logger.info(f"Bug report {report_id} status updated to {new_status} by {user.email}")
        
        return Response({
            'success': True,
            'message': 'Status zgłoszenia został zaktualizowany'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error updating bug report status: {e}")
        return Response(
            {'error': f'Błąd podczas aktualizacji statusu: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 