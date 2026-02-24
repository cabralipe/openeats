from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_user_options_alter_user_groups'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('SEMED_ADMIN', 'SEMED Admin'), ('NUTRITIONIST', 'Nutricionista')],
                default='SEMED_ADMIN',
                max_length=32,
            ),
        ),
    ]
