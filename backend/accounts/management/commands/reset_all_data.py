import os

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Limpa todos os dados do banco (mantém schema/migrations) usando flush. Uso destrutivo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Confirma explicitamente a limpeza total do banco.",
        )
        parser.add_argument(
            "--no-seed",
            action="store_true",
            help="Nao executa seed apos limpar.",
        )
        parser.add_argument(
            "--with-super-populate",
            action="store_true",
            help="Executa super_populate_demo apos seed.",
        )

    def handle(self, *args, **options):
        allow = os.getenv("ALLOW_DESTRUCTIVE_RESET", "").lower() in {"1", "true", "yes", "on"}
        if not allow:
            raise CommandError(
                "Operacao bloqueada. Defina ALLOW_DESTRUCTIVE_RESET=true para habilitar reset destrutivo."
            )
        if not options["confirm"]:
            raise CommandError("Use --confirm para executar a limpeza total do banco.")

        db_name = connection.settings_dict.get("NAME")
        self.stdout.write(self.style.WARNING(f"Limpando dados do banco via flush: {db_name}"))
        call_command("flush", "--noinput")
        self.stdout.write(self.style.SUCCESS("Banco limpo com sucesso (schema preservado)."))

        if not options["no_seed"]:
            call_command("seed")
            self.stdout.write(self.style.SUCCESS("Seed base executado."))
            if options["with_super_populate"]:
                call_command("super_populate_demo")
                self.stdout.write(self.style.SUCCESS("Super populate demo executado."))
