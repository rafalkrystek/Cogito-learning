from django.db import models
from django.conf import settings
# from api.models import User  # Removed - using Firebase only

class UserGroup(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_groups')

    def __str__(self):
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=['created_by']),
            models.Index(fields=['created_at']),
        ]

class UserProfile(models.Model):
    USER_TYPES = (
        ('admin', 'Super Administrator'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    user_type = models.CharField(max_length=10, choices=USER_TYPES)
    year_of_study = models.IntegerField(null=True, blank=True)  # for students
    groups = models.ManyToManyField(UserGroup, blank=True, related_name='members')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.user_type}"

    class Meta:
        indexes = [
            models.Index(fields=['user_type']),
            models.Index(fields=['year_of_study']),
            models.Index(fields=['created_at']),
        ]

class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    year_of_study = models.IntegerField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    subject = models.CharField(max_length=100, blank=True)
    pdfUrls = models.JSONField(default=list, blank=True)
    links = models.JSONField(default=list, blank=True)
    slug = models.SlugField(max_length=255, blank=True, unique=True)

    def __str__(self):
        return self.title

    class Meta:
        indexes = [
            models.Index(fields=['created_by']),
            models.Index(fields=['is_active']),
            models.Index(fields=['created_at']),
            models.Index(fields=['subject']),
            models.Index(fields=['year_of_study']),
            models.Index(fields=['slug']),
        ]
        ordering = ['-created_at']

class CourseAssignment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments_made')
    assigned_date = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('course', 'student')
        indexes = [
            models.Index(fields=['course']),
            models.Index(fields=['student']),
            models.Index(fields=['is_active']),
            models.Index(fields=['assigned_date']),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.course.title}" 

class Quiz(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=100)
    course = models.ForeignKey('Course', related_name='quizzes', on_delete=models.CASCADE, null=True, blank=True)
    created_by = models.CharField(max_length=128)  # Firebase UID
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    firebase_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    max_attempts = models.PositiveIntegerField(default=1, help_text='Maximum number of attempts allowed for this quiz')
    start_time = models.DateTimeField(null=True, blank=True, help_text='When the quiz becomes available')
    submission_deadline = models.DateTimeField(null=True, blank=True, help_text='Deadline for quiz submission')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['firebase_id']),
        ]

    def __str__(self):
        return f"{self.title} - {self.course.title if self.course else 'No Course'}"

class Question(models.Model):
    QUESTION_TYPES = (
        ('text', 'Text'),
        ('math', 'Mathematical'),
    )

    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    content = models.TextField()
    type = models.CharField(max_length=10, choices=QUESTION_TYPES, default='text')
    explanation = models.TextField(blank=True)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Question {self.order} of {self.quiz.title}"

class Answer(models.Model):
    question = models.ForeignKey(Question, related_name='answers', on_delete=models.CASCADE)
    content = models.TextField()
    is_correct = models.BooleanField(default=False)
    type = models.CharField(max_length=10, choices=Question.QUESTION_TYPES, default='text')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Answer to {self.question}"

class QuizAttempt(models.Model):
    quiz = models.ForeignKey(Quiz, related_name='attempts', on_delete=models.CASCADE)
    user = models.CharField(max_length=128)  # Firebase UID
    score = models.FloatField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user}'s attempt at {self.quiz}"

class QuestionResponse(models.Model):
    attempt = models.ForeignKey(QuizAttempt, related_name='responses', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.ForeignKey(Answer, null=True, on_delete=models.SET_NULL)
    is_correct = models.BooleanField(default=False)
    response_time = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Response to {self.question} in {self.attempt}" 