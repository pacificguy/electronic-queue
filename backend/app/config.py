from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://queue:queue@db:5432/queue"
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 240

    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    admin_name: str = "Administrator"

    demo_client_email: str = "client@example.com"
    demo_client_password: str = "client12345"
    demo_client_name: str = "Demo Client"

    cors_origins: str = "*"


settings = Settings()
