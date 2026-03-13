from django.urls import path
from api.views import review_list

urlpatterns = [
    path('reviews/', review_list),
]