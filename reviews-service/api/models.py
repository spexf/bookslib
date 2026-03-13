from django.db import models

class Review(models.Model):
    book_id = models.IntegerField()
    content = models.TextField()
    rating = models.IntegerField()