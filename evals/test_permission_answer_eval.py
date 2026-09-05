"""
Part 2 — one assertion wired into an LLM-evaluation framework (DeepEval).

Plain assertions (tests/helpers/assertions.ts) prove the answer is on topic, the right
length, and not an error. They cannot tell whether a fluent, keyword-rich answer is
actually *correct* — an answer that says "Permission.ai pays you $500 a month guaranteed"
would pass every string check and still be wrong.

This adds a G-Eval check judged by Claude: is the answer a correct, grounded explanation
of Permission, with no invented specifics? It runs against a live answer from the same
endpoint the UI uses.
"""

import os

import pytest
import requests
from deepeval import assert_test
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase
from deepeval.test_case import SingleTurnParams as TestCaseParams

from judge import build_judge

BASE_URL = os.environ.get("PERMISSION_BASE_URL", "https://ask.permission.ai")
ASK_ENDPOINT = f"{BASE_URL}/api/agent/ask-unauthenticated"

QUESTION = "What is Permission?"


def ask_agent(message: str) -> str:
    response = requests.post(ASK_ENDPOINT, json={"message": message}, timeout=45)
    response.raise_for_status()
    return response.json()["message"]


@pytest.fixture(scope="module")
def permission_answer() -> str:
    return ask_agent(QUESTION)


def test_what_is_permission_answer_is_correct_and_grounded(permission_answer: str) -> None:
    correctness = GEval(
        name="Correct, grounded explanation of Permission",
        model=build_judge(),
        evaluation_params=[TestCaseParams.INPUT, TestCaseParams.ACTUAL_OUTPUT],
        evaluation_steps=[
            "Check that the output explains Permission.ai as a service where people share "
            "their data on their own terms and earn rewards (ASK tokens), usually through a "
            "personal AI agent and/or wallet.",
            "Heavily penalize an off-topic answer, an error/refusal message, or empty content.",
            "Heavily penalize invented specifics that are not general knowledge: a concrete ASK "
            "token price, a dollar figure, guaranteed or promised earnings, or a capability the "
            "product plausibly does not have.",
            "Do not penalize brevity, phrasing, a trailing follow-up question, or which concepts "
            "it chooses to lead with.",
        ],
        threshold=0.7,
    )

    assert_test(
        LLMTestCase(input=QUESTION, actual_output=permission_answer),
        [correctness],
    )
