"""
Herramientas del agente. En el v0 solo va el handoff, que es la que le da
sentido al producto: el bot sabe cuándo callarse.
"""

from __future__ import annotations

from langchain_core.tools import tool


@tool
def escalar_a_humano(motivo: str) -> str:
    """
    Transfiere la conversación a un asesor humano.

    Úsala cuando el cliente lo pida explícitamente, cuando esté molesto, o
    cuando el caso exceda lo que puedes resolver. No la uses para preguntas
    que puedes contestar tú.

    Args:
        motivo: por qué se transfiere, en una frase, para el asesor.
    """
    # El efecto real lo aplica el worker al ver esta llamada; la tool solo
    # devuelve el texto que el modelo dirá antes de soltar la conversación.
    return "TRANSFERIR: " + motivo
