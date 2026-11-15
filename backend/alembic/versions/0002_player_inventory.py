"""Inventario persistente del jugador: sombrero, arma en la mano y mochila

Revision ID: 0002_player_inventory
Revises: 0001_initial_schema
Create Date: 2026-11-14 22:30:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_player_inventory"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "player_inventory",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("hat_state", sa.String(length=16), nullable=False, server_default="puesto"),
        sa.Column("equipped_json", sa.Text(), nullable=False, server_default="null"),
        sa.Column("backpack_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("hat_state IN ('puesto', 'guardado')", name="ck_inventory_hat_state"),
    )


def downgrade() -> None:
    op.drop_table("player_inventory")
