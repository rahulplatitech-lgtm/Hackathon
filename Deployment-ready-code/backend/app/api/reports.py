"""Emergency report API endpoints."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from datetime import datetime, timezone
from app.services.pipeline import pipeline
from app.services.websocket_manager import ws_manager
from app.db.database import async_session
from app.models.all_models import IncidentReport, HumanReview, gen_id
from app.schemas.reports import TextReportRequest, ReportResponse
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/text", response_model=ReportResponse)
async def create_text_report(req: TextReportRequest):
    """Submit a text emergency report."""
    result = await pipeline.process_text_report(req.text, req.reporter_lat, req.reporter_lng)
    intake = result["intake"]
    conf = result["confidence"]
    analysis = intake.get("analysis", {})

    report = IncidentReport(
        id=intake["report_id"],
        input_type="text",
        raw_text=req.text,
        reporter_lat=req.reporter_lat,
        reporter_lng=req.reporter_lng,
        ai_confidence=conf["confidence"],
        voice_distress_signal=conf.get("voice_distress_signal"),
        human_review_required=conf["requires_human_review"],
        preliminary_type=analysis.get("incident_type"),
        extracted_location=analysis.get("extracted_location"),
        missing_info=conf.get("missing_fields", []),
        status="pending_review" if conf["requires_human_review"] else "confirmed",
    )

    async with async_session() as session:
        session.add(report)
        if conf["requires_human_review"]:
            review = HumanReview(id=gen_id(), report_id=report.id)
            session.add(review)
            await ws_manager.broadcast("human_review.required", {
                "report_id": report.id,
                "confidence": conf["confidence"],
            })
        await session.commit()
        await session.refresh(report)

    # If high confidence, auto-create incident
    if not conf["requires_human_review"]:
        from app.agents.incident_assessment import assessment_agent
        inc_data = assessment_agent.assess(intake)
        from app.models.all_models import Incident
        async with async_session() as session:
            incident = Incident(**inc_data)
            session.add(incident)
            await session.commit()
        await ws_manager.broadcast("incident.created", inc_data)

    return ReportResponse.model_validate(report)


@router.post("/voice", response_model=ReportResponse)
async def create_voice_report(
    audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
    reporter_lat: Optional[float] = Form(None),
    reporter_lng: Optional[float] = Form(None),
):
    """Submit a voice emergency report."""
    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"

    result = await pipeline.process_voice_report(
        audio_bytes, mime_type, reporter_lat, reporter_lng, transcript
    )
    intake = result["intake"]
    conf = result["confidence"]
    analysis = intake.get("analysis", {})

    report = IncidentReport(
        id=intake["report_id"],
        input_type="voice",
        raw_text=intake.get("raw_text", ""),
        transcript=intake.get("transcript"),
        audio_path=intake.get("audio_url"),
        reporter_lat=reporter_lat,
        reporter_lng=reporter_lng,
        ai_confidence=conf["confidence"],
        voice_distress_signal=conf.get("voice_distress_signal"),
        human_review_required=conf["requires_human_review"],
        preliminary_type=analysis.get("incident_type"),
        extracted_location=analysis.get("extracted_location"),
        missing_info=conf.get("missing_fields", []),
        status="pending_review" if conf["requires_human_review"] else "confirmed",
    )

    async with async_session() as session:
        session.add(report)
        if conf["requires_human_review"]:
            review = HumanReview(id=gen_id(), report_id=report.id)
            session.add(review)
            await ws_manager.broadcast("human_review.required", {"report_id": report.id})
        await session.commit()
        await session.refresh(report)

    if not conf["requires_human_review"]:
        from app.agents.incident_assessment import assessment_agent
        inc_data = assessment_agent.assess(intake)
        from app.models.all_models import Incident
        async with async_session() as session:
            incident = Incident(**inc_data)
            session.add(incident)
            await session.commit()
        await ws_manager.broadcast("incident.created", inc_data)

    return ReportResponse.model_validate(report)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str):
    async with async_session() as session:
        result = await session.execute(select(IncidentReport).where(IncidentReport.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return ReportResponse.model_validate(report)


from app.schemas.reports import VoiceChatRequest, VoiceChatResponse
from app.ai.voice_dispatcher import voice_dispatcher
from app.models.all_models import Incident

@router.post("/voice-assistant/chat", response_model=VoiceChatResponse)
async def voice_assistant_chat(req: VoiceChatRequest):
    """Interactive conversational voice dispatcher endpoint (ChatGPT Voice Style)."""
    messages_data = [{"role": m.role, "content": m.content} for m in req.messages]
    result = await voice_dispatcher.chat(
        messages=messages_data,
        reporter_lat=req.reporter_lat,
        reporter_lng=req.reporter_lng,
        dispatch_now=req.dispatch_now,
        incident_id=req.incident_id,
    )

    report_id = req.report_id
    incident_id = req.incident_id
    dispatched = bool(req.incident_id) or req.dispatch_now or result.get("auto_dispatch", False)

    # If dispatch is triggered and incident hasn't been created yet in this session
    if dispatched and not incident_id:
        report_id = gen_id()[:8]
        incident_id = f"INC-{gen_id()[:4].upper()}"

        convo_summary = "\n".join([f"{m.role.capitalize()}: {m.content}" for m in req.messages if m.content != "HELLO_START"])
        lat = req.reporter_lat or 12.9716
        lng = req.reporter_lng or 77.5946

        report = IncidentReport(
            id=report_id,
            input_type="voice_agent",
            raw_text=convo_summary or f"Voice SOS: {result['incident_type']}",
            transcript=convo_summary,
            reporter_lat=lat,
            reporter_lng=lng,
            ai_confidence=0.95,
            preliminary_type=result["incident_type"],
            extracted_location=result.get("extracted_location", f"{lat:.4f}, {lng:.4f}"),
            human_review_required=False,
            status="confirmed",
        )

        inc = Incident(
            id=incident_id,
            type=result["incident_type"],
            severity=result["severity"],
            urgency=result["urgency"],
            people_affected=result["people_affected"],
            latitude=lat,
            longitude=lng,
            location_text=result.get("extracted_location", f"GPS {lat:.4f}, {lng:.4f}"),
            required_resources=result["required_resources"],
            status="ACTIVE",
        )

        async with async_session() as session:
            session.add(report)
            session.add(inc)
            await session.commit()

        await ws_manager.broadcast("incident.created", {
            "id": inc.id,
            "type": inc.type,
            "severity": inc.severity,
            "latitude": inc.latitude,
            "longitude": inc.longitude,
            "location_text": inc.location_text,
            "status": inc.status,
        })

        # Auto-run planning optimization to dispatch available resources to this incident
        try:
            from app.api.planning import generate_plan
            await generate_plan()
        except Exception as e:
            logger.warning(f"Auto-generate plan on incident creation: {e}")

    return VoiceChatResponse(
        reply=result["reply"],
        incident_type=result["incident_type"],
        severity=result["severity"],
        urgency=result["urgency"],
        people_affected=result["people_affected"],
        required_resources=result["required_resources"],
        ready_to_dispatch=result["ready_to_dispatch"],
        dispatched=dispatched,
        transition_to_command=dispatched,
        report_id=report_id,
        incident_id=incident_id,
        extracted_location=result.get("extracted_location"),
    )

