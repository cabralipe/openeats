from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menus', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='menuitem',
            name='image_url',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='menuitem',
            name='meal_name',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='menuitem',
            name='portion_text',
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
