from django.test import TestCase
from .models import Review

class ReviewTestCase(TestCase):
    def setUp(self):
        Review.objects.create(book_id=1, content="Great!", rating=5)

    def test_review_creation(self):
        r = Review.objects.get(book_id=1)
        self.assertEqual(r.rating, 5)