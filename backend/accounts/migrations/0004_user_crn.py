from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_alter_user_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='crn',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]

