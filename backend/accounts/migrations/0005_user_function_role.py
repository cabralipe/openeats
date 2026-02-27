from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_crn'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='function_role',
            field=models.CharField(blank=True, default='', max_length=160),
        ),
    ]

