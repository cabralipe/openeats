from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0001_initial'),
        ('menus', '0004_menu_name'),
    ]

    operations = [
        migrations.CreateModel(
            name='MealServiceReport',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('service_date', models.DateField()),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('menu', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='meal_service_reports', to='menus.menu')),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='meal_service_reports', to='schools.school')),
            ],
            options={
                'ordering': ['-service_date', '-submitted_at'],
            },
        ),
        migrations.CreateModel(
            name='MealServiceEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('meal_type', models.CharField(choices=[('BREAKFAST1', 'Desjejum'), ('SNACK1', 'Lanche'), ('LUNCH', 'Almoco'), ('SNACK2', 'Lanche'), ('BREAKFAST2', 'Desjejum'), ('DINNER_COFFEE', 'Cafe da noite'), ('BREAKFAST', 'Cafe (legado)'), ('SNACK', 'Lanche (legado)')], max_length=16)),
                ('meal_label', models.CharField(blank=True, max_length=120)),
                ('served_count', models.PositiveIntegerField(default=0)),
                ('report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entries', to='menus.mealservicereport')),
            ],
            options={
                'ordering': ['meal_type'],
            },
        ),
        migrations.AddConstraint(
            model_name='mealservicereport',
            constraint=models.UniqueConstraint(fields=('school', 'service_date'), name='unique_meal_service_report_per_school_day'),
        ),
        migrations.AddConstraint(
            model_name='mealserviceentry',
            constraint=models.UniqueConstraint(fields=('report', 'meal_type'), name='unique_meal_service_entry_per_category'),
        ),
    ]
