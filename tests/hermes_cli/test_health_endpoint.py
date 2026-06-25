"""Tests for the unified /api/health aggregator."""

import pytest

import hermes_cli.web_server as ws


class _FakeRegistry:
    def __init__(self, live, total):
        self._live = live
        self._total = total

    def live_count(self):
        return self._live

    def snapshot(self, now=None):
        return [{}] * self._total


@pytest.mark.asyncio
async def test_health_aggregates_signals(monkeypatch):
    monkeypatch.setattr(ws, "get_running_pid", lambda: 4321)
    monkeypatch.setattr(ws, "read_runtime_status", lambda: {
        "gateway_state": "ready",
        "platforms": {
            "telegram": {"state": "connected", "updated_at": 111},
            "discord": {"state": "fatal", "error_message": "boom"},
        },
    })
    monkeypatch.setattr(ws, "PTY_REGISTRY", _FakeRegistry(live=2, total=3))
    # Provider isn't LM Studio -> the lmstudio check is omitted (no noise).
    monkeypatch.setattr(ws, "load_config", lambda: {"model": {"provider": "openai"}})

    body = await ws.get_health()

    assert body["checks"]["gateway"]["status"] == "up"
    assert body["checks"]["gateway"]["pid"] == 4321
    assert body["checks"]["platform:telegram"]["status"] == "up"
    assert body["checks"]["platform:discord"]["status"] == "down"
    assert body["checks"]["pty_sessions"] == {"status": "ok", "live": 2, "total": 3}
    assert "lmstudio" not in body["checks"]
    assert body["ok"] is False  # discord poller is down


@pytest.mark.asyncio
async def test_health_gateway_down(monkeypatch):
    monkeypatch.setattr(ws, "get_running_pid", lambda: None)
    monkeypatch.setattr(ws, "read_runtime_status", lambda: {})
    monkeypatch.setattr(ws, "PTY_REGISTRY", _FakeRegistry(live=0, total=0))
    monkeypatch.setattr(ws, "load_config", lambda: {"model": {"provider": "openai"}})

    body = await ws.get_health()
    assert body["checks"]["gateway"]["status"] == "down"
    assert body["ok"] is False


@pytest.mark.asyncio
async def test_health_probes_lmstudio_when_active(monkeypatch):
    monkeypatch.setattr(ws, "get_running_pid", lambda: 1)
    monkeypatch.setattr(ws, "read_runtime_status", lambda: {"gateway_state": "ready", "platforms": {}})
    monkeypatch.setattr(ws, "PTY_REGISTRY", _FakeRegistry(live=1, total=1))
    monkeypatch.setattr(ws, "load_config", lambda: {
        "model": {"provider": "lmstudio", "base_url": "http://127.0.0.1:1234/v1"},
    })
    ws._LMSTUDIO_HEALTH_CACHE = {"at": 0.0, "value": None}  # fresh, no stale cache
    import hermes_cli.models as models
    monkeypatch.setattr(models, "probe_lmstudio_models", lambda **k: ["m1", "m2"])

    body = await ws.get_health()
    assert body["checks"]["lmstudio"]["status"] == "up"
    assert body["checks"]["lmstudio"]["models"] == 2
    assert body["ok"] is True
