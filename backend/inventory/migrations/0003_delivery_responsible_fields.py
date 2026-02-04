from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_delivery'),
    ]

    operations = [
        migrations.AddField(
            model_name='delivery',
            name='responsible_name',
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name='delivery',
            name='responsible_phone',
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
