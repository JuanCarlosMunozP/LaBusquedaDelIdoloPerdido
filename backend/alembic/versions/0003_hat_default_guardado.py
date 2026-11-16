"""El sombrero empieza guardado: cambia el valor por defecto de player_inventory.hat_state

Solo cambia el DEFAULT de la columna (filas nuevas). Las filas que ya existen no se tocan: quien
eligio "puesto" lo conserva.

Revision ID: 0003_hat_default_guardado
Revises: 0002_player_inventory
Create Date: 2026-11-15 21:30:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_hat_default_guardado"
down_revision: Union[str, None] = "0002_player_inventory"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("player_inventory") as batch:
        batch.alter_column(
            "hat_state",
            existing_type=sa.String(length=16),
            existing_nullable=False,
            server_default="guardado",
        )


def downgrade() -> None:
    with op.batch_alter_table("player_inventory") as batch:
        batch.alter_column(
            "hat_state",
            existing_type=sa.String(length=16),
            existing_nullable=False,
            server_default="puesto",
        )
