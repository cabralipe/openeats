from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menus', '0005_meal_service_report_and_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='menu',
            name='author_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='menu',
            name='author_crn',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
    ]

