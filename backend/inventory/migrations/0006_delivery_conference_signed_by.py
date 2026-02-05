from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_delivery_conference_signature'),
    ]

    operations = [
        migrations.AddField(
            model_name='delivery',
            name='conference_signed_by',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
