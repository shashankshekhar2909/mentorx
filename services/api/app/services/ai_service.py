from ..schemas.ai import StudyPlanRequest, StudyPlanResponse


class AIService:
    def build_study_plan(self, payload: StudyPlanRequest, user_email: str) -> StudyPlanResponse:
        milestones = [
            f"Weeks 1-2: diagnostics and baseline for {payload.exam}",
            f"Weeks 3-6: targeted practice for {', '.join(payload.weaknesses) if payload.weaknesses else 'weak topics'}",
            "Weeks 7+: mocks, error logs, and revision cycles",
        ]
        summary = (
            f"Study plan for {user_email}: allocate {payload.weekly_hours} hours/week, reinforce "
            f"{', '.join(payload.strengths) if payload.strengths else 'strength areas'}, and address priority weaknesses."
        )
        return StudyPlanResponse(summary=summary, milestones=milestones)
