"""Emergency report API endpoints."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, List
from datetime import datetime, timezone
from app.services.pipeline import pipeline
from app.services.websocket_manager import ws_manager
from app.db.database import async_session
from app.models.all_models import IncidentReport, Incident, HumanReview, gen_id
from app.schemas.reports import TextReportRequest, ReportResponse, EscalationItem
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


@router.get("/escalations")
async def get_active_escalations():
    """Retrieve all pending human escalations awaiting dispatcher takeover."""
    async with async_session() as session:
        res = await session.execute(
            select(IncidentReport)
            .where(IncidentReport.human_review_required == True)
            .order_by(IncidentReport.created_at.desc())
        )
        reports = res.scalars().all()
        result = []
        for r in reports:
            extra = r.missing_info if isinstance(r.missing_info, dict) else {}
            reason = extra.get("escalation_reason") or "Low AI confidence / Human triage required"
            thinking = extra.get("ai_thinking") or f"Escalated from Voice Dispatcher. Caller confidence {int((r.ai_confidence or 0.42) * 100)}%."
            result.append({
                "id": r.id,
                "report_id": r.id,
                "raw_text": r.raw_text,
                "caller_text": r.raw_text,
                "transcript": r.transcript,
                "ai_confidence": r.ai_confidence if r.ai_confidence is not None else 0.42,
                "ai_thinking": thinking,
                "category": r.preliminary_type or "General Emergency",
                "incident_type": r.preliminary_type or "General Emergency",
                "severity": 4 if (r.ai_confidence or 0) < 0.5 else 3,
                "urgency": "HIGH",
                "location_text": r.extracted_location or "Live Caller GPS",
                "latitude": r.reporter_lat or 12.9716,
                "reporter_lat": r.reporter_lat or 12.9716,
                "longitude": r.reporter_lng or 77.5946,
                "reporter_lng": r.reporter_lng or 77.5946,
                "escalation_reason": reason,
                "escalated_to": "Senior Dispatcher",
                "required_resources": ["AMBULANCE", "POLICE_UNIT"],
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else datetime.now(timezone.utc).isoformat(),
            })
        return result


@router.post("/resolve-escalation/{report_id}")
async def resolve_escalation(report_id: str):
    """Mark an escalation as reviewed and handled by human operator."""
    async with async_session() as session:
        res = await session.execute(select(IncidentReport).where(IncidentReport.id == report_id))
        report = res.scalar_one_or_none()
        if report:
            report.human_review_required = False
            report.status = "confirmed"
            await session.commit()
    await ws_manager.broadcast("escalation.resolved", {"report_id": report_id})
    return {"status": "resolved", "report_id": report_id}


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
    ai_confidence = float(result.get("ai_confidence", 0.85))
    ai_thinking = result.get("ai_thinking", "")
    human_escalation_required = bool(result.get("human_escalation_required", False)) or (ai_confidence < 0.60)
    escalation_reason = result.get("escalation_reason")

    # If dispatch is triggered and incident hasn't been created yet in this session
    if dispatched and not incident_id:
        report_id = report_id or gen_id()[:8]
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
            ai_confidence=ai_confidence,
            preliminary_type=result["incident_type"],
            extracted_location=result.get("extracted_location", f"{lat:.4f}, {lng:.4f}"),
            human_review_required=human_escalation_required,
            status="escalated" if human_escalation_required else "confirmed",
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

    # Handle Human Escalation Recording and Real-Time Operator Broadcast
    if human_escalation_required:
        if not report_id:
            report_id = f"ESC-{gen_id()[:6].upper()}"
        convo_summary = "\n".join([f"{m.role.capitalize()}: {m.content}" for m in req.messages if m.content != "HELLO_START"])
        lat = req.reporter_lat or 12.9716
        lng = req.reporter_lng or 77.5946

        async with async_session() as session:
            existing_res = await session.execute(select(IncidentReport).where(IncidentReport.id == report_id))
            existing = existing_res.scalar_one_or_none()
            if not existing:
                esc_report = IncidentReport(
                    id=report_id,
                    input_type="voice_agent",
                    raw_text=convo_summary or f"Escalated SOS: {result['incident_type']}",
                    transcript=convo_summary,
                    reporter_lat=lat,
                    reporter_lng=lng,
                    ai_confidence=ai_confidence,
                    preliminary_type=result["incident_type"],
                    extracted_location=result.get("extracted_location", f"{lat:.4f}, {lng:.4f}"),
                    human_review_required=True,
                    status="escalated",
                    missing_info={"escalation_reason": escalation_reason, "ai_thinking": ai_thinking},
                )
                session.add(esc_report)
            else:
                existing.human_review_required = True
                existing.status = "escalated"
                existing.ai_confidence = ai_confidence
                existing.transcript = convo_summary
                existing.missing_info = {"escalation_reason": escalation_reason, "ai_thinking": ai_thinking}
            await session.commit()

        await ws_manager.broadcast("escalation.created", {
            "report_id": report_id,
            "incident_id": incident_id,
            "incident_type": result["incident_type"],
            "severity": result["severity"],
            "urgency": result["urgency"],
            "ai_confidence": ai_confidence,
            "ai_thinking": ai_thinking,
            "escalation_reason": escalation_reason or "Low AI confidence requires human dispatcher verification",
            "location_text": result.get("extracted_location", f"GPS ({lat:.4f}, {lng:.4f})"),
            "latest_caller_text": req.messages[-1].content if req.messages else "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return VoiceChatResponse(
        reply=result["reply"],
        incident_type=result["incident_type"],
        severity=result["severity"],
        urgency=result["urgency"],
        people_affected=result["people_affected"],
        required_resources=result["required_resources"],
        ready_to_dispatch=result["ready_to_dispatch"],
        dispatched=dispatched,
        transition_to_command=dispatched or human_escalation_required,
        report_id=report_id,
        incident_id=incident_id,
        extracted_location=result.get("extracted_location"),
        ai_confidence=ai_confidence,
        ai_thinking=ai_thinking,
        human_escalation_required=human_escalation_required,
        escalation_reason=escalation_reason,
        escalated_to_operator=human_escalation_required,
    )

