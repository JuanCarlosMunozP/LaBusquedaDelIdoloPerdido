"""
Reglas fijas del juego (Fase 4C). Viven en el servidor y el cliente las descarga al iniciar:
el frontend solo las aplica y dibuja. Los valores son exactamente los que el juego tenia en el
cliente; no son ajustables por el jugador. Sin dependencias de framework (dominio puro).
"""
from copy import deepcopy

# Tiempos del golpe (segundos). Estan acoplados a la animacion: el punho conecta cuando el brazo
# se estira (INSTANTE_IMPACTO) y todo el golpe dura DURACION_GOLPE. No cambiar sin revisar poses.
COMBAT = {
    "duracionGolpe": 0.5,
    "instanteImpacto": 0.25,
}

# Por arma: alcance (m), dano, golpeEnemigo (vida que quita a un mercenario), espera (s entre golpes).
WEAPONS = {
    "puños": {"alcance": 1.55, "dano": 4, "golpeEnemigo": 1, "espera": 1.3},
    "cuchillo": {"alcance": 1.75, "dano": 10, "golpeEnemigo": 1.5, "espera": 0.8},
    "bate": {"alcance": 2.1, "dano": 14, "golpeEnemigo": 2.5, "espera": 1.8},
    "machete": {"alcance": 1.9, "dano": 13, "golpeEnemigo": 2, "espera": 1.3},
    "pistola": {"alcance": 1.55, "dano": 10, "golpeEnemigo": 1.5, "espera": 1.7},
}

# Dano de un balazo segun donde pega. Alturas en metros sobre los pies de Max (mide ~1.8):
# cabeza y pecho matan; el resto hiere. `brazoLateral`: distancia al eje del cuerpo desde la que
# el disparo cuenta como brazo.
BULLET_ZONES = {
    "umbrales": {
        "cabeza": 1.55,
        "pecho": 1.15,
        "abdomen": 0.8,
        "rodillaMin": 0.35,
        "rodillaMax": 0.6,
        "brazoLateral": 0.2,
    },
    "dano": {"brazo": 10, "abdomen": 20, "rodilla": 10, "pierna": 10},
}

# Suministros (botiquines y kits de arma). Tiempos en segundos.
SUPPLIES = {
    "cada": 10,
    "duracion": 60,
    "aviso": 10,
    "maxPorTipo": 6,
    "balas": 10,
    "curacion": 40,
    "vidaMaxima": 100,
}


# Armas que pueden salir de un kit (todas menos los punos), con la misma probabilidad cada una.
KIT_WEAPONS = ("cuchillo", "bate", "machete", "pistola")

# Cuantas posiciones candidatas recibe el cliente por suministro (el cliente se queda con la primera
# que caiga en tierra firme, lejos de obstaculos) y cuantos segundos de gracia se dan al recoger uno
# justo cuando expira (latencia de red).
SUPPLY_CANDIDATES = 12
CLAIM_GRACE_SECONDS = 2.0


def game_rules() -> dict:
    """Copia de las reglas (quien la reciba no puede alterar las constantes del servidor)."""
    return deepcopy(
        {
            "combate": COMBAT,
            "armas": WEAPONS,
            "balas": BULLET_ZONES,
            "suministros": SUPPLIES,
        }
    )


GAME_RULES_VERSION = 1
