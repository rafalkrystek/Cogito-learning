"""
URL configuration for learning_platform project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path, include
from learningplatform.views import health_check, api_root, set_teacher_role, set_admin_role, set_student_role, set_parent_role, report_bug, get_bug_reports, update_bug_report_status
from learningplatform.firebase_views import UpdateLearningTimeView

urlpatterns = [
    path('', api_root, name='api-root'),
    path('health/', health_check, name='health-check'),
    
    # Only API endpoint that works with Firebase
    path('api/update-learning-time/', UpdateLearningTimeView.as_view(), name='update-learning-time'),
    
    # Role management endpoints
    path('api/set-teacher-role-api/', set_teacher_role, name='set-teacher-role'),
    path('api/set-admin-role-api/', set_admin_role, name='set-admin-role'),
    path('api/set-student-role-api/', set_student_role, name='set-student-role'),
    path('api/set-parent-role-api/', set_parent_role, name='set-parent-role'),
    
    # Bug reports endpoints
    path('api/report-bug/', report_bug, name='report-bug'),
    path('api/bug-reports/', get_bug_reports, name='get-bug-reports'),
    path('api/bug-reports/<str:report_id>/status/', update_bug_report_status, name='update-bug-report-status'),
    
    # Include learningplatform URLs
    path('api/', include('learningplatform.urls')),
]
