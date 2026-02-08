from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menus', '0003_menuitem_image_data_and_meal_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='menu',
            name='name',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
    ]
