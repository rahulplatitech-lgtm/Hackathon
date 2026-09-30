"""Human review API endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List
from app.db.database import async_session
from app.models.all_models import HumanReview, IncidentReport, Incident, gen_id
from app.schemas.human_review import ReviewModifyRequest, HumanReviewResponse
from app.agents.incident_assessment import assessment_agent
from app.services.websocket_manager import ws_manager
from sqlalchemy import select

router = APIRouter()

@router.get("", response_model=List[HumanReviewResponse])
async def get_review_queue():
    async with async_session() as session:
        result = await session.execute(
            select(HumanReview).where(HumanReview.operator_action == None)
        )
        reviews = result.scalars().all()
        response = []
        for rev in reviews:
            report_result = await session.execute(
                select(IncidentReport).where(IncidentReport.id == rev.report_id)
            )
            report = report_result.scalar_one_or_none()
            report_dict = None
            if report:
                report_dict = {
                    "id": report.id, "input_type": report.input_type,
                    "raw_text": report.raw_text, "transcript": report.transcript,
                    "audio_path": report.audio_path,
                    "reporter_lat": report.reporter_lat, "reporter_lng": report.reporter_lng,
                    "ai_confidence": report.ai_confidence,
                    "voice_distress_signal": report.voice_distress_signal,
                    "preliminary_type": report.preliminary_type,
                    "extracted_location": report.extracted_location,
                    "missing_info": report.missing_info,
                }
            response.append(HumanReviewResponse(
                id=rev.id, report_id=rev.report_id, report=report_dict,
                operator_action=rev.operator_action, corrected_data=rev.corrected_data,
                notes=rev.notes, created_at=rev.created_at,
            ))
        return response

@router.post("/{review_id}/confirm")
async def confirm_review(review_id: str):
    async with async_session() as session:
        result = await session.execute(select(HumanReview).where(HumanReview.id == review_id))
        review = result.scalar_one_or_none()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        review.operator_action = "CONFIRM"

        # Get report data and create incident
        report_result = await session.execute(
            select(IncidentReport).where(IncidentReport.id == review.report_id)
        )
        report = report_result.scalar_one_or_none()
        if report:
            report.status = "confirmed"
            report_data = {
                "report_id": report.id,
                "raw_text": report.raw_text,
                "reporter_latitude": report.reporter_lat,
                "reporter_longitude": report.reporter_lng,
                "analysis": {
                    "incident_type": report.preliminary_type or "General Emergency",
                    "severity": 3, "urgency": "MEDIUM", "people_affected": 1,
                    "required_resources": ["AMBULANCE"],
                    "extracted_location": report.extracted_location,
                },
            }
            inc_data = assessment_agent.assess(report_data)
            incident = Incident(**inc_data)
            session.add(incident)
            await ws_manager.broadcast("incident.created", inc_data)

        await session.commit()

    return {"status": "confirmed", "review_id": review_id}

@router.post("/{review_id}/modify")
async def modify_review(review_id: str, req: ReviewModifyRequest):
    async with async_session() as session:
        result = await session.execute(select(HumanReview).where(HumanReview.id == review_id))
        review = result.scalar_one_or_none()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        review.operator_action = "MODIFY"
        review.corrected_data = req.corrected_data
        review.notes = req.notes

        report_result = await session.execute(
            select(IncidentReport).where(IncidentReport.id == review.report_id)
        )
        report = report_result.scalar_one_or_none()
        if report:
            report.status = "confirmed"
            report_data = {
                "report_id": report.id,
                "raw_text": report.raw_text,
                "reporter_latitude": report.reporter_lat,
                "reporter_longitude": report.reporter_lng,
                "analysis": {
                    "incident_type": report.preliminary_type or "General Emergency",
                    "severity": 3, "urgency": "MEDIUM", "people_affected": 1,
                    "required_resources": ["AMBULANCE"],
                    "extracted_location": report.extracted_location,
                },
            }
            inc_data = assessment_agent.assess(report_data, req.corrected_data)
            incident = Incident(**inc_data)
            session.add(incident)
            await ws_manager.broadcast("incident.created", inc_data)

        await session.commit()

    return {"status": "modified", "review_id": review_id}

@router.post("/{review_id}/reject")
async def reject_review(review_id: str):
    async with async_session() as session:
        result = await session.execute(select(HumanReview).where(HumanReview.id == review_id))
        review = result.scalar_one_or_none()
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        review.operator_action = "REJECT"
        report_result = await session.execute(
            select(IncidentReport).where(IncidentReport.id == review.report_id)
        )
        report = report_result.scalar_one_or_none()
        if report:
            report.status = "rejected"
        await session.commit()
    return {"status": "rejected"}

@router.post("/{review_id}/call")
async def call_reporter(review_id: str):
    """Simulate calling the reporter (DEMO MODE only)."""
    return {
        "status": "call_initiated",
        "message": "Simulated callback initiated (demo mode). No real call placed.",
        "review_id": review_id,
    }
