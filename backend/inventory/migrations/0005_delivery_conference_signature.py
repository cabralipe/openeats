from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_stockmovement_school'),
    ]

    operations = [
        migrations.AddField(
            model_name='delivery',
            name='conference_signature',
            field=models.TextField(blank=True),
        ),
    ]
