from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0001_initial'),
        ('inventory', '0003_delivery_responsible_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockmovement',
            name='school',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stock_movements', to='schools.school'),
        ),
    ]
