"""
Pick the LLM that grades the eval. The framework (DeepEval) is free; the judge model is
the only thing that can cost money, so this stays swappable:

    DEEPEVAL_JUDGE = gemini (default) | anthropic | openai | ollama

- gemini    → GOOGLE_API_KEY, free tier at https://aistudio.google.com/apikey
- anthropic → ANTHROPIC_API_KEY
- openai    → OPENAI_API_KEY
- ollama    → no key; needs a running Ollama daemon + `pip install ollama` (in requirements)

`is_configured()` tells the runner whether a judge is actually usable, so the suite can
skip the eval cleanly rather than fail when nothing is set up.
"""

import os

DEFAULT_JUDGE = "gemini"
_MODEL_DEFAULTS = {
    "gemini": "gemini-3.6-flash",
    "anthropic": "claude-haiku-4-5-20251001",
    "openai": "gpt-4o-mini",
    "ollama": "llama3.1",
}
_KEY_ENV = {
    "gemini": "GOOGLE_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
}


def _provider() -> str:
    return (os.environ.get("DEEPEVAL_JUDGE") or DEFAULT_JUDGE).strip().lower()


def _model_name(provider: str) -> str:
    return os.environ.get("DEEPEVAL_JUDGE_MODEL") or _MODEL_DEFAULTS[provider]


def is_configured() -> tuple[bool, str]:
    provider = _provider()
    if provider not in _MODEL_DEFAULTS:
        return False, f"unknown DEEPEVAL_JUDGE={provider!r}"
    if provider == "ollama":
        return True, "ollama (local)"
    key_env = _KEY_ENV[provider]
    if not os.environ.get(key_env):
        return False, f"{key_env} not set (DEEPEVAL_JUDGE={provider})"
    return True, f"{provider}:{_model_name(provider)}"


def build_judge():
    provider = _provider()
    model = _model_name(provider)
    if provider == "gemini":
        from deepeval.models import GeminiModel

        return GeminiModel(model=model, api_key=os.environ["GOOGLE_API_KEY"])
    if provider == "anthropic":
        from deepeval.models import AnthropicModel

        return AnthropicModel(model=model)
    if provider == "openai":
        from deepeval.models import OpenAIModel

        return OpenAIModel(model=model)
    if provider == "ollama":
        from deepeval.models import OllamaModel

        return OllamaModel(model=model)
    raise RuntimeError(f"unknown DEEPEVAL_JUDGE={provider!r}")
