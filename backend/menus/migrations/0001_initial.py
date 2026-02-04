import uuid
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('schools', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Menu',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('week_start', models.DateField()),
                ('week_end', models.DateField()),
                ('status', models.CharField(choices=[('DRAFT', 'Rascunho'), ('PUBLISHED', 'Publicado')], default='DRAFT', max_length=16)),
                ('notes', models.TextField(blank=True)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='menus', to='schools.school')),
            ],
        ),
        migrations.CreateModel(
            name='MenuItem',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('day_of_week', models.CharField(choices=[('MON', 'Segunda'), ('TUE', 'Terca'), ('WED', 'Quarta'), ('THU', 'Quinta'), ('FRI', 'Sexta')], max_length=3)),
                ('meal_type', models.CharField(choices=[('BREAKFAST', 'Cafe'), ('LUNCH', 'Almoco'), ('SNACK', 'Lanche')], max_length=16)),
                ('description', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('menu', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='menus.menu')),
            ],
        ),
        migrations.AddConstraint(
            model_name='menu',
            constraint=models.UniqueConstraint(fields=('school', 'week_start'), name='unique_menu_per_school_week'),
        ),
    ]
