import pytest

from judge import is_configured


def pytest_collection_modifyitems(config, items):
    """The eval calls an LLM judge. If none is configured, skip (don't fail) so a fresh
    clone still gets a green run with a clear reason."""
    ok, detail = is_configured()
    if ok:
        return
    skip = pytest.mark.skip(reason=f"no LLM judge configured — {detail}. See README 'Part 2 eval'.")
    for item in items:
        item.add_marker(skip)
