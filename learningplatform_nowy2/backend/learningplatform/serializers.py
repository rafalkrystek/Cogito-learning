from rest_framework import serializers
from django.utils.text import slugify
from .models import Course, Quiz, Question, Answer, QuizAttempt, QuestionResponse
import sympy
from sympy.parsing.latex import parse_latex

class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'year_of_study', 'created_by', 'subject', 'pdfUrls', 'links', 'slug']
        read_only_fields = ['id', 'created_by', 'slug']
    
    def create(self, validated_data):
        # Automatycznie generuj slug z tytułu
        title = validated_data.get('title', '')
        if title:
            base_slug = slugify(title)
            slug = base_slug
            counter = 1
            # Sprawdź czy slug już istnieje, jeśli tak dodaj licznik
            while Course.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        return super().create(validated_data)

class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'content', 'is_correct', 'type']

    def validate_content(self, value):
        if self.initial_data.get('type') == 'math':
            try:
                # Try to parse LaTeX to check if it's valid
                parse_latex(value)
            except Exception as e:
                raise serializers.ValidationError(f"Invalid LaTeX expression: {str(e)}")
        return value

class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, required=False)

    class Meta:
        model = Question
        fields = ['id', 'content', 'type', 'explanation', 'order', 'answers']

    def validate_content(self, value):
        if self.initial_data.get('type') == 'math':
            try:
                parse_latex(value)
            except Exception as e:
                raise serializers.ValidationError(f"Invalid LaTeX expression: {str(e)}")
        return value

    def create(self, validated_data):
        answers_data = validated_data.pop('answers', [])
        question = Question.objects.create(**validated_data)
        
        for answer_data in answers_data:
            Answer.objects.create(question=question, **answer_data)
        
        return question

    def update(self, instance, validated_data):
        answers_data = validated_data.pop('answers', [])
        # Update question fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update answers
        instance.answers.all().delete()
        for answer_data in answers_data:
            Answer.objects.create(question=instance, **answer_data)

        return instance

class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, required=False)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        source='course',
        queryset=Course.objects.all(),
        write_only=True
    )

    class Meta:
        model = Quiz
        fields = ['id', 'firebase_id', 'title', 'description', 'subject', 'course_id', 'course_title', 'questions', 'created_at', 'created_by', 'max_attempts', 'start_time', 'submission_deadline']
        read_only_fields = ['created_at', 'created_by']

    def create(self, validated_data):
        # Dodajemy firebase_id z request data jeśli istnieje
        firebase_id = self.context['request'].data.get('firebase_id')
        if firebase_id:
            validated_data['firebase_id'] = firebase_id
        return super().create(validated_data)

    def validate_course_id(self, course):
        user = self.context['request'].user
        if user.role == 'teacher' and course.created_by != user:
            raise serializers.ValidationError(
                "You can only create quizzes for your own courses"
            )
        return course
    
    def validate(self, data):
        start_time = data.get('start_time')
        submission_deadline = data.get('submission_deadline')
        
        if start_time and submission_deadline:
            if submission_deadline <= start_time:
                raise serializers.ValidationError({
                    'submission_deadline': 'Deadline must be later than start time'
                })
        
        return data

class QuestionResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionResponse
        fields = ['id', 'question', 'answer', 'is_correct']

    def validate(self, data):
        if data['question'].type == 'math' and data.get('answer'):
            try:
                # Parse both the correct answer and user's answer
                correct_expr = parse_latex(data['question'].answers.filter(is_correct=True).first().content)
                user_expr = parse_latex(data['answer'].content)
                
                # Check if expressions are equivalent
                if not sympy.simplify(correct_expr - user_expr) == 0:
                    data['is_correct'] = False
                else:
                    data['is_correct'] = True
            except Exception as e:
                raise serializers.ValidationError(f"Error comparing mathematical expressions: {str(e)}")
        return data

class QuizAttemptSerializer(serializers.ModelSerializer):
    responses = QuestionResponseSerializer(many=True, required=False)
    
    class Meta:
        model = QuizAttempt
        fields = ['id', 'quiz', 'user', 'score', 'started_at', 'completed_at', 'responses']
        read_only_fields = ['score', 'completed_at']

    def create(self, validated_data):
        responses_data = validated_data.pop('responses', [])
        attempt = QuizAttempt.objects.create(**validated_data)
        
        for response_data in responses_data:
            QuestionResponse.objects.create(attempt=attempt, **response_data)
        
        return attempt 