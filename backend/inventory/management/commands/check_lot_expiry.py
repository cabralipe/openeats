from datetime import date

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from inventory.models import LotBalanceCentral, LotBalanceSchool, Notification, SupplyLot


class Command(BaseCommand):
    help = 'Verifica validade dos lotes, marca vencidos e cria notificações.'

    def add_arguments(self, parser):
        parser.add_argument('--days', nargs='*', type=int, default=[30, 15, 7], help='Janelas de alerta (dias).')

    def handle(self, *args, **options):
        today = date.today()
        thresholds = sorted({int(d) for d in (options.get('days') or [30, 15, 7]) if int(d) >= 0}, reverse=True)
        created_notifications = 0
        expired_updated = 0

        # Mark expired lots that still have balance.
        lots_with_balance_q = Q(central_balance__quantity__gt=0) | Q(school_balances__quantity__gt=0)
        expirable = SupplyLot.objects.filter(lots_with_balance_q).distinct()
        for lot in expirable.select_related('supply'):
            if lot.expiry_date < today and lot.status != SupplyLot.Status.EXPIRED:
                lot.status = SupplyLot.Status.EXPIRED
                lot.save(update_fields=['status', 'updated_at'])
                expired_updated += 1

        def _notify_once(notification_type, title, message, school=None, is_alert=True):
            nonlocal created_notifications
            exists = Notification.objects.filter(
                notification_type=notification_type,
                title=title,
                school=school,
                delivery__isnull=True,
                created_at__date=today,
            ).exists()
            if exists:
                return
            Notification.objects.create(
                notification_type=notification_type,
                title=title,
                message=message,
                school=school,
                is_alert=is_alert,
            )
            created_notifications += 1

        # Central balances alerts
        central_rows = (
            LotBalanceCentral.objects.select_related('lot', 'lot__supply')
            .filter(quantity__gt=0, lot__status__in=[SupplyLot.Status.ACTIVE, SupplyLot.Status.EXPIRED])
        )
        for row in central_rows:
            lot = row.lot
            days_to_expiry = (lot.expiry_date - today).days
            if lot.status == SupplyLot.Status.EXPIRED or days_to_expiry < 0:
                _notify_once(
                    Notification.NotificationType.LOT_EXPIRED,
                    f'Lote vencido (Central) - {lot.supply.name}',
                    f'Lote {lot.lot_code} vencido em {lot.expiry_date.isoformat()} com saldo {row.quantity}.',
                    school=None,
                    is_alert=True,
                )
                continue
            if days_to_expiry in thresholds:
                _notify_once(
                    Notification.NotificationType.LOT_EXPIRING_SOON,
                    f'Lote vencendo em {days_to_expiry} dia(s) (Central) - {lot.supply.name}',
                    f'Lote {lot.lot_code} vence em {lot.expiry_date.isoformat()} e possui saldo {row.quantity}.',
                    school=None,
                    is_alert=True,
                )

        # School balances alerts
        school_rows = (
            LotBalanceSchool.objects.select_related('school', 'lot', 'lot__supply')
            .filter(quantity__gt=0, lot__status__in=[SupplyLot.Status.ACTIVE, SupplyLot.Status.EXPIRED])
        )
        for row in school_rows:
            lot = row.lot
            days_to_expiry = (lot.expiry_date - today).days
            if lot.status == SupplyLot.Status.EXPIRED or days_to_expiry < 0:
                _notify_once(
                    Notification.NotificationType.LOT_EXPIRED,
                    f'Lote vencido - {row.school.name}',
                    f'{lot.supply.name} lote {lot.lot_code} vencido em {lot.expiry_date.isoformat()} com saldo {row.quantity}.',
                    school=row.school,
                    is_alert=True,
                )
                continue
            if days_to_expiry in thresholds:
                _notify_once(
                    Notification.NotificationType.LOT_EXPIRING_SOON,
                    f'Lote vencendo em {days_to_expiry} dia(s) - {row.school.name}',
                    f'{lot.supply.name} lote {lot.lot_code} vence em {lot.expiry_date.isoformat()} com saldo {row.quantity}.',
                    school=row.school,
                    is_alert=True,
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Verificacao concluida em {timezone.now().isoformat()} | lotes vencidos marcados: {expired_updated} | notificacoes criadas: {created_notifications}'
            )
        )

