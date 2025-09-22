import pytest
from sqlalchemy import select

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import Comment, Game, GameStatus, Purchase, Review
from proof_of_play_api.scripts import seed_simple_mvp


@pytest.fixture(autouse=True)
def _reset_database(monkeypatch):
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create all ORM tables for the temporary database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def test_seed_simple_mvp_populates_repeatable_catalog_fixture() -> None:
    """Seeding should create multiple active games and remain idempotent."""

    _create_schema()

    seed_simple_mvp.seed()

    with session_scope() as session:
        games = session.scalars(select(Game)).all()
        assert len(games) == 5

        slugs = {game.slug for game in games}
        assert slugs == {
            "starpath-siege",
            "chronorift-tactics",
            "lumen-forge",
            "echoes-of-the-deep",
            "quantum-drift-rally",
        }
        assert all(game.active for game in games)
        assert all(game.status in {GameStatus.DISCOVER, GameStatus.FEATURED} for game in games)

        starpath = next(game for game in games if game.slug == "starpath-siege")
        assert starpath.status == GameStatus.FEATURED

        review_ids = set(session.scalars(select(Review.id)).all())
        comment_ids = set(session.scalars(select(Comment.id)).all())
        purchase_ids = set(session.scalars(select(Purchase.id)).all())

    seed_simple_mvp.seed()

    with session_scope() as session:
        assert set(session.scalars(select(Game.slug)).all()) == slugs
        assert review_ids == set(session.scalars(select(Review.id)).all())
        assert comment_ids == set(session.scalars(select(Comment.id)).all())
        assert purchase_ids == set(session.scalars(select(Purchase.id)).all())


def test_seed_simple_mvp_assigns_developer_wallet() -> None:
    """Every seeded game should expose the shared developer Lightning address."""

    _create_schema()

    seed_simple_mvp.seed()

    with session_scope() as session:
        games = session.scalars(select(Game)).all()

        assert games, "expected seeded games to be available"
        assert {
            game.developer_lightning_address for game in games
        } == {"piteousfrench82@walletofsatoshi.com"}
