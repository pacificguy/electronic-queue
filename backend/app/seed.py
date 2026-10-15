from .config import settings
from .database import SessionLocal
from .models import Role, Service, User
from .security import hash_password


def ensure_admin() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == settings.admin_email).first()
        if admin is None:
            admin = User(
                email=settings.admin_email,
                full_name=settings.admin_name,
                hashed_password=hash_password(settings.admin_password),
                role=Role.admin.value,
                is_active=True,
            )
            db.add(admin)
            print(f"[seed] создан администратор {settings.admin_email}")
        else:
            admin.role = Role.admin.value
            admin.is_active = True
            print(f"[seed] администратор {settings.admin_email} уже существует")

        client = (
            db.query(User).filter(User.email == settings.demo_client_email).first()
        )
        if client is None:
            db.add(
                User(
                    email=settings.demo_client_email,
                    full_name=settings.demo_client_name,
                    hashed_password=hash_password(settings.demo_client_password),
                    role=Role.client.value,
                    is_active=True,
                )
            )
            print(f"[seed] создан клиент {settings.demo_client_email}")
        else:
            client.role = Role.client.value
            client.is_active = True
            print(f"[seed] клиент {settings.demo_client_email} уже существует")

        if db.query(Service).count() == 0:
            db.add_all(
                [
                    Service(
                        name="Консультация специалиста",
                        description="Первичная консультация по общим вопросам.",
                        duration_minutes=15,
                    ),
                    Service(
                        name="Оформление документов",
                        description="Приём и оформление заявлений и справок.",
                        duration_minutes=20,
                    ),
                    Service(
                        name="Кассовое обслуживание",
                        description="Оплата услуг и приём платежей.",
                        duration_minutes=10,
                    ),
                ]
            )
            print("[seed] добавлены демонстрационные услуги")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    ensure_admin()
