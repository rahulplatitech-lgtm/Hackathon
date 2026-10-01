"""Tests for the conversational voice dispatcher agent."""
import pytest
from app.ai.voice_dispatcher import voice_dispatcher

@pytest.mark.asyncio
async def test_greeting():
    res = await voice_dispatcher.chat([{"role": "user", "content": "HELLO_START"}])
    assert "CrisisSync" in res["reply"]
    assert res["incident_type"] == "General Emergency"

@pytest.mark.asyncio
async def test_fire_report_and_dispatch():
    history = [
        {"role": "user", "content": "near my house in a house there a huge fire breakout so send help fast"}
    ]
    res = await voice_dispatcher.chat(history, reporter_lat=12.9716, reporter_lng=77.5946)
    assert res["incident_type"] == "Fire Emergency"
    assert res["severity"] >= 4
    assert res["dispatched"] is True
    assert "authorized" in res["reply"] or "dispatched" in res["reply"]

@pytest.mark.asyncio
async def test_safety_and_eta_questions():
    # User asks what to do while waiting for fire rescue
    history = [
        {"role": "user", "content": "near my house in a house there a huge fire breakout so send help fast"},
        {"role": "assistant", "content": "Response authorized."},
        {"role": "user", "content": "what should I do while waiting? Smoke is entering my room"}
    ]
    res = await voice_dispatcher.chat(history)
    assert any(w in res["reply"].lower() for w in ["low", "smoke", "evacuate", "cloth"])

    # User asks for ETA
    history.append({"role": "assistant", "content": res["reply"]})
    history.append({"role": "user", "content": "How long will the fire brigade take to arrive?"})
    res_eta = await voice_dispatcher.chat(history)
    assert any(w in res_eta["reply"].lower() for w in ["minute", "siren", "arrival", "dispatched"])

@pytest.mark.asyncio
async def test_water_on_electrical_fire_warning():
    history = [
        {"role": "user", "content": "Can I throw water on the fire? It started near the electrical meter"}
    ]
    res = await voice_dispatcher.chat(history)
    assert "not throw water" in res["reply"].lower() or "do not" in res["reply"].lower()

@pytest.mark.asyncio
async def test_medical_first_aid_questions():
    # Bleeding question
    res_bleed = await voice_dispatcher.chat([{"role": "user", "content": "How do I stop the bleeding from his leg?"}])
    assert "pressure" in res_bleed["reply"].lower()

    # CPR question
    res_cpr = await voice_dispatcher.chat([{"role": "user", "content": "He stopped breathing, what do I do?"}])
    assert "chest" in res_cpr["reply"].lower() or "compress" in res_cpr["reply"].lower()

@pytest.mark.asyncio
async def test_chatbox_satisfaction_and_auto_transition():
    # Turn 1: Caller tells what happened near them
    t1_history = [
        {"role": "user", "content": "A fire just broke out on the second floor of the building near my house"}
    ]
    t1_res = await voice_dispatcher.chat(t1_history, reporter_lat=12.9716, reporter_lng=77.5946)
    assert t1_res["incident_type"] == "Fire Emergency"
    assert "fire" in t1_res["reply"].lower()

    # Turn 2: Caller answers clarifying questions and satisfies chatbox
    t2_history = [
        {"role": "user", "content": "A fire just broke out on the second floor of the building near my house"},
        {"role": "assistant", "content": t1_res["reply"]},
        {"role": "user", "content": "Everyone is evacuated outside safely, please dispatch fire trucks now"}
    ]
    t2_res = await voice_dispatcher.chat(t2_history, reporter_lat=12.9716, reporter_lng=77.5946)
    assert t2_res["dispatched"] is True
    assert "command center" in t2_res["reply"].lower() or "authorized" in t2_res["reply"].lower()

@pytest.mark.asyncio
async def test_human_operator_escalation_request():
    history = [
        {"role": "user", "content": "I am panic, please connect me to a human operator right now"}
    ]
    res = await voice_dispatcher.chat(history)
    assert res["human_escalation_required"] is True
    assert res["ai_confidence"] < 0.60
    assert "human" in res["reply"].lower() or "dispatcher" in res["reply"].lower()
    assert res["escalation_reason"] is not None

@pytest.mark.asyncio
async def test_ambiguous_distress_low_confidence_escalation():
    history = [
        {"role": "user", "content": "I don't know what happened, there's screaming outside and weird loud bang"}
    ]
    res = await voice_dispatcher.chat(history)
    assert res["human_escalation_required"] is True
    assert res["ai_confidence"] <= 0.50
    assert len(res["ai_thinking"]) > 0
    assert "uncertainty" in res["reply"].lower() or "dispatcher" in res["reply"].lower()

