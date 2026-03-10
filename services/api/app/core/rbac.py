from enum import StrEnum


class Role(StrEnum):
    student = "student"
    mentor = "mentor"
    manager = "manager"
    admin = "admin"


ROLE_HIERARCHY = {
    Role.student: 1,
    Role.mentor: 2,
    Role.manager: 3,
    Role.admin: 4,
}


def has_role(required: Role, actual: Role) -> bool:
    return ROLE_HIERARCHY.get(actual, 0) >= ROLE_HIERARCHY.get(required, 0)
