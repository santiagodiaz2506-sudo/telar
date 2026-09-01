"""Configuración por variables de entorno. Nada de secretos en el código."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de datos: la pone el usuario, es su Postgres.
    database_url: str = "postgresql://telar:telar@localhost:5432/telar"

    # WhatsApp Cloud API
    meta_app_secret: str = ""
    meta_verify_token: str = ""
    meta_access_token: str = ""
    meta_phone_number_id: str = ""
    meta_api_version: str = "v21.0"

    # Clave de cifrado para tokens guardados en base de datos (Fernet).
    encryption_key: str = ""

    # Segundos de espera antes de invocar al agente, para agrupar los
    # mensajes que el usuario manda en ráfaga.
    debounce_seconds: float = 5.0

    # LLM por defecto del v0. Formato de init_chat_model: "proveedor:modelo".
    default_model: str = "anthropic:claude-sonnet-4-5"
    default_system_prompt: str = "Eres un asistente de atención al cliente. Responde breve y claro."

    log_level: str = "INFO"


@lru_cache
def settings() -> Settings:
    return Settings()
