import os

import pytest


def pytest_collection_modifyitems(config, items):
    """The eval calls a hosted judge model. With no key, skip rather than fail so a
    keyless clone still gets a green run and a clear reason."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return
    skip = pytest.mark.skip(reason="ANTHROPIC_API_KEY not set — see README 'Part 2 eval'")
    for item in items:
        item.add_marker(skip)
