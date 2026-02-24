from django.urls import path

from .views import PublicCalculatorCalculateView, PublicCalculatorMetaView

urlpatterns = [
    path('<uuid:token>/meta/', PublicCalculatorMetaView.as_view(), name='public-calculator-meta'),
    path('<uuid:token>/calculate/', PublicCalculatorCalculateView.as_view(), name='public-calculator-calculate'),
]

