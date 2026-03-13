import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Review

@csrf_exempt
def review_list(request):
    if request.method == 'GET':
        reviews = list(Review.objects.values())
        return JsonResponse(reviews, safe=False)
        
    elif request.method == 'POST':
        data = json.loads(request.body)
        Review.objects.create(
            book_id=data.get('book_id'),
            content=data.get('content'),
            rating=data.get('rating')
        )
        return JsonResponse({'status': 'created'}, status=201)